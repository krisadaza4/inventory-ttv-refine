export const MOVEMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
  ADJUST: 'adjust',
}

export const STOCK_STATUS = {
  OUT: 'out',
  LOW: 'low',
  OK: 'ok',
}

// ลำดับที่แสดงในรายการสินค้า: หมด → ใกล้หมด → ปกติ
const STATUS_ORDER = [STOCK_STATUS.OUT, STOCK_STATUS.LOW, STOCK_STATUS.OK]

// numeric(12,2) จาก Supabase อาจมาเป็นข้อความ และผลบวกทศนิยมอาจเพี้ยน จึงปัดเป็น 2 ตำแหน่ง
const toAmount = (value) => Math.round(Number(value) * 100) / 100

// จำนวนที่มีผลต่อคงเหลือ: in บวก, out ลบ, adjust ตามที่กรอก
export function signedQuantity(type, quantity) {
  const amount = toAmount(quantity)
  switch (type) {
    case MOVEMENT_TYPE.IN:
    case MOVEMENT_TYPE.ADJUST:
      return amount
    case MOVEMENT_TYPE.OUT:
      return -amount
    default:
      throw new Error(`ประเภทรายการไม่ถูกต้อง: ${type}`)
  }
}

export function getStockStatus(onHand, reorderPoint) {
  const amount = toAmount(onHand)
  if (amount <= 0) return STOCK_STATUS.OUT
  if (amount <= toAmount(reorderPoint)) return STOCK_STATUS.LOW
  return STOCK_STATUS.OK
}

export function sortByStockStatus(products) {
  const rank = (p) => STATUS_ORDER.indexOf(getStockStatus(p.onHand, p.reorderPoint))
  return [...products].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'th'))
}
