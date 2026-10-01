-- รหัสเดิมของสินค้า (ก่อนแก้ชื่อ 2026-10-01) ให้นำเข้าไฟล์สต็อกที่ยังใช้รหัสเดิมได้ (รันใน Supabase SQL Editor รันซ้ำได้)
-- ตัวนำเข้าจับคู่รหัสในไฟล์กับ sku หรือ legacy_sku

alter table public.products add column if not exists legacy_sku text;
grant insert (legacy_sku) on public.products to authenticated;
grant update (legacy_sku) on public.products to authenticated;

-- view เดิม + legacy_sku ต่อท้าย
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
  p.legacy_sku
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

grant select on public.product_stock to authenticated;

-- ใส่รหัสเดิมของ 56 รายการที่แก้ชื่อไปแล้ว (เฉพาะที่ยังว่าง)
with changes (old_sku, new_sku) as (values
  ('GL-101 R', 'GL-101R'),
  ('GL-702 I', 'GL-702I'),
  ('WX102 ใหม่ เปลี่ยนสปาร์คแล้ว', 'WX102'),
  ('WX102 S คิวแล้ว', 'WX102S'),
  ('WX104 มีแผงกั้น', 'WX104'),
  ('WX104 S มีแผงกั้น', 'WX104S'),
  ('WX106 มีแผงกั้น', 'WX106'),
  ('WX106 S มีแผงกั้น', 'WX106S'),
  ('WX108 S', 'WX108S'),
  ('SK60 คิวแล้ว', 'SK60'),
  ('ZL71 หัวI', 'ZL71'),
  ('ZL72 หัว I', 'ZL72'),
  ('ZL701/3 หัว I', 'ZL701/3'),
  ('ZL702/3 หัว I', 'ZL702/3'),
  ('ZL718 หัวI', 'ZL718'),
  ('GH028 หัว I', 'GH028'),
  ('GH056 หัว I', 'GH056'),
  ('BLR-02 -N', 'BLR-02-N'),
  ('BLR-08 -L', 'BLR-08-L'),
  ('VC-201 เปลี่ยนมอเตอร์แล้ว', 'VC-201'),
  ('GC-201-NP*ไม่มีที่พักเท้า', 'GC-201-NP'),
  ('RP-25G*', 'RP-25G'),
  ('RP-25*', 'RP-25'),
  ('VG KB7', 'VGKB7'),
  ('VG KB10', 'VGKB10'),
  ('VS KB5', 'VSKB5'),
  ('VAKB5คุณก้อย', 'VAKB5-คุณก้อย'),
  ('VA C30', 'VAC30'),
  ('VA C40', 'VAC40'),
  ('VHP-103A หัวเร่ง', 'VHP-103A'),
  ('VLP-889A หัวปรับ', 'VLP-889A'),
  ('VLP-889C * หัวปรับ+เซฟตี้', 'VLP-889C'),
  ('VLP-889D* หัวปรับ+เซฟตี้+เกจวัด', 'VLP-889D'),
  ('LGT001-P1สายแก๊สเส้น+กิ๊บรัด', 'LGT001-P1'),
  ('LGT002 สายแก๊สม้วนของนอก', 'LGT002'),
  ('LGT010 กิ๊บรัด', 'LGT010'),
  ('VHB001 ปืนจุดแก๊ส', 'VHB001'),
  ('LGW001 สามทางซิงค์', 'LGW001'),
  ('LTP001 โครงปิคนิคเขียว', 'LTP001'),
  ('LTP003 ฝักบัว', 'LTP003'),
  ('LTP004 โครงปิคนิคเหล็กเส้น', 'LTP004'),
  ('LTP006 ข้อต่อแก๊สปิคนิค', 'LTP006'),
  ('LTP008 สามทางใหญ่', 'LTP008'),
  ('LCH001 (KBกลมสูง)', 'LCH001'),
  ('KB3+VAB ออนไลน์', 'KB3+VAB'),
  ('KB4+VAB ออนไลน์', 'KB4+VAB'),
  ('KB5A02+VAB ออนไลน์', 'KB5A02+VAB'),
  ('KB5A02-VAB-P1* ออนไลน์', 'KB5A02-VAB-P1'),
  ('KB7A+VAB ออนไลน์', 'KB7A+VAB'),
  ('KB8A+VAB+ฝาปรับลม ออนไลน์', 'KB8A+VAB+ฝาปรับลม'),
  ('KB10+VAB ออนไลน์', 'KB10+VAB'),
  ('IKB10+VAB * ออนไลน์', 'IKB10+VAB'),
  ('C30+VAB ออนไลน์', 'C30+VAB'),
  ('IC30A+VAB ออนไลน์', 'IC30A+VAB'),
  ('C40+VAB ออนไลน์', 'C40+VAB'),
  ('IC40A+VAB ออนไลน์', 'IC40A+VAB')
)
update public.products p
set legacy_sku = c.old_sku
from changes c
where p.sku = c.new_sku and p.legacy_sku is null;

-- ตรวจผล: ควรได้ 56
select count(*) as with_legacy_sku from public.products where legacy_sku is not null;
