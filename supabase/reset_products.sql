-- ล้างสินค้าและประวัติการเคลื่อนไหวทั้งหมด เพื่อเริ่มใหม่จากไฟล์สต็อก (รันใน Supabase SQL Editor)
-- !! ย้อนกลับไม่ได้: ส่งออก Excel เก็บไว้ก่อนรัน !!
-- ไม่แตะบัญชีผู้ใช้ (auth.users / profiles)
-- รูปใน bucket product-images ไม่ถูกลบด้วย SQL นี้ (ถ้ามี ลบใน Storage ของ Dashboard)

begin;

delete from public.stock_movements;
delete from public.products;

commit;

-- ตรวจผล: ควรได้ 0 ทั้งสองแถว
select 'products' as table_name, count(*) from public.products
union all
select 'stock_movements', count(*) from public.stock_movements;
