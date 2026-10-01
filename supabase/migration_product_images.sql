-- เฟส 7: รูปสินค้า (รันใน Supabase SQL Editor ครั้งเดียว รันซ้ำได้)
-- 1 รูปต่อสินค้า, เพิ่ม/เปลี่ยน/ลบรูปได้เฉพาะ admin, ดูได้เฉพาะผู้ที่มี profile (bucket ส่วนตัว ใช้ signed URL)

-- 1) ช่องเก็บที่อยู่ไฟล์รูปใน bucket (null = ไม่มีรูป) --------------------------
alter table public.products add column if not exists image_path text;

grant insert (image_path) on public.products to authenticated;
grant update (image_path) on public.products to authenticated;

-- view เดิม + image_path ต่อท้าย (create or replace view เพิ่มคอลัมน์ได้เฉพาะท้ายสุด)
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
  p.image_path
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

grant select on public.product_stock to authenticated;

-- 2) bucket ส่วนตัว: ไฟล์ละไม่เกิน 1MB (หน้าเว็บย่อรูปเหลือ ~100KB ก่อนอัปโหลด) --------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 1048576, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) สิทธิ์ไฟล์ใน bucket: ดู = มี profile, เพิ่ม/แก้/ลบ = admin ------------------
drop policy if exists "product_images_select_with_role" on storage.objects;
create policy "product_images_select_with_role"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-images' and (select public.current_app_role()) is not null);

drop policy if exists "product_images_insert_admin" on storage.objects;
create policy "product_images_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select public.current_app_role()) = 'admin');

drop policy if exists "product_images_update_admin" on storage.objects;
create policy "product_images_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select public.current_app_role()) = 'admin')
  with check (bucket_id = 'product-images' and (select public.current_app_role()) = 'admin');

drop policy if exists "product_images_delete_admin" on storage.objects;
create policy "product_images_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select public.current_app_role()) = 'admin');

-- ตรวจผล: ควรได้ 1 แถว bucket และ 4 นโยบาย
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'product-images';
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'product_images_%'
order by policyname;
