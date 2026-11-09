-- Inventory TTV: บทบาทใหม่ Store/QC, Manager, Marketing (2026-11-09)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง และไม่แตะข้อมูลเดิม (admin / staff ทำงานเหมือนเดิมทุกอย่าง)
--
-- บทบาท (profiles.role):
--   admin      เจ้าของร้าน / Dev       ทำได้ทุกอย่าง
--   store_qc   Store/QC                ทำได้ทุกอย่างในแอป (เท่า admin) ยกเว้นเรื่องคลังย่อยเก่าที่เลิกใช้แล้ว
--   staff      พนักงาน (บัญชีเดิม)     รับเข้า เบิกออก ส่งซ่อม ซ่อมเสร็จ (ปรับยอด/ตัดจำหน่าย/จัดการสินค้าไม่ได้)
--   manager    Manager                 ดูอย่างเดียว บันทึกรายการไม่ได้
--   marketing  Marketing               ดูอย่างเดียว บันทึกรายการไม่ได้
-- บทบาทที่ไม่รู้จักในอนาคต: record_movement ปฏิเสธ (ดูอย่างเดียว) จนกว่าจะเพิ่มในรายการที่บันทึกได้

-- 1) ค่าบทบาทที่ใช้ได้ ---------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_valid;
alter table public.profiles add constraint profiles_role_valid
  check (role in ('admin', 'staff', 'store_qc', 'manager', 'marketing'));

-- 2) record_movement: ดูอย่างเดียวบันทึกไม่ได้, ปรับยอด/ตัดจำหน่าย = admin หรือ store_qc ----
-- ตัวเต็มตามที่ใช้งานจริงอยู่ (ยังรับ p_warehouse_id เพราะข้อมูลคลังย่อยเก่ายังอยู่ในฐานข้อมูล แอปส่ง null เสมอ)
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
  if v_role is null then
    raise exception 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน'
      using errcode = '42501', hint = 'no_profile';
  end if;

  -- บันทึกรายการได้เฉพาะ admin / store_qc / staff (manager, marketing และบทบาทอื่นดูอย่างเดียว)
  if v_role not in ('admin', 'store_qc', 'staff') then
    raise exception 'บัญชีนี้ดูข้อมูลได้อย่างเดียว บันทึกรายการไม่ได้'
      using errcode = '42501', hint = 'read_only_role';
  end if;

  if p_type is null or p_type not in
     ('in', 'out', 'adjust', 'to_repair', 'repaired', 'write_off', 'transfer_in', 'transfer_out') then
    raise exception 'ประเภทรายการไม่ถูกต้อง' using hint = 'invalid_type';
  end if;

  if p_type = 'adjust' and v_role not in ('admin', 'store_qc') then
    raise exception 'ปรับยอดได้เฉพาะเจ้าของร้านและ Store/QC'
      using errcode = '42501', hint = 'adjust_admin_only';
  end if;

  if p_type = 'write_off' and v_role not in ('admin', 'store_qc') then
    raise exception 'ตัดจำหน่ายได้เฉพาะเจ้าของร้านและ Store/QC'
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
    if not v_wh_active and p_type <> 'transfer_out' then
      raise exception 'คลังย่อยนี้ถูกปิดใช้งานแล้ว' using hint = 'warehouse_inactive';
    end if;
  end if;

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

  insert into public.stock_movements
    (product_id, type, quantity, movement_date, note, created_by, warehouse_id, warehouse_qty)
  values
    (p_product_id, p_type, p_quantity, v_date, v_note, (select auth.uid()), p_warehouse_id, v_wh_qty)
  returning * into v_row;

  if p_type = 'transfer_in' then
    insert into public.product_warehouses (product_id, warehouse_id)
    values (p_product_id, p_warehouse_id)
    on conflict do nothing;
  end if;

  return v_row;
end;
$$;

-- 3) เพิ่ม/แก้สินค้า และนำเข้ายอดขาย: admin หรือ store_qc ----------------------------
drop policy if exists "products_insert_admin" on public.products;
drop policy if exists "products_insert_full_access" on public.products;
create policy "products_insert_full_access"
  on public.products for insert
  to authenticated
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists "products_update_admin" on public.products;
drop policy if exists "products_update_full_access" on public.products;
create policy "products_update_full_access"
  on public.products for update
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'store_qc'))
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists "monthly_sales_insert_admin" on public.product_monthly_sales;
drop policy if exists "monthly_sales_insert_full_access" on public.product_monthly_sales;
create policy "monthly_sales_insert_full_access"
  on public.product_monthly_sales for insert
  to authenticated
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists "monthly_sales_update_admin" on public.product_monthly_sales;
drop policy if exists "monthly_sales_update_full_access" on public.product_monthly_sales;
create policy "monthly_sales_update_full_access"
  on public.product_monthly_sales for update
  to authenticated
  using ((select public.current_app_role()) in ('admin', 'store_qc'))
  with check ((select public.current_app_role()) in ('admin', 'store_qc'));

-- 4) รูปสินค้า (bucket product-images): เพิ่ม/เปลี่ยน/ลบ = admin หรือ store_qc ------------
drop policy if exists "product_images_insert_admin" on storage.objects;
drop policy if exists "product_images_insert_full_access" on storage.objects;
create policy "product_images_insert_full_access"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists "product_images_update_admin" on storage.objects;
drop policy if exists "product_images_update_full_access" on storage.objects;
create policy "product_images_update_full_access"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select public.current_app_role()) in ('admin', 'store_qc'))
  with check (bucket_id = 'product-images' and (select public.current_app_role()) in ('admin', 'store_qc'));

drop policy if exists "product_images_delete_admin" on storage.objects;
drop policy if exists "product_images_delete_full_access" on storage.objects;
create policy "product_images_delete_full_access"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select public.current_app_role()) in ('admin', 'store_qc'));

-- ไม่แตะ: ตาราง warehouses / product_warehouses (คลังย่อยเลิกใช้ ยังเป็น admin อย่างเดียว)
-- ทุกบทบาทที่มี profile ยังดูข้อมูลได้ทุกตาราง (policy *_select_with_role ไม่เปลี่ยน)
