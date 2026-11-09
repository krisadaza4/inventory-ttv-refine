-- เพิ่มผู้ใช้ใหม่ (เจ้าของร้านทำเอง ไม่มีใครเก็บรหัสผ่านไว้ในไฟล์นี้หรือในโค้ด)
-- รันใน Supabase SQL Editor ได้ซ้ำโดยไม่พัง (มีแล้วจะอัปเดตชื่อ/บทบาททับ)
--
-- ขั้นที่ 1: Supabase Dashboard → Authentication → Users → Add user → Create new user
--           ใส่อีเมล + รหัสผ่าน และติ๊ก "Auto Confirm User"
--           (ปิดสมัครเองไว้แล้ว จึงสร้างบัญชีได้ที่นี่ที่เดียว)
-- ขั้นที่ 2: แก้ 3 ค่าด้านล่าง แล้วรันส่วน "เพิ่มโปรไฟล์"
-- ขั้นที่ 3: รันส่วน "ตรวจผล" ต้องเห็นแถวของผู้ใช้ใหม่
-- ขั้นที่ 4: ให้ผู้ใช้เข้าสู่ระบบทดสอบ และเปลี่ยนรหัสผ่านตามที่ตกลงกัน
--
-- บทบาทที่ใช้ได้ตอนนี้: 'admin' (เจ้าของร้าน) และ 'staff' (พนักงาน รับเข้า/เบิกออก/ส่งซ่อม)
-- บทบาทของแผนกอื่น (Store / QC / Marketing / Manager) ยังไม่มีในฐานข้อมูล
-- ต้องเพิ่มบทบาทก่อน (profiles_role_valid + record_movement + RLS) ดูแผนใน HANDOFF.md

-- เพิ่มโปรไฟล์ ------------------------------------------------------------
insert into public.profiles (id, display_name, role)
select id, 'ชื่อที่แสดง', 'staff'
from auth.users
where email = 'ใส่อีเมลที่สร้างใน Dashboard'
on conflict (id) do update
  set display_name = excluded.display_name,
      role         = excluded.role;

-- ตรวจผล: ทุกบัญชีและบทบาท -------------------------------------------------
select p.display_name, p.role, u.email, u.last_sign_in_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at;

-- บัญชีที่สร้างแล้วแต่ยังไม่มีโปรไฟล์ (เข้าสู่ระบบได้แต่ไม่เห็นข้อมูล) ----------
select u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
