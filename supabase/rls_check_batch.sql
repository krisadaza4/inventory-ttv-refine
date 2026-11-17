-- Inventory TTV: ตรวจ record_movements (บันทึกหลายรายการทั้งใบ) หลังรัน migration_batch_issue.sql
-- รันใน Supabase SQL Editor ทั้งไฟล์ ข้อมูลทดสอบทั้งหมดถูกย้อนกลับ ไม่เหลือในฐานข้อมูล
-- ต้องมี profile admin และ staff อย่างละ 1 แถวก่อน (store_qc / manager ทดสอบโดยเปลี่ยนบทบาทของบัญชี staff ชั่วคราวในบล็อกที่ย้อนกลับ)
-- ผลลัพธ์: ทุกแถวใน rls_results ต้องได้ pass = true (ผลสรุป passed = total)

create temp table if not exists rls_results (n int, test text, expected text, actual text, pass boolean);
truncate rls_results;

do $$
declare
  v_admin  uuid := (select id from public.profiles where role = 'admin' limit 1);
  v_staff  uuid := (select id from public.profiles where role = 'staff' limit 1);
  v_tests  text[][];
  v_actuals text[] := '{}';
  v_actual text;
  v_rc     bigint;
  v_state  text;
  v_hint   text;
  i        int;
begin
  v_tests := array[
    ['staff เบิกหลายรายการได้ทั้งใบ', 'staff',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 2, 'note', 'ออนไลน์'), jsonb_build_object('product_id', c.id, 'type', 'out', 'quantity', 1, 'note', 'ขายส่ง')) from public.products a, public.products c where a.sku = 'RLS-TEST-A' and c.sku = 'RLS-TEST-C'))$t$, 'ok rows=1'],
    ['ยอดเปลี่ยนทั้งสองรายการ (A=3, C=2)', 'staff',
      $t$select 1 where (select on_hand from public.product_stock where sku = 'RLS-TEST-A') = 3 and (select on_hand from public.product_stock where sku = 'RLS-TEST-C') = 2$t$, 'ok rows=1'],
    ['บันทึกหมายเหตุตามรายการ', 'staff',
      $t$select 1 from public.stock_movements m join public.products p on p.id = m.product_id where p.sku = 'RLS-TEST-C' and m.type = 'out' and m.note = 'ขายส่ง'$t$, 'ok rows=1'],
    ['รายการที่ 2 ไม่พอ ย้อนกลับทั้งใบ', 'staff',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1), jsonb_build_object('product_id', c.id, 'type', 'out', 'quantity', 99)) from public.products a, public.products c where a.sku = 'RLS-TEST-A' and c.sku = 'RLS-TEST-C'))$t$, '%insufficient_stock'],
    ['ใบที่ล้มเหลวไม่เหลือรายการแรก (A ยังเป็น 3)', 'staff',
      $t$select 1 where (select on_hand from public.product_stock where sku = 'RLS-TEST-A') = 3$t$, 'ok rows=1'],
    ['สินค้าเดียวกันซ้ำในใบ นับต่อเนื่อง ไม่พอไม่ได้', 'staff',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1), jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 99)) from public.products a where a.sku = 'RLS-TEST-A'))$t$, '%insufficient_stock'],
    ['manager เบิกหลายรายการไม่ได้', 'manager',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1)) from public.products a where a.sku = 'RLS-TEST-A'))$t$, '%read_only_role'],
    ['staff ปรับยอดผ่านชุดไม่ได้', 'staff',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'adjust', 'quantity', 1, 'note', 'x')) from public.products a where a.sku = 'RLS-TEST-A'))$t$, '%adjust_admin_only'],
    ['store_qc เบิกหลายรายการได้', 'store_qc',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1, 'note', 'ออนไลน์')) from public.products a where a.sku = 'RLS-TEST-A'))$t$, 'ok rows=1'],
    ['ชุดว่างไม่ได้', 'staff',
      $t$select public.record_movements('[]'::jsonb)$t$, '%empty_batch'],
    ['ไม่ใช่อาร์เรย์ไม่ได้', 'staff',
      $t$select public.record_movements('{"a":1}'::jsonb)$t$, '%empty_batch'],
    ['เกิน 200 รายการไม่ได้', 'staff',
      $t$select public.record_movements((select jsonb_agg(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1)) from public.products a, generate_series(1, 201) where a.sku = 'RLS-TEST-A'))$t$, '%too_many_items'],
    ['วันในอนาคตไม่ได้', 'staff',
      $t$select public.record_movements((select jsonb_build_array(jsonb_build_object('product_id', a.id, 'type', 'out', 'quantity', 1)) from public.products a where a.sku = 'RLS-TEST-A'), current_date + 2)$t$, '%future_date']
  ];

  begin
    insert into public.products (sku, name, category, unit) values ('RLS-TEST-A', 'ทดสอบ A', 'ทดสอบ', 'ชิ้น');
    insert into public.products (sku, name, category, unit) values ('RLS-TEST-C', 'ทดสอบ C', 'ทดสอบ', 'ชิ้น');
    insert into public.stock_movements (product_id, type, quantity, created_by)
      select id, 'in', 5, v_admin from public.products where sku = 'RLS-TEST-A';
    insert into public.stock_movements (product_id, type, quantity, created_by)
      select id, 'in', 3, v_admin from public.products where sku = 'RLS-TEST-C';

    for i in 1 .. array_length(v_tests, 1) loop
      update public.profiles
        set role = case when v_tests[i][2] in ('store_qc', 'manager', 'marketing') then v_tests[i][2] else 'staff' end
        where id = v_staff;
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
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

select count(*) as total, count(*) filter (where pass) as passed from rls_results;
select n, test, expected, actual from rls_results where not pass order by n;
