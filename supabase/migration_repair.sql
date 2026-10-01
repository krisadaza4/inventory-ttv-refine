-- สินค้ารอซ่อม: ประเภทรายการ ส่งซ่อม / ซ่อมเสร็จ / ตัดจำหน่าย (รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้)
-- ยอดแยกเป็น ของดี (on_hand) และ รอซ่อม (repair_qty)
--   รับเข้า +ของดี | เบิกออก −ของดี | ปรับยอด ±ของดี
--   ส่งซ่อม ของดี → รอซ่อม | ซ่อมเสร็จ รอซ่อม → ของดี | ตัดจำหน่าย −รอซ่อม (ซ่อมไม่ได้)
-- ส่งซ่อม/ซ่อมเสร็จ/ตัดจำหน่าย ต้องระบุเหตุผล, ตัดจำหน่ายได้เฉพาะ admin
-- รวม migration_product_avg_sales.sql ไว้ด้วย (view ต้องมีคอลัมน์นั้น) รันก่อนหรือหลังไฟล์นั้นก็ได้

-- 1) ยอดขายเฉลี่ย (ซ้ำกับ migration_product_avg_sales.sql ได้) ----------------
alter table public.products add column if not exists avg_monthly_sales numeric(12, 2);
grant insert (avg_monthly_sales) on public.products to authenticated;
grant update (avg_monthly_sales) on public.products to authenticated;

-- 2) ประเภทรายการใหม่ ------------------------------------------------------
alter table public.stock_movements drop constraint if exists stock_movements_type_valid;
alter table public.stock_movements add constraint stock_movements_type_valid
  check (type in ('in', 'out', 'adjust', 'to_repair', 'repaired', 'write_off'));

alter table public.stock_movements drop constraint if exists stock_movements_quantity_valid;
alter table public.stock_movements add constraint stock_movements_quantity_valid check (
  (type = 'adjust' and quantity <> 0)
  or (type <> 'adjust' and quantity > 0)
);

alter table public.stock_movements drop constraint if exists stock_movements_adjust_needs_note;
alter table public.stock_movements drop constraint if exists stock_movements_note_required;
alter table public.stock_movements add constraint stock_movements_note_required check (
  type not in ('adjust', 'to_repair', 'repaired', 'write_off') or length(trim(coalesce(note, ''))) > 0
);

-- 3) view: on_hand = ของดี, repair_qty = รอซ่อม (ต่อท้าย) ------------------------
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
  ), 0)::numeric(12, 2) as repair_qty
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

grant select on public.product_stock to authenticated;

-- 4) record_movement รองรับประเภทใหม่ -----------------------------------------
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
  v_good    numeric;
  v_repair  numeric;
  v_row     public.stock_movements;
begin
  -- 1. ผู้เรียกต้องมี profile, ปรับยอด/ตัดจำหน่ายได้เฉพาะ admin
  if v_role is null then
    raise exception 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน'
      using errcode = '42501', hint = 'no_profile';
  end if;

  if p_type is null or p_type not in ('in', 'out', 'adjust', 'to_repair', 'repaired', 'write_off') then
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

  -- 3. ของดีและรอซ่อมหลังบันทึกต้องไม่ติดลบ
  select
    coalesce(sum(case type
      when 'in' then quantity when 'adjust' then quantity when 'repaired' then quantity
      when 'out' then -quantity when 'to_repair' then -quantity else 0 end), 0),
    coalesce(sum(case type
      when 'to_repair' then quantity when 'repaired' then -quantity when 'write_off' then -quantity
      else 0 end), 0)
  into v_good, v_repair
  from public.stock_movements
  where product_id = p_product_id;

  if p_type in ('out', 'to_repair') and v_good - p_quantity < 0 then
    raise exception 'จำนวนคงเหลือไม่พอ (คงเหลือ %)', v_good using hint = 'insufficient_stock';
  end if;

  if p_type = 'adjust' and v_good + p_quantity < 0 then
    raise exception 'จำนวนคงเหลือไม่พอ (คงเหลือ %)', v_good using hint = 'insufficient_stock';
  end if;

  if p_type in ('repaired', 'write_off') and v_repair - p_quantity < 0 then
    raise exception 'ยอดรอซ่อมไม่พอ (รอซ่อม %)', v_repair using hint = 'insufficient_repair';
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

-- ตรวจผล: ควรได้ 2 แถว (avg_monthly_sales, repair_qty) และ 1 แถว constraint
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'product_stock'
  and column_name in ('avg_monthly_sales', 'repair_qty');
select conname from pg_constraint where conname = 'stock_movements_note_required';
