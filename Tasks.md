# Inventory TTV: Tasks

อ้างอิง [CONTEXT.md](./CONTEXT.md) และ [design.md](./design.md) ทำตามลำดับ ติ๊กเมื่อเสร็จ

กติกาการทำงาน: JavaScript เท่านั้น, ห้ามลบไฟล์โดยไม่ถามก่อน, ตรวจเอกสารล่าสุดก่อนตั้งค่าไลบรารี, เขียนเทสต์ก่อน (TDD) สำหรับ `src/lib`, ห้ามแสดงค่าใน `.env.local` หรือรหัสผ่านในแชท, งาน git ผ่าน git-manager และ commit/push เมื่อผู้ใช้สั่ง

## เฟส 1: ตั้งโปรเจกต์

- [x] T1.1 สร้างโปรเจกต์ Vite + React (JavaScript) ใน `inventory-ttv` โดยไม่ทับเอกสาร
- [x] T1.2 ติดตั้ง Vitest, oxlint, supabase-js เพิ่มสคริปต์ `test`, `lint` และสร้าง `src/components`, `src/lib`
- [x] T1.3 `.gitignore` (กัน `.env.local`, `dist`), `.gitattributes`, `.env.example`
- [x] T1.4 git init + สร้าง repo บน GitHub (ผ่าน git-manager) ➡️ แนะนำ private — repo private `nutcharat123/inventory-ttv` commit `0b380df`
- [x] T1.5 (ผู้ใช้) สร้างโปรเจกต์ Supabase ใหม่, ปิด "Allow new users to sign up", ใส่ค่าใน `.env.local`

- **เสร็จเมื่อ:** `npm run dev`, `npm test`, `npm run lint` รันได้

## เฟส 2: ฐานข้อมูล

- [x] T2.1 `supabase/schema.sql`: ตาราง `profiles`, `products`, `stock_movements` พร้อม check/unique/index
- [x] T2.2 view `product_stock` และฟังก์ชัน `current_app_role()`
- [x] T2.3 ฟังก์ชัน `record_movement(...)` ตามกติกาใน design.md ข้อ 5
- [x] T2.4 RLS + grant ตาม design.md ข้อ 6 (revoke ทั้งหมดก่อนแล้ว grant เฉพาะที่ต้องใช้)
- [x] T2.5 (ผู้ใช้) รัน `schema.sql` ใน SQL Editor, สร้างบัญชี admin 1 + staff 1 และแถว `profiles`
- [x] T2.6 ตรวจ RLS ด้วยมือตาม design.md ข้อ 9

- **เสร็จเมื่อ:** staff บันทึกรับ/เบิกได้, เพิ่มสินค้า/ปรับยอดไม่ได้, เบิกเกินคงเหลือถูกปฏิเสธ

## เฟส 3: ตรรกะ (`src/lib`) เขียนเทสต์ก่อน

- [x] T3.1 `dateFormat.js`, `theme.js` (ใช้แนวเดียวกับ Borrow Buddy ดู `docs/reference/`) + เทสต์
- [x] T3.2 `stockRules.js`: `signedQuantity`, `getStockStatus(onHand, reorderPoint)`, `sortByStockStatus` + เทสต์ขอบ (0, = จุดสั่งซื้อ, ทศนิยม)
- [x] T3.3 `stockRules.js`: `validateProduct` (ช่องห้ามว่าง, จุดสั่งซื้อ ≥ 0, ทศนิยม ≤ 2) และ `validateMovement(movement, onHand, role)` (จำนวน, ห้ามติดลบ, adjust ต้อง admin + หมายเหตุ, ห้ามวันในอนาคต) + เทสต์
- [x] T3.4 `stockRules.js`: `searchProducts(products, query)` (ชื่อ/รหัส/บาร์โค้ด ไม่สนตัวพิมพ์เล็กใหญ่) และ `filterByCategory` + เทสต์
- [x] T3.5 `roles.js`: `ROLE`, `canManageProducts`, `canAdjust` + เทสต์
- [ ] T3.6 `supabaseClient.js`, `supabaseErrors.js` (รวมข้อความไทยของ SKU/บาร์โค้ดซ้ำ, คงเหลือไม่พอ, ไม่มีสิทธิ์) + เทสต์
- [ ] T3.7 `mappers.js`, `repositories.js` (`listProducts`, `saveProduct`, `setProductActive`, `recordMovement`, `listMovements`, `getMyProfile`) + เทสต์ด้วย client จำลอง

- **เสร็จเมื่อ:** `npm test` ผ่านทั้งหมด

## เฟส 4: UI

- [ ] T4.1 `LoginForm`, ส่วนหัว (`AppHeader`, `ThemeToggle`), จัดการ session และกรณีไม่มี profile
- [ ] T4.2 `TabBar` แสดง Tab ตามบทบาท
- [ ] T4.3 Tab สินค้า: `SummaryCards`, ค้นหา, กรองหมวดหมู่, `ProductCard`
- [ ] T4.4 Tab รับ/เบิก: `MovementForm` พร้อมแสดงคงเหลือก่อน/หลัง
- [ ] T4.5 Tab ประวัติ: `MovementHistory` โหลดทีละ 50 และตัวกรอง
- [ ] T4.6 Tab สินค้า (admin): `ProductForm` เพิ่ม/แก้ไข, ปิด/เปิดใช้งาน
- [ ] T4.7 สไตล์: มือถือ, สีตามสถานะสต็อก (มีข้อความกำกับเสมอ), โหมดมืด

- **เสร็จเมื่อ:** ใช้งานครบทุกอย่างในขอบเขตผ่านหน้าเว็บได้ทั้งสองบทบาท

## เฟส 5: ตรวจรับและ Deploy

- [ ] T5.1 `npm run lint`, `npm test`, `npm run build` ผ่าน
- [ ] T5.2 (ผู้ใช้) ทดลองด้วยบัญชี admin: เพิ่มสินค้า → รับเข้า → เบิกออก → ปรับยอด → ปิดใช้งาน
- [ ] T5.3 (ผู้ใช้) ทดลองด้วยบัญชี staff: รับเข้า/เบิกออกได้, ไม่เห็น Tab จัดการสินค้า, ไม่มีตัวเลือกปรับยอด
- [ ] T5.4 (ผู้ใช้) สองเครื่องเบิกสินค้าเดียวกันพร้อมกันจนเกินคงเหลือ ต้องมีเครื่องหนึ่งถูกปฏิเสธ
- [ ] T5.5 ตรวจว่าไม่มี secret key ในโค้ด/ไฟล์ที่ commit
- [ ] T5.6 Deploy บน Vercel และทดลองบนมือถือจริง
