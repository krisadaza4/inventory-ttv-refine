import { toIsoDate } from './dateFormat.js'
import { canAdjust } from './roles.js'

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

// ตัวเลขทศนิยมไม่เกิน 2 ตำแหน่ง ตาม numeric(12,2)
const DECIMAL_2 = /^-?(\d+(\.\d{1,2})?|\.\d{1,2})$/
const MAX_AMOUNT = 9999999999.99
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const isBlank = (value) => String(value ?? '').trim() === ''

// คืนตัวเลข หรือ null ถ้าไม่ใช่ตัวเลขทศนิยม ≤ 2 ตำแหน่ง
function parseAmount(value) {
  const text = String(value ?? '').trim()
  if (!DECIMAL_2.test(text)) return null
  const amount = Number(text)
  return Math.abs(amount) <= MAX_AMOUNT ? amount : null
}

// คืน error เป็น { ชื่อช่อง: ข้อความ } ถ้าไม่มี error คืน {}
export function validateProduct(product) {
  const errors = {}
  if (isBlank(product.sku)) errors.sku = 'กรุณากรอกรหัสสินค้า'
  if (isBlank(product.name)) errors.name = 'กรุณากรอกชื่อสินค้า'
  if (isBlank(product.category)) errors.category = 'กรุณากรอกหมวดหมู่'
  if (isBlank(product.unit)) errors.unit = 'กรุณากรอกหน่วย'

  if (!isBlank(product.reorderPoint)) {
    const reorderPoint = parseAmount(product.reorderPoint)
    if (reorderPoint === null) errors.reorderPoint = 'จุดสั่งซื้อต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง'
    else if (reorderPoint < 0) errors.reorderPoint = 'จุดสั่งซื้อต้องไม่ติดลบ'
  }
  return errors
}

// ตรวจก่อนส่ง record_movement (ฐานข้อมูลตรวจซ้ำอีกชั้น) today เป็น 'YYYY-MM-DD'
export function validateMovement(movement, onHand, role, today = toIsoDate(new Date())) {
  const errors = {}
  const { type } = movement

  if (!Object.values(MOVEMENT_TYPE).includes(type)) {
    errors.type = 'ประเภทรายการไม่ถูกต้อง'
  } else if (type === MOVEMENT_TYPE.ADJUST && !canAdjust(role)) {
    errors.type = 'ปรับยอดได้เฉพาะเจ้าของร้าน'
  }

  const quantity = parseAmount(movement.quantity)
  if (quantity === null) {
    errors.quantity = 'จำนวนต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง'
  } else if (type === MOVEMENT_TYPE.ADJUST ? quantity === 0 : quantity <= 0) {
    errors.quantity = type === MOVEMENT_TYPE.ADJUST ? 'จำนวนปรับยอดต้องไม่เป็น 0' : 'จำนวนต้องมากกว่า 0'
  } else if (!errors.type && toAmount(toAmount(onHand) + signedQuantity(type, quantity)) < 0) {
    errors.quantity = `คงเหลือไม่พอ (คงเหลือ ${toAmount(onHand)})`
  }

  const date = movement.movementDate ?? ''
  if (!ISO_DATE.test(date)) errors.movementDate = 'กรุณาเลือกวันที่'
  else if (date > today) errors.movementDate = 'วันที่ต้องไม่เป็นวันในอนาคต'

  if (type === MOVEMENT_TYPE.ADJUST && isBlank(movement.note)) errors.note = 'ปรับยอดต้องระบุหมายเหตุ'
  return errors
}

// ค้นจากชื่อ รหัส หรือบาร์โค้ด ไม่สนตัวพิมพ์เล็กใหญ่ คำค้นว่างคืนทั้งหมด
export function searchProducts(products, query) {
  const text = String(query ?? '').trim().toLowerCase()
  if (!text) return products
  return products.filter((p) =>
    [p.name, p.sku, p.barcode].some((field) => String(field ?? '').toLowerCase().includes(text)),
  )
}

// ไม่เลือกหมวดหมู่คืนทั้งหมด
export function filterByCategory(products, category) {
  if (!category) return products
  return products.filter((p) => p.category === category)
}

// ตัวเลขในกล่องสรุป: ทั้งหมด / หมด / ใกล้หมด / ปกติ
export function countByStockStatus(products) {
  const counts = { total: products.length, [STOCK_STATUS.OUT]: 0, [STOCK_STATUS.LOW]: 0, [STOCK_STATUS.OK]: 0 }
  for (const p of products) counts[getStockStatus(p.onHand, p.reorderPoint)] += 1
  return counts
}

// ตัวเลือกของตัวกรองหมวดหมู่
export function listCategories(products) {
  return [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'th'))
}

// คงเหลือหลังบันทึก สำหรับแสดงก่อนกดบันทึก จำนวนหรือประเภทยังไม่ถูกต้อง คืน null
export function quantityAfter(onHand, type, quantity) {
  const amount = parseAmount(quantity)
  if (amount === null || !Object.values(MOVEMENT_TYPE).includes(type)) return null
  return toAmount(toAmount(onHand) + signedQuantity(type, amount))
}
