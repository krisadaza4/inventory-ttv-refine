-- คลังย่อย (v1.1.0): รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้
-- คลังใหญ่ = สินค้าคงคลังเดิม (ไม่มีแถวในตาราง warehouses) คลังย่อย = Online / ขายส่ง / อะไหล่ (admin เพิ่มได้)
--   โอนเข้าคลังย่อย (transfer_in)  คลังใหญ่ → คลังย่อย  ยอดรวมไม่เปลี่ยน
--   โอนกลับคลังใหญ่ (transfer_out) คลังย่อย → คลังใหญ่  ยอดรวมไม่เปลี่ยน
--   ขายผ่านคลังย่อย (out + warehouse_id) ตัดของคลังย่อยก่อน ไม่พอตัดส่วนที่ขาดจากคลังใหญ่
--     warehouse_qty = ส่วนที่ตัดจากคลังย่อย (record_movement คำนวณให้)
--   รับเข้า / ปรับยอด / ส่งซ่อม / เบิกออกไม่ระบุคลัง ใช้ยอดคลังใหญ่
-- product_stock: on_hand = ของดีรวมทุกคลัง (เหมือนเดิม), sub_qty = ของดีที่อยู่ในคลังย่อย
--   คลังใหญ่ = on_hand - sub_qty
-- ข้อมูลเดิมทั้งหมดอยู่ในคลังใหญ่ ไม่ต้องย้าย

-- 1) ตารางคลังย่อย ---------------------------------------------------------
create table if not exists public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),

  constraint warehouses_name_unique    unique (name),
  constraint warehouses_name_not_blank check (length(trim(name)) > 0)
);

insert into public.warehouses (name, sort_order) values
  ('Online', 1),
  ('ขายส่ง', 2),
  ('อะไหล่', 3)
on conflict (name) do nothing;

-- สินค้าที่แสดงในคลังย่อย (1 สินค้าอยู่ได้หลายคลัง) โอนเข้าคลังย่อยแล้วเพิ่มให้อัตโนมัติ
create table if not exists public.product_warehouses (
  product_id   uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  created_at   timestamptz not null default now(),

  primary key (product_id, warehouse_id)
);

create index if not exists product_warehouses_warehouse_idx
  on public.product_warehouses using btree (warehouse_id);

-- 2) รายการเคลื่อนไหว: คลังย่อยที่เกี่ยวข้อง --------------------------------
alter table public.stock_movements add column if not exists warehouse_id uuid references public.warehouses (id);
alter table public.stock_movements add column if not exists warehouse_qty numeric(12, 2);

create index if not exists stock_movements_warehouse_idx
  on public.stock_movements using btree (warehouse_id);

alter table public.stock_movements drop constraint if exists stock_movements_type_valid;
alter table public.stock_movements add constraint stock_movements_type_valid check (
  type in ('in', 'out', 'adjust', 'to_repair', 'repaired', 'write_off', 'transfer_in', 'transfer_out')
);

alter table public.stock_movements drop constraint if exists stock_movements_warehouse_valid;
alter table public.stock_movements add constraint stock_movements_warehouse_valid check (
  (type in ('transfer_in', 'transfer_out') and warehouse_id is not null and warehouse_qty = quantity)
  or (type = 'out' and warehouse_id is null and warehouse_qty is null)
  or (type = 'out' and warehouse_id is not null and warehouse_qty >= 0 and warehouse_qty <= quantity)
  or (type not in ('out', 'transfer_in', 'transfer_out') and warehouse_id is null and warehouse_qty is null)
);

-- 3) view ------------------------------------------------------------------
-- sub_qty ต่อท้าย (create or replace view เพิ่มคอลัมน์ได้เฉพาะท้ายสุด)
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
  coalesce(sum(
    case m.type
      when 'in' then m.quantity
      when 'adjust' then m.quantity
      when 'repaired' then m.quantity
      when 'out' then -m.quantity
      when 'to_repair' then -m.quantity
      else 0
    end
  ), 0)::numeric(12, 2) as on_hand,
  p.image_path,
  p.location,
  p.avg_monthly_sales,
  coalesce(sum(
    case m.type
      when 'to_repair' then m.quantity
      when 'repaired' then -m.quantity
      when 'write_off' then -m.quantity
      else 0
    end
  ), 0)::numeric(12, 2) as repair_qty,
  p.legacy_sku,
  coalesce(sum(
    case m.type
      when 'transfer_in' then m.quantity
      when 'transfer_out' then -m.quantity
      when 'out' then -coalesce(m.warehouse_qty, 0)
      else 0
    end
  ), 0)::numeric(12, 2) as sub_qty
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

-- ยอดของแต่ละสินค้าในแต่ละคลังย่อย (เฉพาะที่เคยมีรายการในคลังนั้น)
create or replace view public.warehouse_stock
with (security_invoker = true)
as
select
  m.warehouse_id,
  m.product_id,
  sum(
    case m.type
      when 'transfer_in' then m.quantity
      when 'transfer_out' then -m.quantity
      when 'out' then -coalesce(m.warehouse_qty, 0)
      else 0
    end
  )::numeric(12, 2) as quantity
from public.stock_movements m
where m.warehouse_id is not null
group by m.warehouse_id, m.product_id;

-- 4) record_movement: เพิ่ม p_warehouse_id ----------------------------------
-- ลบตัวเดิม (5 พารามิเตอร์) ก่อน ไม่ให้มีสองตัวชื่อซ้ำ
drop function if exists public.record_movement(uuid, text, numeric, date, text);

create or replace function public.record_movement(
  p_product_id    uuid,
  p_type          text,
  p_quantity      numeric,
  p_movement_date date default null,
  p_note          text default null,
  p_warehouse_id  uuid default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role      text := public.current_app_role();
  v_today     date := (now() at time zone 'Asia/Bangkok')::date;
  v_date      date := coalesce(p_movement_date, v_today);
  v_note      text := nullif(trim(p_note), '');
  v_active    boolean;
  v_wh_active boolean;
  v_good      numeric;
  v_repair    numeric;
  v_sub_all   numeric;
  v_sub       numeric;
  v_central   numeric;
  v_wh_qty    numeric;
  v_row       public.stock_movements;
begin
  -- 1. ผู้เรียกต้องมี profile, ปรับยอด/ตัดจำหน่ายได้เฉพาะ admin
  if v_role is null then
    raise exception 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน'
      using errcode = '42501', hint = 'no_profile';
  end if;

  if p_type is null or p_type not in
     ('in', 'out', 'adjust', 'to_repair', 'repaired', 'write_off', 'transfer_in', 'transfer_out') then
    raise exception 'ประเภทรายการไม่ถูกต้อง' using hint = 'invalid_type';
  end if;

  if p_type = 'adjust' and v_role <> 'admin' then
    raise exception 'ปรับยอดได้เฉพาะเจ้าของร้าน'
      using errcode = '42501', hint = 'adjust_admin_only';
  end if;

  if p_type = 'write_off' and v_role <> 'admin' then
    raise exception 'ตัดจำหน่ายได้เฉพาะเจ้าของร้าน'
      using errcode = '42501', hint = 'write_off_admin_only';
  end if;

  if p_quantity is null
     or p_quantity <> round(p_quantity, 2)
     or (p_type <> 'adjust' and p_quantity <= 0)
     or (p_type = 'adjust' and p_quantity = 0) then
    raise exception 'จำนวนไม่ถูกต้อง' using hint = 'invalid_quantity';
  end if;

  if v_date > v_today then
    raise exception 'วันที่ต้องไม่เป็นวันในอนาคต' using hint = 'future_date';
  end if;

  if p_type = 'adjust' and v_note is null then
    raise exception 'การปรับยอดต้องระบุหมายเหตุ' using hint = 'adjust_needs_note';
  end if;

  if p_type in ('to_repair', 'repaired', 'write_off') and v_note is null then
    raise exception 'กรุณาระบุเหตุผล' using hint = 'needs_note';
  end if;

  -- 2. คลังย่อย: โอนต้องระบุคลัง, ระบุคลังได้เฉพาะโอน/เบิกออก
  if p_type in ('transfer_in', 'transfer_out') and p_warehouse_id is null then
    raise exception 'กรุณาเลือกคลังย่อย' using hint = 'warehouse_required';
  end if;

  if p_warehouse_id is not null and p_type not in ('out', 'transfer_in', 'transfer_out') then
    raise exception 'รายการนี้ทำได้ที่คลังใหญ่เท่านั้น' using hint = 'warehouse_not_allowed';
  end if;

  if p_warehouse_id is not null then
    select active into v_wh_active from public.warehouses where id = p_warehouse_id;
    if not found then
      raise exception 'ไม่พบคลังย่อย' using hint = 'warehouse_not_found';
    end if;
    -- คลังที่ปิดใช้งานแล้ว ยังโอนของที่เหลือกลับคลังใหญ่ได้
    if not v_wh_active and p_type <> 'transfer_out' then
      raise exception 'คลังย่อยนี้ถูกปิดใช้งานแล้ว' using hint = 'warehouse_inactive';
    end if;
  end if;

  -- 3. ล็อกแถวสินค้า กันสองคนบันทึกสินค้าเดียวกันพร้อมกัน
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

  -- 4. ยอดปัจจุบัน: ของดีรวม, รอซ่อม, ในคลังย่อยทั้งหมด, ในคลังที่เลือก
  select
    coalesce(sum(case type
      when 'in' then quantity when 'adjust' then quantity when 'repaired' then quantity
      when 'out' then -quantity when 'to_repair' then -quantity else 0 end), 0),
    coalesce(sum(case type
      when 'to_repair' then quantity when 'repaired' then -quantity when 'write_off' then -quantity
      else 0 end), 0),
    coalesce(sum(case type
      when 'transfer_in' then quantity when 'transfer_out' then -quantity
      when 'out' then -coalesce(warehouse_qty, 0) else 0 end), 0),
    coalesce(sum(case when warehouse_id is distinct from p_warehouse_id then 0 else case type
      when 'transfer_in' then quantity when 'transfer_out' then -quantity
      when 'out' then -coalesce(warehouse_qty, 0) else 0 end end), 0)
  into v_good, v_repair, v_sub_all, v_sub
  from public.stock_movements
  where product_id = p_product_id;

  v_central := v_good - v_sub_all;

  -- 5. ยอดหลังบันทึกต้องไม่ติดลบ
  if p_type = 'out' and p_warehouse_id is not null then
    if v_sub + v_central - p_quantity < 0 then
      raise exception 'จำนวนที่ขายได้ไม่พอ (ขายได้ %)', v_sub + v_central using hint = 'insufficient_stock';
    end if;
    v_wh_qty := least(v_sub, p_quantity);
  elsif p_type in ('out', 'to_repair', 'transfer_in') and v_central - p_quantity < 0 then
    raise exception 'คลังใหญ่คงเหลือไม่พอ (คงเหลือ %)', v_central using hint = 'insufficient_stock';
  elsif p_type = 'adjust' and v_central + p_quantity < 0 then
    raise exception 'คลังใหญ่คงเหลือไม่พอ (คงเหลือ %)', v_central using hint = 'insufficient_stock';
  elsif p_type = 'transfer_out' and v_sub - p_quantity < 0 then
    raise exception 'คลังย่อยคงเหลือไม่พอ (คงเหลือ %)', v_sub using hint = 'insufficient_warehouse';
  elsif p_type in ('repaired', 'write_off') and v_repair - p_quantity < 0 then
    raise exception 'ยอดรอซ่อมไม่พอ (รอซ่อม %)', v_repair using hint = 'insufficient_repair';
  end if;

  if p_type in ('transfer_in', 'transfer_out') then
    v_wh_qty := p_quantity;
  end if;

  -- 6. บันทึกโดยใช้ผู้เรียกเป็นผู้บันทึก
  insert into public.stock_movements
    (product_id, type, quantity, movement_date, note, created_by, warehouse_id, warehouse_qty)
  values
    (p_product_id, p_type, p_quantity, v_date, v_note, (select auth.uid()), p_warehouse_id, v_wh_qty)
  returning * into v_row;

  -- โอนเข้าคลังย่อยแล้ว สินค้าแสดงในคลังนั้นเสมอ
  if p_type = 'transfer_in' then
    insert into public.product_warehouses (product_id, warehouse_id)
    values (p_product_id, p_warehouse_id)
    on conflict do nothing;
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_movement(uuid, text, numeric, date, text, uuid) from public, anon;
grant execute on function public.record_movement(uuid, text, numeric, date, text, uuid) to authenticated;

-- 5) สิทธิ์และ RLS ------------------------------------------------------------
-- ทุกบทบาทดูได้, เพิ่ม/แก้คลังเฉพาะ admin (ไม่มีการลบคลัง ใช้ปิดใช้งานแทน)
-- product_warehouses: admin เพิ่ม/เอาออกได้ (ลบแถวได้เฉพาะตารางนี้)

revoke all on public.warehouses         from anon, authenticated;
revoke all on public.product_warehouses from anon, authenticated;
revoke all on public.warehouse_stock    from anon, authenticated;

grant select on public.warehouses         to authenticated;
grant select on public.product_warehouses to authenticated;
grant select on public.warehouse_stock    to authenticated;
grant select on public.product_stock      to authenticated;
grant insert (name, sort_order, active) on public.warehouses to authenticated;
grant update (name, sort_order, active) on public.warehouses to authenticated;
grant insert (product_id, warehouse_id) on public.product_warehouses to authenticated;
grant delete on public.product_warehouses to authenticated;

alter table public.warehouses         enable row level security;
alter table public.product_warehouses enable row level security;

drop policy if exists "warehouses_select_with_role" on public.warehouses;
create policy "warehouses_select_with_role"
  on public.warehouses for select
  to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists "warehouses_insert_admin" on public.warehouses;
create policy "warehouses_insert_admin"
  on public.warehouses for insert
  to authenticated
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "warehouses_update_admin" on public.warehouses;
create policy "warehouses_update_admin"
  on public.warehouses for update
  to authenticated
  using ((select public.current_app_role()) = 'admin')
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "product_warehouses_select_with_role" on public.product_warehouses;
create policy "product_warehouses_select_with_role"
  on public.product_warehouses for select
  to authenticated
  using ((select public.current_app_role()) is not null);

drop policy if exists "product_warehouses_insert_admin" on public.product_warehouses;
create policy "product_warehouses_insert_admin"
  on public.product_warehouses for insert
  to authenticated
  with check ((select public.current_app_role()) = 'admin');

drop policy if exists "product_warehouses_delete_admin" on public.product_warehouses;
create policy "product_warehouses_delete_admin"
  on public.product_warehouses for delete
  to authenticated
  using ((select public.current_app_role()) = 'admin');

-- ตรวจผล: ควรได้คลัง 3 แถว, คอลัมน์ sub_qty 1 แถว, ฟังก์ชัน record_movement 1 แถว (6 พารามิเตอร์)
select name, sort_order, active from public.warehouses order by sort_order;
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'product_stock' and column_name = 'sub_qty';
select pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_movement';
