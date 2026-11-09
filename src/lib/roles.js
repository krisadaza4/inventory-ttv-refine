// ตรงกับ profiles.role ในฐานข้อมูล (supabase/migration_roles.sql)
export const ROLE = {
  ADMIN: 'admin', // เจ้าของร้าน / Dev: ทำได้ทุกอย่าง
  STORE_QC: 'store_qc', // Store/QC: ทำได้ทุกอย่างในแอป (เท่า admin)
  STAFF: 'staff', // พนักงาน (บัญชีเดิม): รับเข้า เบิกออก ส่งซ่อม ซ่อมเสร็จ
  MANAGER: 'manager', // ดูอย่างเดียว
  MARKETING: 'marketing', // ดูอย่างเดียว
}

// ชื่อบทบาทที่แสดงบนแถบบน
export const ROLE_LABEL = {
  [ROLE.ADMIN]: 'เจ้าของร้าน (admin)',
  [ROLE.STORE_QC]: 'Store/QC',
  [ROLE.STAFF]: 'พนักงาน (staff)',
  [ROLE.MANAGER]: 'Manager',
  [ROLE.MARKETING]: 'Marketing',
}

// ทำได้ทุกอย่าง: เพิ่ม/แก้ไข/ปิดใช้งานสินค้า นำเข้าไฟล์ ปรับยอด ตัดจำหน่าย
const FULL_ACCESS = new Set([ROLE.ADMIN, ROLE.STORE_QC])
// บันทึกรายการเคลื่อนไหว (รับเข้า/เบิกออก/ส่งซ่อม/ซ่อมเสร็จ) ได้ บทบาทอื่นและค่าที่ไม่รู้จักดูอย่างเดียว
const CAN_RECORD = new Set([ROLE.ADMIN, ROLE.STORE_QC, ROLE.STAFF])

// ฐานข้อมูลตรวจซ้ำทุกข้อด้วย RLS / record_movement

// เพิ่ม/แก้ไข/ปิดใช้งานสินค้า
export function canManageProducts(role) {
  return FULL_ACCESS.has(role)
}

// ปรับยอด
export function canAdjust(role) {
  return FULL_ACCESS.has(role)
}

// ตัดจำหน่ายสินค้ารอซ่อมที่ซ่อมไม่ได้
export function canWriteOff(role) {
  return FULL_ACCESS.has(role)
}

// รับเข้า / เบิกออก / ส่งซ่อม / ซ่อมเสร็จ
export function canRecordMovements(role) {
  return CAN_RECORD.has(role)
}
