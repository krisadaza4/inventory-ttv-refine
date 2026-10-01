-- ยอดขายเฉลี่ยต่อเดือน (ค่าจากไฟล์สต็อกของร้าน) รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้
-- null = ไม่มีข้อมูล ค่าเปลี่ยนเมื่อนำเข้าไฟล์สต็อกใหม่เท่านั้น

alter table public.products add column if not exists avg_monthly_sales numeric(12, 2);

grant insert (avg_monthly_sales) on public.products to authenticated;
grant update (avg_monthly_sales) on public.products to authenticated;

-- view เดิม + avg_monthly_sales ต่อท้าย (create or replace view เพิ่มคอลัมน์ได้เฉพาะท้ายสุด)
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
  p.location,
  p.avg_monthly_sales
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

grant select on public.product_stock to authenticated;

-- ตรวจผล: ควรได้ 1 แถว avg_monthly_sales | numeric
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'product_stock' and column_name = 'avg_monthly_sales';
