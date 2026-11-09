-- เพิ่มผู้ใช้ใหม่ (เจ้าของร้านทำเอง ไม่มีใครเก็บรหัสผ่านไว้ในไฟล์นี้หรือในโค้ด)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง (มีแล้วจะอัปเดตชื่อ/บทบาททับ)
--
-- ขั้นที่ 1: Supabase Dashboard → Authentication → Users → Add user → Create new user
--           ใส่อีเมล + รหัสผ่าน และติ๊ก "Auto Confirm User" (ปิดสมัครเองไว้แล้ว จึงสร้างบัญชีได้ที่นี่ที่เดียว)
-- ขั้นที่ 2: รันส่วน "เพิ่มโปรไฟล์" (ใส่ได้ทีเดียวหลายบัญชี บัญชีที่ยังไม่ได้สร้างใน Dashboard จะถูกข้าม)
-- ขั้นที่ 3: รันส่วน "ตรวจผล" ต้องเห็นครบทุกบัญชี และส่วน "ยังไม่มีโปรไฟล์" ต้องไม่มีแถว
-- ขั้นที่ 4: ให้ผู้ใช้เข้าสู่ระบบทดสอบ (แอปจะบังคับเข้าสู่ระบบใหม่ทุก 12 ชั่วโมง)
--
-- บทบาท (ต้องรัน migration_roles.sql แล้ว ทำแล้วเมื่อ 2026-11-09):
--   admin      เจ้าของร้าน / Dev      ทำได้ทุกอย่าง
--   store_qc   Store/QC               ทำได้ทุกอย่างในแอป (เท่า admin)
--   staff      พนักงาน (บัญชีเดิม)    รับเข้า เบิกออก ส่งซ่อม ซ่อมเสร็จ
--   manager    Manager                ดูอย่างเดียว
--   marketing  Marketing              ดูอย่างเดียว

-- เพิ่มโปรไฟล์: แผนกละ 3 บัญชี ----------------------------------------------
insert into public.profiles (id, display_name, role)
select u.id, v.display_name, v.role
from (values
  ('storeqc01@ttv.com',   'StoreQC01',   'store_qc'),
  ('storeqc02@ttv.com',   'StoreQC02',   'store_qc'),
  ('storeqc03@ttv.com',   'StoreQC03',   'store_qc'),
  ('manager01@ttv.com',   'Manager01',   'manager'),
  ('manager02@ttv.com',   'Manager02',   'manager'),
  ('manager03@ttv.com',   'Manager03',   'manager'),
  ('marketing01@ttv.com', 'Marketing01', 'marketing'),
  ('marketing02@ttv.com', 'Marketing02', 'marketing'),
  ('marketing03@ttv.com', 'Marketing03', 'marketing')
) as v(email, display_name, role)
join auth.users u on lower(u.email) = v.email
on conflict (id) do update
  set display_name = excluded.display_name,
      role         = excluded.role;

-- ตรวจผล: ทุกบัญชีและบทบาท -------------------------------------------------
select p.display_name, p.role, u.email, u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.role, p.display_name;

-- บัญชีที่สร้างแล้วแต่ยังไม่มีโปรไฟล์ (เข้าสู่ระบบได้แต่ไม่เห็นข้อมูล) ----------
select u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
