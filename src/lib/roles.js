// ตรงกับ profiles.role ในฐานข้อมูล
export const ROLE = {
  ADMIN: 'admin',
  STAFF: 'staff',
}

// เพิ่ม/แก้ไข/ปิดใช้งานสินค้า: เฉพาะเจ้าของร้าน (ฐานข้อมูลตรวจซ้ำด้วย RLS)
export function canManageProducts(role) {
  return role === ROLE.ADMIN
}

// ปรับยอด: เฉพาะเจ้าของร้าน (record_movement ตรวจซ้ำ)
export function canAdjust(role) {
  return role === ROLE.ADMIN
}

// ตัดจำหน่ายสินค้ารอซ่อมที่ซ่อมไม่ได้: เฉพาะเจ้าของร้าน (record_movement ตรวจซ้ำ)
export function canWriteOff(role) {
  return role === ROLE.ADMIN
}
