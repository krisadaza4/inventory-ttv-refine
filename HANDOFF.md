# Inventory TTV: Handoff

อัปเดตล่าสุด: 2026-09-29

อ่าน [CONTEXT.md](./CONTEXT.md), [design.md](./design.md), [Tasks.md](./Tasks.md) ก่อนเริ่มงาน

## สถานะ

- **เฟส 1 (ตั้งโปรเจกต์):** เสร็จ
- **เฟส 2 (ฐานข้อมูล):** เสร็จ รัน `supabase/schema.sql` ใน Supabase แล้ว มีบัญชี admin 1 + staff 1 พร้อม `profiles` และ `supabase/rls_check.sql` ผ่านทั้ง 25 ข้อ
- **เฟส 3 (ตรรกะ):** T3.1 (`3598f29`), T3.2 (`3418ed6`) commit แล้ว; T3.3 เสร็จ (`validateProduct`, `validateMovement` คืน `{ ชื่อช่อง: ข้อความไทย }` ว่าง = ผ่าน, ยังใช้ `'admin'` ตรง ๆ รอ T3.5 เปลี่ยนเป็น `canAdjust`) เทสต์รวม 56 ข้อผ่าน ยังไม่ได้ commit

## งานถัดไป

1. commit T3.3 (`src/lib/stockRules*.js`, `Tasks.md`, `HANDOFF.md`) ผ่าน git-manager
2. T3.4 `searchProducts`, `filterByCategory` ใน `stockRules.js` (เขียนเทสต์ก่อน)
3. push ขึ้น GitHub เมื่อผู้ใช้สั่ง (ตอนนี้ `main` นำหน้า `origin/main`)

## Git

- repo private `nutcharat123/inventory-ttv` branch `main`
- commit ล่าสุด: `26c7410` (docs/reference), `3418ed6` (T3.2), `3598f29` (T3.1)
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
