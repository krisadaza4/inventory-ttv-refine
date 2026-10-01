-- โลเคชั่นสินค้า (ที่เก็บในร้าน เช่น "แลค A4") รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้
-- ไม่บังคับกรอก (null = ไม่ระบุ)

alter table public.products add column if not exists location text;

grant insert (location) on public.products to authenticated;
grant update (location) on public.products to authenticated;

-- view เดิม + location ต่อท้าย (create or replace view เพิ่มคอลัมน์ได้เฉพาะท้ายสุด)
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

grant select on public.product_stock to authenticated;

-- ตรวจผล: ควรได้ 1 แถว location | text
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'product_stock' and column_name = 'location';
