# ไฟล์อ้างอิงจาก Borrow Buddy

คัดลอกจาก `borrow-buddy-samit/src` เมื่อ 2026-09-29 เพื่อใช้เป็นแนวทางเท่านั้น ไม่ถูก import หรือ build และไม่ต้องแก้ไฟล์ในนี้

**หมายเหตุ:** หน้าตา UI เปลี่ยนเป็นแบบโปรแกรมโทนกรมท่าตาม `../mockup.html` แล้ว ไฟล์ CSS และ component ในนี้ใช้ดูแค่วิธีเขียน (session, โหมดมืด, โครง component) ไม่ใช้สีหรือรูปแบบ

| ไฟล์ | ใช้อ้างอิงกับ |
| --- | --- |
| `App.css`, `index.css` | วิธีทำโหมดมืดด้วย `data-theme` (สีใช้ตาม mockup) |
| `App.jsx` | T4.1 จัดการ session และโครงหน้า |
| `components/LoginForm.jsx`, `AccountBar.jsx`, `ThemeToggle.jsx` | T4.1 |
| `components/TabBar.jsx`, `lib/tabs.js` | T4.2 |
| `components/SummaryCards.jsx`, `SearchBox.jsx` | T4.3 |
| `lib/supabaseClient.js`, `lib/supabaseErrors.js` | T3.6 |
