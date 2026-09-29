import { canManageProducts } from './roles.js'

export const PAGE = {
  PRODUCTS: 'products',
  MOVE: 'move',
  HISTORY: 'history',
  MANAGE: 'manage',
}

// เมนูซ้ายตาม design.md ข้อ 7 (short = ชื่อสั้นบนแถบล่างของมือถือ)
const MENU = [
  {
    label: 'งานประจำวัน',
    items: [
      { page: PAGE.PRODUCTS, label: 'สินค้าคงคลัง', short: 'สินค้า', icon: '▦' },
      { page: PAGE.MOVE, label: 'รับเข้า / เบิกออก', short: 'รับ/เบิก', icon: '⇄' },
      { page: PAGE.HISTORY, label: 'ประวัติการเคลื่อนไหว', short: 'ประวัติ', icon: '☰' },
    ],
  },
  {
    label: 'ผู้ดูแล',
    adminOnly: true,
    items: [{ page: PAGE.MANAGE, label: 'จัดการสินค้า', short: 'จัดการ', icon: '✎' }],
  },
]

export function getMenu(role) {
  return MENU.filter((group) => !group.adminOnly || canManageProducts(role))
}

export function getPageInfo(page) {
  for (const group of MENU) {
    const item = group.items.find((i) => i.page === page)
    if (item) return { ...item, group: group.label }
  }
  return null
}
