-- Inventory TTV: ตรวจ RLS ตาม design.md ข้อ 9 (T2.6) + ประเภทรายการซ่อม (ส่งซ่อม / ซ่อมเสร็จ / ตัดจำหน่าย) + คลังย่อย
-- รันใน Supabase SQL Editor ทั้งไฟล์ ข้อมูลทดสอบทั้งหมดถูกย้อนกลับ ไม่เหลือในฐานข้อมูล
-- ต้องมี profile admin และ staff อย่างละ 1 แถวก่อน
-- ผลลัพธ์: ตาราง rls_results ทุกแถวต้องได้ pass = true

create temp table if not exists rls_results (
  n        int,
  test     text,
  expected text,
  actual   text,
  pass     boolean
);
truncate rls_results;

do $$
declare
  v_admin  uuid := (select id from public.profiles where role = 'admin' limit 1);
  v_staff  uuid := (select id from public.profiles where role = 'staff' limit 1);
  v_nobody uuid := gen_random_uuid();
  v_tests  text[][];
  v_actuals text[] := '{}';
  v_uid    uuid;
  v_actual text;
  v_rc     bigint;
  v_state  text;
  v_hint   text;
  i        int;
begin
  if v_admin is null or v_staff is null then
    raise exception 'ต้องมี profile admin และ staff อย่างละ 1 แถวก่อน';
  end if;

  -- [ชื่อการทดสอบ, ผู้ทดสอบ, SQL, ผลที่คาดหวัง (รูปแบบ LIKE)]
  v_tests := array[
    ['staff ดูสินค้าได้', 'staff',
      $t$select 1 from public.products where sku = 'RLS-TEST-A'$t$, 'ok rows=1'],
    ['staff ดู profiles ได้', 'staff',
      $t$select 1 from public.profiles limit 1$t$, 'ok rows=1'],
    ['staff เพิ่มสินค้าไม่ได้', 'staff',
      $t$insert into public.products (sku, name, category, unit) values ('RLS-TEST-S', 's', 's', 's')$t$, 'ERR 42501%'],
    ['staff แก้สินค้าไม่ได้ (0 แถว)', 'staff',
      $t$update public.products set name = 'x' where sku = 'RLS-TEST-A'$t$, 'ok rows=0'],
    ['staff ลบสินค้าไม่ได้', 'staff',
      $t$delete from public.products where sku = 'RLS-TEST-A'$t$, 'ERR 42501%'],
    ['staff insert ตรงเข้า stock_movements ไม่ได้', 'staff',
      $t$insert into public.stock_movements (product_id, type, quantity) select id, 'in', 1 from public.products where sku = 'RLS-TEST-A'$t$, 'ERR 42501%'],
    ['staff แก้ stock_movements ไม่ได้', 'staff',
      $t$update public.stock_movements set quantity = 99$t$, 'ERR 42501%'],
    ['staff ลบ stock_movements ไม่ได้', 'staff',
      $t$delete from public.stock_movements$t$, 'ERR 42501%'],
    ['staff แก้ profiles ไม่ได้', 'staff',
      $t$update public.profiles set role = 'admin'$t$, 'ERR 42501%'],
    ['staff รับเข้า 2', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'in', 2)$t$, 'ok rows=1'],
    ['product_stock คงเหลือ = 7', 'staff',
      $t$select 1 from public.product_stock where sku = 'RLS-TEST-A' and on_hand = 7$t$, 'ok rows=1'],
    ['staff เบิกเกินคงเหลือไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'out', 100)$t$, '%insufficient_stock'],
    ['staff เบิกจนเหลือ 0 ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'out', 7)$t$, 'ok rows=1'],
    ['staff ปรับยอดไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'adjust', 1, null, 'x')$t$, '%adjust_admin_only'],
    ['staff รับเข้าสินค้าที่ปิดใช้งานไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-B'), 'in', 1)$t$, '%product_inactive'],
    ['วันในอนาคตไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'in', 1, current_date + 2)$t$, '%future_date'],
    ['ทศนิยมเกิน 2 ตำแหน่งไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'in', 1.234)$t$, '%invalid_quantity'],
    ['admin เพิ่มสินค้าได้', 'admin',
      $t$insert into public.products (sku, name, category, unit) values ('RLS-TEST-C', 'ทดสอบ C', 'ทดสอบ', 'ชิ้น')$t$, 'ok rows=1'],
    ['SKU ซ้ำไม่ได้', 'admin',
      $t$insert into public.products (sku, name, category, unit) values ('RLS-TEST-A', 'ซ้ำ', 'ทดสอบ', 'ชิ้น')$t$, 'ERR 23505%'],
    ['admin แก้สินค้าได้', 'admin',
      $t$update public.products set reorder_point = 3 where sku = 'RLS-TEST-A'$t$, 'ok rows=1'],
    ['admin ปรับยอดไม่มีหมายเหตุไม่ได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'adjust', 3)$t$, '%adjust_needs_note'],
    ['admin ปรับยอดพร้อมหมายเหตุได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'adjust', 3, null, 'นับสต็อก')$t$, 'ok rows=1'],
    ['admin ลบสินค้าไม่ได้', 'admin',
      $t$delete from public.products where sku = 'RLS-TEST-A'$t$, 'ERR 42501%'],
    ['ผู้ไม่มี profile ไม่เห็นสินค้า', 'nobody',
      $t$select 1 from public.products$t$, 'ok rows=0'],
    ['ผู้ไม่มี profile บันทึกไม่ได้', 'nobody',
      $t$select public.record_movement(gen_random_uuid(), 'in', 1)$t$, '%no_profile'],
    -- สินค้ารอซ่อม (migration_repair.sql) ตอนนี้ RLS-TEST-A ของดี 3 รอซ่อม 0
    ['ส่งซ่อมไม่มีเหตุผลไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'to_repair', 1)$t$, '%needs_note'],
    ['ส่งซ่อมเกินของดีไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'to_repair', 10, null, 'สปาร์คเสีย')$t$, '%insufficient_stock'],
    ['staff ส่งซ่อม 2 ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'to_repair', 2, null, 'สปาร์คเสีย')$t$, 'ok rows=1'],
    ['product_stock ของดี 1 รอซ่อม 2', 'staff',
      $t$select 1 from public.product_stock where sku = 'RLS-TEST-A' and on_hand = 1 and repair_qty = 2$t$, 'ok rows=1'],
    ['ซ่อมเสร็จไม่มีเหตุผลไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'repaired', 1)$t$, '%needs_note'],
    ['ซ่อมเสร็จเกินรอซ่อมไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'repaired', 5, null, 'ซ่อมแล้ว')$t$, '%insufficient_repair'],
    ['staff ซ่อมเสร็จ 1 ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'repaired', 1, null, 'ซ่อมแล้ว')$t$, 'ok rows=1'],
    ['staff ตัดจำหน่ายไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'write_off', 1, null, 'ซ่อมไม่ได้')$t$, '%write_off_admin_only'],
    ['ตัดจำหน่ายไม่มีเหตุผลไม่ได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'write_off', 1)$t$, '%needs_note'],
    ['ตัดจำหน่ายเกินรอซ่อมไม่ได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'write_off', 5, null, 'ซ่อมไม่ได้')$t$, '%insufficient_repair'],
    ['admin ตัดจำหน่าย 1 ได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'write_off', 1, null, 'ซ่อมไม่ได้')$t$, 'ok rows=1'],
    ['product_stock ของดี 2 รอซ่อม 0', 'staff',
      $t$select 1 from public.product_stock where sku = 'RLS-TEST-A' and on_hand = 2 and repair_qty = 0$t$, 'ok rows=1'],
    ['ประเภทรายการที่ไม่มีไม่ได้', 'admin',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'lost', 1, null, 'x')$t$, '%invalid_type'],
    -- คลังย่อย (migration_warehouses.sql) ตอนนี้ RLS-TEST-A ของดี 2 อยู่คลังใหญ่ทั้งหมด
    ['โอนไม่ระบุคลังไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'transfer_in', 1, null, null, null)$t$, '%warehouse_required'],
    ['รับเข้าระบุคลังย่อยไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'in', 1, null, null, (select id from public.warehouses where name = 'Online'))$t$, '%warehouse_not_allowed'],
    ['โอนเข้าเกินคลังใหญ่ไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'transfer_in', 10, null, null, (select id from public.warehouses where name = 'Online'))$t$, '%insufficient_stock'],
    ['staff โอนเข้า Online 2 ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'transfer_in', 2, null, null, (select id from public.warehouses where name = 'Online'))$t$, 'ok rows=1'],
    ['product_stock รวม 2 คลังย่อย 2', 'staff',
      $t$select 1 from public.product_stock where sku = 'RLS-TEST-A' and on_hand = 2 and sub_qty = 2$t$, 'ok rows=1'],
    ['โอนเข้าแล้วสินค้าอยู่ในคลัง Online', 'staff',
      $t$select 1 from public.product_warehouses pw join public.warehouses w on w.id = pw.warehouse_id join public.products p on p.id = pw.product_id where p.sku = 'RLS-TEST-A' and w.name = 'Online'$t$, 'ok rows=1'],
    ['เบิกจากคลังใหญ่ที่เหลือ 0 ไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'out', 1)$t$, '%insufficient_stock'],
    ['staff รับเข้าคลังใหญ่ 3', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'in', 3)$t$, 'ok rows=1'],
    ['ขายส่งเห็นของ Online ไม่ได้: ขาย 4 ไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'out', 4, null, null, (select id from public.warehouses where name = 'ขายส่ง'))$t$, '%insufficient_stock'],
    ['ขายผ่าน Online 4 ได้ (ตัดคลังย่อย 2 + คลังใหญ่ 2)', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'out', 4, null, null, (select id from public.warehouses where name = 'Online'))$t$, 'ok rows=1'],
    ['บันทึกส่วนที่ตัดจากคลังย่อย = 2', 'staff',
      $t$select 1 from public.stock_movements m join public.products p on p.id = m.product_id where p.sku = 'RLS-TEST-A' and m.type = 'out' and m.warehouse_qty = 2$t$, 'ok rows=1'],
    ['product_stock รวม 1 คลังย่อย 0', 'staff',
      $t$select 1 from public.product_stock where sku = 'RLS-TEST-A' and on_hand = 1 and sub_qty = 0$t$, 'ok rows=1'],
    ['โอนกลับเกินคลังย่อยไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'transfer_out', 1, null, null, (select id from public.warehouses where name = 'Online'))$t$, '%insufficient_warehouse'],
    ['ส่งซ่อมระบุคลังย่อยไม่ได้', 'staff',
      $t$select public.record_movement((select id from public.products where sku = 'RLS-TEST-A'), 'to_repair', 1, null, 'x', (select id from public.warehouses where name = 'Online'))$t$, '%warehouse_not_allowed'],
    ['staff เพิ่มคลังไม่ได้', 'staff',
      $t$insert into public.warehouses (name) values ('RLS-คลัง-S')$t$, 'ERR 42501%'],
    ['staff ผูกสินค้ากับคลังไม่ได้', 'staff',
      $t$insert into public.product_warehouses (product_id, warehouse_id) select p.id, w.id from public.products p, public.warehouses w where p.sku = 'RLS-TEST-A' and w.name = 'ขายส่ง'$t$, 'ERR 42501%'],
    ['staff เอาสินค้าออกจากคลังไม่ได้ (0 แถว)', 'staff',
      $t$delete from public.product_warehouses where product_id = (select id from public.products where sku = 'RLS-TEST-A')$t$, 'ok rows=0'],
    ['admin เพิ่มคลังได้', 'admin',
      $t$insert into public.warehouses (name, sort_order) values ('RLS-คลัง-A', 99)$t$, 'ok rows=1'],
    ['admin ผูกสินค้ากับคลังได้', 'admin',
      $t$insert into public.product_warehouses (product_id, warehouse_id) select p.id, w.id from public.products p, public.warehouses w where p.sku = 'RLS-TEST-A' and w.name = 'ขายส่ง'$t$, 'ok rows=1'],
    ['admin เอาสินค้าออกจากคลังได้', 'admin',
      $t$delete from public.product_warehouses where product_id = (select id from public.products where sku = 'RLS-TEST-A')$t$, 'ok rows=2'],
    ['admin ลบคลังไม่ได้', 'admin',
      $t$delete from public.warehouses where name = 'RLS-คลัง-A'$t$, 'ERR 42501%']
  ];

  -- ทุกอย่างในบล็อกนี้ถูกย้อนกลับตอนจบด้วย exception P0999
  begin
    insert into public.products (sku, name, category, unit, reorder_point)
      values ('RLS-TEST-A', 'ทดสอบ A', 'ทดสอบ', 'ชิ้น', 1);
    insert into public.products (sku, name, category, unit, active)
      values ('RLS-TEST-B', 'ทดสอบ B', 'ทดสอบ', 'ชิ้น', false);
    insert into public.stock_movements (product_id, type, quantity, created_by)
      select id, 'in', 5, v_admin from public.products where sku = 'RLS-TEST-A';

    for i in 1 .. array_length(v_tests, 1) loop
      v_uid := case v_tests[i][2]
        when 'admin' then v_admin
        when 'staff' then v_staff
        else v_nobody
      end;

      begin
        perform set_config('request.jwt.claims',
          json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
        set local role authenticated;
        execute v_tests[i][3];
        get diagnostics v_rc = row_count;
        v_actual := 'ok rows=' || v_rc;
        reset role;
      exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_hint = pg_exception_hint;
        v_actual := 'ERR ' || v_state || coalesce(' ' || nullif(v_hint, ''), '');
      end;
      reset role;

      v_actuals := v_actuals || v_actual;
    end loop;

    raise exception using errcode = 'P0999', message = 'rollback test data';
  exception when sqlstate 'P0999' then
    null;
  end;

  insert into rls_results (n, test, expected, actual, pass)
  select g.k, v_tests[g.k][1], v_tests[g.k][4], v_actuals[g.k], v_actuals[g.k] like v_tests[g.k][4]
  from generate_series(1, array_length(v_tests, 1)) as g(k);
end;
$$;

select n, pass, test, expected, actual from rls_results order by n;
