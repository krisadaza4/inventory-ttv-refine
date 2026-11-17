-- Inventory TTV: บันทึกหลายรายการในครั้งเดียวแบบ "ทั้งใบหรือไม่เอาเลย" (2026-11-17)
-- ใช้กับหน้าต่าง "เบิกออกหลายรายการ" รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง ไม่แตะข้อมูลเดิม
--
-- record_movements เรียก record_movement ทีละรายการภายใน transaction เดียว กติกาทุกข้อ (บทบาท คงเหลือ วันที่ ฯลฯ)
-- จึงเหมือนบันทึกทีละรายการทุกอย่าง ถ้ารายการใดไม่ผ่านจะย้อนกลับทั้งใบ ไม่เหลือรายการที่บันทึกไปครึ่งเดียว
-- p_items = [{ "product_id": uuid, "type": "out", "quantity": 2, "note": "ขายส่ง" }, ...] (type ใช้ได้ทุกประเภทที่บทบาทนั้นบันทึกได้)
-- คืนจำนวนรายการที่บันทึก ข้อผิดพลาดขึ้นต้นด้วย "รายการที่ N: " และคง hint เดิมของ record_movement

create or replace function public.record_movements(
  p_items         jsonb,
  p_movement_date date default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item  jsonb;
  v_i     integer := 0;
  v_state text;
  v_hint  text;
  v_msg   text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ไม่มีรายการที่จะบันทึก' using hint = 'empty_batch';
  end if;

  if jsonb_array_length(p_items) > 200 then
    raise exception 'บันทึกครั้งเดียวได้ไม่เกิน 200 รายการ' using hint = 'too_many_items';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_i := v_i + 1;
    begin
      perform public.record_movement(
        (v_item ->> 'product_id')::uuid,
        v_item ->> 'type',
        (v_item ->> 'quantity')::numeric,
        p_movement_date,
        nullif(v_item ->> 'note', ''),
        null
      );
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_hint = pg_exception_hint, v_msg = message_text;
      raise exception 'รายการที่ %: %', v_i, v_msg
        using errcode = v_state, hint = coalesce(nullif(v_hint, ''), 'batch_item_failed');
    end;
  end loop;

  return v_i;
end;
$$;

revoke all on function public.record_movements(jsonb, date) from public, anon;
grant execute on function public.record_movements(jsonb, date) to authenticated;
