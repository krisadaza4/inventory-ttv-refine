# Inventory TTV: Handoff

อัปเดตล่าสุด: 2026-09-29

อ่าน [CONTEXT.md](./CONTEXT.md), [design.md](./design.md), [Tasks.md](./Tasks.md) ก่อนเริ่มงาน

## สถานะ

- **เฟส 1 (ตั้งโปรเจกต์):** เสร็จ
- **เฟส 2 (ฐานข้อมูล):** เสร็จ รัน `supabase/schema.sql` ใน Supabase แล้ว มีบัญชี admin 1 + staff 1 พร้อม `profiles` และ `supabase/rls_check.sql` ผ่านทั้ง 25 ข้อ
- **เฟส 3 (ตรรกะ):** เสร็จ T3.1–T3.3 push แล้ว, T3.4 `415d62d`, T3.5 `457054f`, T3.6 `03966a1` commit แล้วยังไม่ push; T3.7 (`mappers.js`, `repositories.js`) เสร็จ ยังไม่ได้ commit เทสต์รวม 122 ข้อผ่าน, `npm run build` ผ่าน
- **ยังไม่ได้ทดสอบกับ Supabase จริง:** `MOVEMENT_COLUMNS` ใช้ embed `product:products(...)` และ `recorder:profiles(display_name)` ผ่าน FK `product_id`/`created_by` ต้องลองจริงตอน T4.5 ส่วน `getMyProfile(userId)` รับ id จาก session (ใช้ `maybeSingle` ไม่มี profile ได้ `null`)

## งานถัดไป

1. commit T3.7 (`src/lib/mappers*.js`, `src/lib/repositories*.js`, `Tasks.md`, `HANDOFF.md`) ผ่าน git-manager
2. เฟส 4 เริ่ม T4.1 `LoginForm`, `AppHeader`, `ThemeToggle`, session และกรณีไม่มี profile (ดูแนวทางใน `docs/reference/`)
3. push ขึ้น GitHub เมื่อผู้ใช้สั่ง

## Git

- repo private `nutcharat123/inventory-ttv` branch `main`
- commit ล่าสุด: `03966a1` (T3.6), `457054f` (T3.5), `415d62d` (T3.4)
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
- **Borrow Buddy:** เลิกใช้แล้ว (2026-09-29) ไฟล์ตัวอย่าง UI/Supabase ที่ต้องใช้อ้างอิงคัดลอกไว้ที่ `docs/reference/` (ไม่ build, oxlint ข้าม) ห้ามพึ่งโฟลเดอร์ `borrow-buddy-samit`
