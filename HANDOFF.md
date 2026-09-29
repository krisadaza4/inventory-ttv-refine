# Inventory TTV: Handoff

อัปเดตล่าสุด: 2026-09-29

อ่าน [CONTEXT.md](./CONTEXT.md), [design.md](./design.md), [Tasks.md](./Tasks.md) ก่อนเริ่มงาน

## สถานะ

- **เฟส 1 (ตั้งโปรเจกต์):** เสร็จ
- **เฟส 2 (ฐานข้อมูล):** เสร็จ รัน `supabase/schema.sql` ใน Supabase แล้ว มีบัญชี admin 1 + staff 1 พร้อม `profiles` และ `supabase/rls_check.sql` ผ่านทั้ง 25 ข้อ
- **เฟส 3 (ตรรกะ):** เสร็จและ push แล้ว (ล่าสุด `dfd8026`) เทสต์ 122 ข้อผ่าน
- **เฟส 4 (UI):** หน้าตาตาม `docs/mockup.html` (commit `6e67fb1`) T4.1 เสร็จ (`src/index.css`, `App.jsx`, `components/LoginForm`, `TitleBar` (+`ThemeToggle`), `StatusBar`, `AppShell`) build/lint ผ่าน ผู้ใช้สั่ง commit แล้ว แต่ยังไม่ได้ยืนยันผลทดสอบเข้าสู่ระบบจริง (admin/staff, โหมดมืด, รีเฟรช, รหัสผิด) ให้ถามอีกครั้งตอนทำ T4.2
- **ยังไม่ได้ทดสอบกับ Supabase จริง:** `MOVEMENT_COLUMNS` ใช้ embed `product:products(...)` และ `recorder:profiles(display_name)` ผ่าน FK `product_id`/`created_by` ต้องลองจริงตอน T4.5 ส่วน `getMyProfile(userId)` รับ id จาก session (ใช้ `maybeSingle` ไม่มี profile ได้ `null`)

## งานถัดไป

1. ยืนยันกับผู้ใช้ว่าทดสอบ T4.1 ผ่าน (ดูข้อสถานะเฟส 4)
2. T4.2 `Sidebar` เมนูตามบทบาท (มือถือเป็นแถบล่าง)
3. push ขึ้น GitHub เมื่อผู้ใช้สั่ง

## Git

- repo private `nutcharat123/inventory-ttv` branch `main`
- commit ล่าสุด: `6e67fb1` (mockup/design), `dfd8026` (T3.7, push แล้ว)
- งาน git ทำผ่าน agent git-manager เท่านั้น

## สิ่งที่ต้องรู้

- **env:** `.env.local` ใช้ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` (ไม่ใช่ ANON_KEY) ห้ามแสดงค่าในแชท ตรวจคีย์ด้วย prefix เท่านั้น (`sb_publishable_` ถูก, `sb_secret_` ห้ามใช้)
- **ปิดสมัครเอง:** `disable_signup = true` ตรวจแล้วผ่าน `/auth/v1/settings`
- **ชื่อฟังก์ชัน:** `current_app_role()` แทน `current_role()` เพราะ `current_role` เป็นคำสงวนของ Postgres (แก้ design.md แล้ว)
- **ห้ามวันในอนาคต:** ตรวจใน `record_movement` ไม่ใช่ check constraint
- **ข้อผิดพลาดจาก `record_movement`:** ข้อความไทย + รหัสใน `hint` ให้ `supabaseErrors.js` (T3.6) ใช้แยกกรณี: `no_profile`, `invalid_type`, `adjust_admin_only`, `invalid_quantity`, `future_date`, `adjust_needs_note`, `product_not_found`, `product_inactive`, `insufficient_stock` ส่วน SKU/บาร์โค้ดซ้ำเป็น SQLSTATE `23505` และไม่มีสิทธิ์เป็น `42501`
- **`products`:** grant insert/update เฉพาะคอลัมน์ `sku, barcode, name, category, unit, reorder_point, active` (`repositories.js` ต้องไม่ส่ง `id`, `created_at`, `updated_at`)
- **`rls_check.sql`:** รันซ้ำได้ ข้อมูลทดสอบย้อนกลับหมด Supabase จะถามเรื่อง RLS ของตารางชั่วคราว ให้กด "Run without RLS"
- **Supabase MCP:** ยังไม่ได้เพิ่ม ถ้าจะเพิ่มให้จำกัดด้วย `project_ref` ของโปรเจกต์นี้
- **หน้าตา UI:** ใช้แบบโปรแกรมโทนกรมท่าตาม `docs/mockup.html` (ตกลง 2026-09-29) ไม่ใช้สไตล์ Borrow Buddy แล้ว ส่วน `docs/reference/` ใช้ดูแค่ตรรกะ (session, supabase client/errors) ไม่ใช่สี/CSS
