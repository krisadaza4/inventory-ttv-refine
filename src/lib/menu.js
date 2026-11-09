import { canManageProducts, canRecordMovements } from './roles.js'

export const PAGE = {
  PRODUCTS: 'products',
  MOVE: 'move',
  HISTORY: 'history',
  SALES: 'sales',
  MANAGE: 'manage',
}

// เมนูซ้ายตาม design.md ข้อ 7 (short = ชื่อสั้นบนแถบล่างของมือถือ)
const MENU = [
  {
    label: 'งานประจำวัน',
    items: [
      { page: PAGE.PRODUCTS, label: 'สินค้าคงคลัง', short: 'สินค้า', icon: '▦' },
      { page: PAGE.MOVE, label: 'รับเข้า / เบิกออก', short: 'รับ/เบิก', icon: '⇄', recordOnly: true },
      { page: PAGE.HISTORY, label: 'ประวัติการเคลื่อนไหว', short: 'ประวัติ', icon: '☰' },
      { page: PAGE.SALES, label: 'ยอดขายรายเดือน', short: 'ยอดขาย', icon: '▤' },
    ],
  },
  {
    label: 'ผู้ดูแล',
    adminOnly: true,
    items: [{ page: PAGE.MANAGE, label: 'จัดการสินค้า', short: 'จัดการ', icon: '✎' }],
  },
]

// adminOnly = กลุ่มของผู้จัดการสินค้า (admin / Store/QC) recordOnly = หน้าที่ใช้บันทึกรายการ (ดูอย่างเดียวไม่เห็น)
export function getMenu(role) {
  return MENU.filter((group) => !group.adminOnly || canManageProducts(role))
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.recordOnly || canRecordMovements(role)) }))
    .filter((group) => group.items.length > 0)
}

export function getPageInfo(page) {
  for (const group of MENU) {
    const item = group.items.find((i) => i.page === page)
    if (item) return { ...item, group: group.label }
  }
  return null
}
