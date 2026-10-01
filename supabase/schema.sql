-- Inventory TTV: ตาราง, view, ฟังก์ชัน, RLS (อ้างอิง design.md ข้อ 4–6)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง

-- ตาราง ------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null,
  created_at   timestamptz not null default now(),

  constraint profiles_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint profiles_role_valid             check (role in ('admin', 'staff'))
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null,
  barcode       text,
  name          text not null,
  category      text not null,
  unit          text not null,
  reorder_point numeric(12, 2) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint products_sku_unique            unique (sku),
  constraint products_barcode_unique        unique (barcode),
  constraint products_sku_not_blank         check (length(trim(sku)) > 0),
  constraint products_barcode_not_blank     check (barcode is null or length(trim(barcode)) > 0),
  constraint products_name_not_blank        check (length(trim(name)) > 0),
  constraint products_category_not_blank    check (length(trim(category)) > 0),
  constraint products_unit_not_blank        check (length(trim(unit)) > 0),
  constraint products_reorder_point_non_neg check (reorder_point >= 0)
);

-- เฟส 7: ที่อยู่ไฟล์รูปใน bucket product-images (bucket และนโยบายอยู่ใน migration_product_images.sql)
alter table public.products add column if not exists image_path text;

-- ที่เก็บสินค้าในร้าน เช่น "แลค A4" (ไม่บังคับ) migration_product_location.sql
alter table public.products add column if not exists location text;

create index if not exists products_category_idx on public.products using btree (category);

-- updated_at อัปเดตเองทุกครั้งที่แก้สินค้า
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ห้ามวันในอนาคต ตรวจใน record_movement (T2.3) เพราะ check constraint ใช้เวลาปัจจุบันไม่ได้
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id),
  type          text not null,
  quantity      numeric(12, 2) not null,
  movement_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  note          text,
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),

  constraint stock_movements_type_valid check (type in ('in', 'out', 'adjust')),
  constraint stock_movements_quantity_valid check (
    (type in ('in', 'out') and quantity > 0)
    or (type = 'adjust' and quantity <> 0)
  ),
  constraint stock_movements_adjust_needs_note check (
    type <> 'adjust' or length(trim(coalesce(note, ''))) > 0
  )
);

create index if not exists stock_movements_product_id_idx
  on public.stock_movements using btree (product_id);
create index if not exists stock_movements_created_by_idx
  on public.stock_movements using btree (created_by);
-- ประวัติเรียงล่าสุดก่อน โหลดทีละ 50
create index if not exists stock_movements_history_idx
  on public.stock_movements using btree (movement_date desc, created_at desc);

-- ฟังก์ชันช่วย: บทบาทของผู้เรียก (null ถ้าไม่มี profile) ---------------------
-- ชื่อไม่ใช่ current_role เพราะเป็นคำสงวนของ Postgres
-- security definer เพื่อให้ใช้ใน RLS ได้โดยไม่ติด RLS ของ profiles เอง

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- view: สินค้าพร้อมจำนวนคงเหลือ -------------------------------------------
-- security_invoker ให้ใช้ RLS ของผู้เรียก ไม่ใช่ของเจ้าของ view

create or replace view public.product_stock
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.barcode,
  p.name,
  p.category,
  p.unit,
  p.reorder_point,
  p.active,
  p.created_at,
  p.updated_at,
  coalesce(
    sum(case m.type when 'out' then -m.quantity else m.quantity end),
    0
  )::numeric(12, 2) as on_hand,
  p.image_path,
  p.location
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

-- ฟังก์ชัน: บันทึกรายการเคลื่อนไหว (ช่องทางเดียวที่ insert ได้) --------------
-- security definer เพราะ authenticated ไม่มีสิทธิ์ insert ตรง
-- ข้อความผิดพลาดเป็นภาษาไทย ส่วน hint เป็นรหัสให้ supabaseErrors.js ใช้แยกกรณี

create or replace function public.record_movement(
  p_product_id    uuid,
  p_type          text,
  p_quantity      numeric,
  p_movement_date date default null,
  p_note          text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text := public.current_app_role();
  v_today   date := (now() at time zone 'Asia/Bangkok')::date;
  v_date    date := coalesce(p_movement_date, v_today);
  v_note    text := nullif(trim(p_note), '');
  v_active  boolean;
  v_on_hand numeric;
  v_delta   numeric;
  v_row     public.stock_movements;
begin
  -- 1. ผู้เรียกต้องมี profile และปรับยอดได้เฉพาะ admin
  if v_role is null then
    raise exception 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน'
      using errcode = '42501', hint = 'no_profile';
  end if;

  if p_type is null or p_type not in ('in', 'out', 'adjust') then
    raise exception 'ประเภทรายการไม่ถูกต้อง' using hint = 'invalid_type';
  end if;

  if p_type = 'adjust' and v_role <> 'admin' then
    raise exception 'ปรับยอดได้เฉพาะเจ้าของร้าน'
      using errcode = '42501', hint = 'adjust_admin_only';
  end if;

  if p_quantity is null
     or p_quantity <> round(p_quantity, 2)
     or (p_type in ('in', 'out') and p_quantity <= 0)
     or (p_type = 'adjust' and p_quantity = 0) then
    raise exception 'จำนวนไม่ถูกต้อง' using hint = 'invalid_quantity';
  end if;

  if v_date > v_today then
    raise exception 'วันที่ต้องไม่เป็นวันในอนาคต' using hint = 'future_date';
  end if;

  if p_type = 'adjust' and v_note is null then
    raise exception 'การปรับยอดต้องระบุหมายเหตุ' using hint = 'adjust_needs_note';
  end if;

  -- 2. ล็อกแถวสินค้า กันสองคนบันทึกสินค้าเดียวกันพร้อมกัน
  select active into v_active
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'ไม่พบสินค้า' using hint = 'product_not_found';
  end if;

  if not v_active then
    raise exception 'สินค้านี้ถูกปิดใช้งานแล้ว' using hint = 'product_inactive';
  end if;

  -- 3. จำนวนคงเหลือใหม่ต้องไม่ติดลบ
  select coalesce(sum(case type when 'out' then -quantity else quantity end), 0)
  into v_on_hand
  from public.stock_movements
  where product_id = p_product_id;

  v_delta := case p_type when 'out' then -p_quantity else p_quantity end;

  if v_on_hand + v_delta < 0 then
    raise exception 'จำนวนคงเหลือไม่พอ (คงเหลือ %)', v_on_hand
      using hint = 'insufficient_stock';
  end if;

  -- 4. บันทึกโดยใช้ผู้เรียกเป็นผู้บันทึก
  insert into public.stock_movements
    (product_id, type, quantity, movement_date, note, created_by)
  values
    (p_product_id, p_type, p_quantity, v_date, v_note, (select auth.uid()))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_movement(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.record_movement(uuid, text, numeric, date, text) to authenticated;

-- สิทธิ์ระดับตาราง: revoke ทั้งหมดก่อน แล้ว grant เฉพาะที่ใช้ -----------------
-- anon ไม่มีสิทธิ์ใด ๆ, ห้าม delete ทุกตาราง
-- products: insert/update ได้เฉพาะคอลัมน์ข้อมูลสินค้า (id, created_at, updated_at ระบบจัดการเอง)

revoke all on public.profiles        from anon, authenticated;
revoke all on public.products        from anon, authenticated;
revoke all on public.stock_movements from anon, authenticated;
revoke all on public.product_stock   from anon, authenticated;

grant select on public.profiles        to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.product_stock   to authenticated;
grant select on public.products        to authenticated;
grant insert (sku, barcode, name, category, unit, reorder_point, active, image_path, location)
  on public.products to authenticated;
grant update (sku, barcode, name, category, unit, reorder_point, active, image_path, location)
  on public.products to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- RLS: ต้องมี profile ถึงเห็นข้อมูล, เพิ่ม/แก้สินค้าเฉพาะ admin ------------------
-- stock_movements ไม่มีนโยบาย insert/update/delete: บันทึกผ่าน record_movement เท่านั้น

alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "profiles_select_with_role" on public.profiles;
create policy "profiles_select_with_role"
  on public.profiles for select
  to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists "products_select_with_role" on public.products;
create policy "products_select_with_role"
  on public.products for select
  to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin"
  on public.products for insert
  to authenticated
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update
  to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "stock_movements_select_with_role" on public.stock_movements;
create policy "stock_movements_select_with_role"
  on public.stock_movements for select
  to authenticated
  using ((select public.current_app_role()) is not null);
