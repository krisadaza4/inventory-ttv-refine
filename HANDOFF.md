# Inventory TTV: Handoff

อัปเดตล่าสุด: 2026-09-29

อ่าน [CONTEXT.md](./CONTEXT.md), [design.md](./design.md), [Tasks.md](./Tasks.md) ก่อนเริ่มงาน

## สถานะ

- **เฟส 1 (ตั้งโปรเจกต์):** เสร็จ
- **เฟส 2 (ฐานข้อมูล):** เสร็จ รัน `supabase/schema.sql` ใน Supabase แล้ว มีบัญชี admin 1 + staff 1 พร้อม `profiles` และ `supabase/rls_check.sql` ผ่านทั้ง 25 ข้อ
- **เฟส 3 (ตรรกะ):** เสร็จและ push แล้ว (ล่าสุด `dfd8026`) เทสต์ 122 ข้อผ่าน
- **เฟส 4 (UI):** หน้าตาตาม `docs/mockup.html` (commit `6e67fb1`) T4.1 เสร็จ (`src/index.css`, `App.jsx`, `components/LoginForm`, `TitleBar` (+`ThemeToggle`), `StatusBar`, `AppShell`) build/lint ผ่าน ผู้ใช้สั่ง commit แล้ว แต่ยังไม่ได้ยืนยันผลทดสอบเข้าสู่ระบบจริง (admin/staff, โหมดมืด, รีเฟรช, รหัสผิด) (commit `840230f`); T4.2 เสร็จ (`lib/menu.js` + เทสต์, `Sidebar`, `PageHead` บนมือถือเป็นแถบล่าง, staff เปิดหน้าจัดการสินค้าไม่ได้) commit แล้ว; T4.3 เสร็จ (`ProductsPage`, `ProductTable`, `StockBadge`, `lib/numberFormat.js`, `countByStockStatus`, `listCategories` + เทสต์; `App.jsx` แยก `Workspace` โหลดสินค้าครั้งเดียวใช้ร่วมทุกหน้า) commit `8e44669`; T4.4 เสร็จ (`MovementPage`: ค้นหาเลือกสินค้า, radio ประเภทตามบทบาท, วันที่ `type=date` max วันนี้, แสดงคงเหลือก่อน→หลัง, ตรวจด้วย `validateMovement` แล้ว `recordMovement` สำเร็จแล้วโหลดสินค้าใหม่; `quantityAfter` + เทสต์) ยังไม่ได้ commit; T4.6 เสร็จก่อน T4.5 ตามที่ผู้ใช้ขอ (`ManagePage` ตาราง+ค้นหา+แสดงที่ปิดใช้งาน, `ProductForm` เพิ่ม/แก้ไข/ปิด-เปิดใช้งาน ตรวจด้วย `validateProduct`; `Workspace` โหลด `includeInactive: true` แล้วกรองเฉพาะที่เปิดใช้งานให้หน้าอื่น) เทสต์ 138 ข้อผ่าน T4.4+T4.6 ยังไม่ได้ commit; ผู้ใช้ทดลองกับ Supabase จริงแล้ว (2026-09-29): เพิ่มสินค้า และรับเข้า 10 สำเร็จ (ครั้งแรกบันทึกสินค้าไม่ได้ ไม่ทราบสาเหตุ น่าจะเป็นหน้าเก่าค้างจาก hot reload หายหลังรีเฟรช ถ้าเจออีกให้ดู Network/Console)
- **T4.4+T4.6 (`18a2db8`), T4.5 (`ccc1d1d`) commit แล้ว; T4.7 เสร็จ ยังไม่ได้ commit** (ตรวจ CSS: สีที่ fix ไว้อยู่บนแถบสีเข้มเสมอจึงใช้ได้ทั้งสองโหมด; มือถือ: ตัดชื่อยาวในแถบบน, เว้น safe-area ของ iPhone, ช่องกรอก 16px กัน iPhone ซูม, ปุ่มเล็กใหญ่ขึ้น; ภาพหน้าจอจาก Claude in Chrome timeout บ่อย จึงตรวจจริงบนมือถือใน T5.6) เดิม T4.5: (`HistoryPage`: กรองสินค้า (รวมที่ปิดใช้งาน)/ประเภท, ล่าสุดก่อน, โหลดเพิ่มทีละ 50, จำนวน +/− พร้อมหน่วย) ผู้ใช้ตรวจกับข้อมูลจริงแล้วผ่าน (ชื่อสินค้า/ผู้บันทึกขึ้นครบ embed ใช้ได้)

## งานถัดไป

1. เฟส 5: T5.1 ผ่าน (lint 0 เตือน, เทสต์ 10 ไฟล์ 138 ข้อ, build ผ่าน) และ T5.5 ผ่าน (ไม่มี `.env` ใน git นอกจาก `.env.example`, ไม่มี `sb_secret_` ยาว/JWT/service_role ในไฟล์และประวัติ git, `dist` มีแค่ publishable key ซึ่งตั้งใจให้เปิดเผยได้และ `dist` ถูก ignore) เหลือ T5.2–T5.4 ผู้ใช้ทดลอง และ T5.6 deploy Vercel (ไม่มี vercel CLI ใช้ Dashboard import จาก GitHub ใส่ env 2 ตัว)
2. push ขึ้น GitHub เมื่อผู้ใช้สั่ง
3. เฟส 6 (หลัง deploy): นำเข้า/ส่งออก Excel เพื่อใช้กับโปรแกรมบัญชี Express ผ่านไฟล์ (Express เก็บข้อมูลเป็น `.DBF` ไม่มี API) เริ่มจาก T6.1 ให้ผู้ใช้ตัดสินใจก่อน

## Git

- repo private `nutcharat123/inventory-ttv` branch `main`
- commit ล่าสุด: `82720f2` (แก้ฟอร์มสินค้า ยังไม่ push), `d86ee43` (T4.7, push แล้ว)
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
