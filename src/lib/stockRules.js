import { toIsoDate } from './dateFormat.js'
import { canAdjust, canWriteOff } from './roles.js'

export const MOVEMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
  ADJUST: 'adjust',
  // สินค้ารอซ่อม: ส่งซ่อม (ของดี → รอซ่อม), ซ่อมเสร็จ (รอซ่อม → ของดี), ตัดจำหน่าย (ซ่อมไม่ได้ ตัดออกจากรอซ่อม)
  TO_REPAIR: 'to_repair',
  REPAIRED: 'repaired',
  WRITE_OFF: 'write_off',
  // คลังย่อย: โอนเข้า (คลังใหญ่ → คลังย่อย), โอนกลับ (คลังย่อย → คลังใหญ่) ยอดรวมไม่เปลี่ยน
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
}

export const MOVEMENT_LABEL = {
  [MOVEMENT_TYPE.IN]: 'รับเข้า',
  [MOVEMENT_TYPE.OUT]: 'เบิกออก',
  [MOVEMENT_TYPE.ADJUST]: 'ปรับยอด',
  [MOVEMENT_TYPE.TO_REPAIR]: 'ส่งซ่อม',
  [MOVEMENT_TYPE.REPAIRED]: 'ซ่อมเสร็จ',
  [MOVEMENT_TYPE.WRITE_OFF]: 'ตัดจำหน่าย',
  [MOVEMENT_TYPE.TRANSFER_IN]: 'โอนเข้าคลังย่อย',
  [MOVEMENT_TYPE.TRANSFER_OUT]: 'โอนกลับคลังใหญ่',
}

// ประเภทที่ต้องเลือกคลังย่อย และประเภทที่เลือกคลังย่อยได้ (เบิกออก = ขายผ่านคลังย่อย ไม่เลือก = คลังใหญ่)
export const TRANSFER_TYPES = [MOVEMENT_TYPE.TRANSFER_IN, MOVEMENT_TYPE.TRANSFER_OUT]
export const WAREHOUSE_TYPES = [MOVEMENT_TYPE.OUT, ...TRANSFER_TYPES]

// รายการเกี่ยวกับการซ่อม และค่าตัวกรอง "รายการซ่อมทั้งหมด" ในหน้าประวัติ
export const REPAIR_TYPES = [MOVEMENT_TYPE.TO_REPAIR, MOVEMENT_TYPE.REPAIRED, MOVEMENT_TYPE.WRITE_OFF]
export const REPAIR_FILTER = 'repair_all'

// ประเภทที่ต้องระบุหมายเหตุ/เหตุผล (ฐานข้อมูลตรวจซ้ำ)
export const NOTE_REQUIRED_TYPES = [
  MOVEMENT_TYPE.ADJUST,
  MOVEMENT_TYPE.TO_REPAIR,
  MOVEMENT_TYPE.REPAIRED,
  MOVEMENT_TYPE.WRITE_OFF,
]

// ตัวเลือกเหตุผลที่ใช้บ่อย (พิมพ์เองได้)
export const REPAIR_REASONS = ['สปาร์คเสีย', 'รอคิวซ่อม', 'ชิ้นส่วนชำรุด', 'ลูกค้าส่งคืน', 'ซ่อมไม่ได้']

// ประเภทที่บทบาทนี้บันทึกได้ (record_movement ตรวจซ้ำ)
export function allowedMovementTypes(role) {
  return Object.values(MOVEMENT_TYPE).filter(
    (type) =>
      (type !== MOVEMENT_TYPE.ADJUST || canAdjust(role)) && (type !== MOVEMENT_TYPE.WRITE_OFF || canWriteOff(role)),
  )
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

// ผลต่อยอด { good: ของดี (onHand), repair: รอซ่อม (repairQty) } ตรงกับ view product_stock
export function movementEffect(type, quantity) {
  const amount = toAmount(quantity)
  switch (type) {
    case MOVEMENT_TYPE.IN:
    case MOVEMENT_TYPE.ADJUST:
      return { good: amount, repair: 0 }
    case MOVEMENT_TYPE.OUT:
      return { good: -amount, repair: 0 }
    case MOVEMENT_TYPE.TO_REPAIR:
      return { good: -amount, repair: amount }
    case MOVEMENT_TYPE.REPAIRED:
      return { good: amount, repair: -amount }
    case MOVEMENT_TYPE.WRITE_OFF:
      return { good: 0, repair: -amount }
    case MOVEMENT_TYPE.TRANSFER_IN:
    case MOVEMENT_TYPE.TRANSFER_OUT:
      return { good: 0, repair: 0 }
    default:
      throw new Error(`ประเภทรายการไม่ถูกต้อง: ${type}`)
  }
}

// ผลต่อยอดของคลังย่อยที่เลือก (ตรงกับ view warehouse_stock) warehouseQty = ยอดในคลังนั้นก่อนบันทึก
// ขายผ่านคลังย่อยตัดของคลังนั้นก่อน ส่วนที่ขาดตัดจากคลังใหญ่
export function warehouseEffect(type, quantity, warehouseQty = 0) {
  const amount = toAmount(quantity)
  if (type === MOVEMENT_TYPE.TRANSFER_IN) return amount
  if (type === MOVEMENT_TYPE.TRANSFER_OUT) return -amount
  if (type === MOVEMENT_TYPE.OUT) return -Math.max(0, Math.min(toAmount(warehouseQty), amount))
  return 0
}

// จำนวน +/− ที่แสดงในประวัติและไฟล์ส่งออก: ผลต่อของดี ยกเว้นตัดจำหน่ายแสดงเป็นลบ (ออกจากยอดรอซ่อม)
// โอนระหว่างคลังไม่เปลี่ยนยอดรวม แสดงจำนวนที่โอน (ไม่มีเครื่องหมาย)
export function signedQuantity(type, quantity) {
  if (TRANSFER_TYPES.includes(type)) return toAmount(quantity)
  const { good, repair } = movementEffect(type, quantity)
  return type === MOVEMENT_TYPE.WRITE_OFF ? repair : good
}

// stock เป็นตัวเลข (ของดี) หรือ { onHand, repairQty, subQty, warehouseQty }
// subQty = ของดีที่อยู่ในคลังย่อยทั้งหมด, warehouseQty = ในคลังย่อยที่เลือก
const toStock = (stock) =>
  typeof stock === 'object' && stock !== null
    ? {
        onHand: toAmount(stock.onHand ?? 0),
        repairQty: toAmount(stock.repairQty ?? 0),
        subQty: toAmount(stock.subQty ?? 0),
        warehouseQty: toAmount(stock.warehouseQty ?? 0),
      }
    : { onHand: toAmount(stock ?? 0), repairQty: 0, subQty: 0, warehouseQty: 0 }

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
// stock เป็นตัวเลข (ของดี) หรือ { onHand, repairQty }
// movement.warehouseId = คลังย่อย ('' = คลังใหญ่)
export function validateMovement(movement, stock, role, today = toIsoDate(new Date())) {
  const errors = {}
  const { type } = movement
  const warehouseId = movement.warehouseId ?? ''
  const current = toStock(stock)
  const central = toAmount(current.onHand - current.subQty)

  if (!Object.values(MOVEMENT_TYPE).includes(type)) {
    errors.type = 'ประเภทรายการไม่ถูกต้อง'
  } else if (type === MOVEMENT_TYPE.ADJUST && !canAdjust(role)) {
    errors.type = 'ปรับยอดได้เฉพาะเจ้าของร้าน'
  } else if (type === MOVEMENT_TYPE.WRITE_OFF && !canWriteOff(role)) {
    errors.type = 'ตัดจำหน่ายได้เฉพาะเจ้าของร้าน'
  }

  const quantity = parseAmount(movement.quantity)
  if (quantity === null) {
    errors.quantity = 'จำนวนต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง'
  } else if (type === MOVEMENT_TYPE.ADJUST ? quantity === 0 : quantity <= 0) {
    errors.quantity = type === MOVEMENT_TYPE.ADJUST ? 'จำนวนปรับยอดต้องไม่เป็น 0' : 'จำนวนต้องมากกว่า 0'
  } else if (!errors.type) {
    const after = stockAfter(current, type, quantity, warehouseId)
    const centralLabel = current.subQty > 0 ? 'คลังใหญ่คงเหลือไม่พอ' : 'คงเหลือไม่พอ'
    if (warehouseId && type === MOVEMENT_TYPE.OUT && after.central < 0) {
      errors.quantity = `จำนวนที่ขายได้ไม่พอ (ขายได้ ${toAmount(central + current.warehouseQty)})`
    } else if (after.central < 0) errors.quantity = `${centralLabel} (คงเหลือ ${central})`
    else if (after.warehouse !== null && after.warehouse < 0) {
      errors.quantity = `คลังย่อยคงเหลือไม่พอ (คงเหลือ ${current.warehouseQty})`
    } else if (after.repairQty < 0) errors.quantity = `ยอดรอซ่อมไม่พอ (รอซ่อม ${current.repairQty})`
  }

  if (TRANSFER_TYPES.includes(type) && !warehouseId) errors.warehouseId = 'กรุณาเลือกคลังย่อย'
  else if (warehouseId && !WAREHOUSE_TYPES.includes(type)) errors.warehouseId = 'รายการนี้ทำได้ที่คลังใหญ่เท่านั้น'

  const date = movement.movementDate ?? ''
  if (!ISO_DATE.test(date)) errors.movementDate = 'กรุณาเลือกวันที่'
  else if (date > today) errors.movementDate = 'วันที่ต้องไม่เป็นวันในอนาคต'

  if (NOTE_REQUIRED_TYPES.includes(type) && isBlank(movement.note)) {
    errors.note = type === MOVEMENT_TYPE.ADJUST ? 'ปรับยอดต้องระบุหมายเหตุ' : 'กรุณาระบุเหตุผล'
  }
  return errors
}

// ค้นจากชื่อ รหัส หรือบาร์โค้ด ไม่สนตัวพิมพ์เล็กใหญ่ คำค้นว่างคืนทั้งหมด
export function searchProducts(products, query) {
  const text = String(query ?? '').trim().toLowerCase()
  if (!text) return products
  return products.filter((p) =>
    [p.name, p.sku, p.barcode, p.location].some((field) => String(field ?? '').toLowerCase().includes(text)),
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

// ตัวกรอง "ที่เก็บ": สินค้าที่ยังไม่ระบุที่เก็บ
export const NO_LOCATION = '__none__'

// ตัวเลือกของตัวกรองที่เก็บ (ไม่รวมค่าว่าง)
export function listLocations(products) {
  const locations = products.map((p) => String(p.location ?? '').trim()).filter(Boolean)
  return [...new Set(locations)].sort((a, b) => a.localeCompare(b, 'th'))
}

// ตัวเลือกของตัวกรองหน่วย
export function listUnits(products) {
  return [...new Set(products.map((p) => p.unit))].sort((a, b) => a.localeCompare(b, 'th'))
}

// กรองหลายเงื่อนไขพร้อมกัน ค่าว่างหมายถึงไม่กรองช่องนั้น
// filters: { category, status, location (NO_LOCATION = ไม่ระบุ), unit, repairOnly }
export function filterProducts(products, filters = {}) {
  const { category, status, location, unit, repairOnly } = filters
  return products.filter((p) => {
    if (category && p.category !== category) return false
    if (status && getStockStatus(p.onHand, p.reorderPoint) !== status) return false
    if (location) {
      const own = String(p.location ?? '').trim()
      if (location === NO_LOCATION ? own !== '' : own !== location) return false
    }
    if (unit && p.unit !== unit) return false
    if (repairOnly && !(toAmount(p.repairQty ?? 0) > 0)) return false
    return true
  })
}

// เรียงตามหัวคอลัมน์ key: 'status' | 'sku' | 'name' | 'category' | 'onHand' | 'repairQty' | 'reorderPoint' | 'avgMonthlySales'
// dir: 'asc' | 'desc' สถานะ asc = หมด → ใกล้หมด → ปกติ ค่าว่าง (เช่น ไม่มียอดเฉลี่ย) อยู่ท้ายเสมอ
export function sortProducts(products, key, dir) {
  const sign = dir === 'desc' ? -1 : 1
  const value = (p) => {
    if (key === 'status') return STATUS_ORDER.indexOf(getStockStatus(p.onHand, p.reorderPoint))
    if (key === 'sku' || key === 'name' || key === 'category') return String(p[key] ?? '')
    return p[key] === null || p[key] === undefined ? null : Number(p[key])
  }
  return [...products].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    let cmp
    if (va === null || vb === null) cmp = va === vb ? 0 : va === null ? 1 : -1
    else cmp = (typeof va === 'string' ? va.localeCompare(vb, 'th') : va - vb) * sign
    return cmp || a.name.localeCompare(b.name, 'th')
  })
}

// ยอดหลังบันทึกสำหรับแสดงก่อนกดบันทึก จำนวนหรือประเภทยังไม่ถูกต้อง คืน null
// { onHand: ของดีรวม, repairQty, central: คลังใหญ่, warehouse: คลังย่อยที่เลือก (null = ไม่ได้เลือก) }
export function stockAfter(stock, type, quantity, warehouseId = '') {
  const amount = parseAmount(quantity)
  if (amount === null || !Object.values(MOVEMENT_TYPE).includes(type)) return null
  const { onHand, repairQty, subQty, warehouseQty } = toStock(stock)
  const effect = movementEffect(type, amount)
  const sub = warehouseId ? warehouseEffect(type, amount, warehouseQty) : 0
  const good = toAmount(onHand + effect.good)
  return {
    onHand: good,
    repairQty: toAmount(repairQty + effect.repair),
    central: toAmount(good - subQty - sub),
    warehouse: warehouseId ? toAmount(warehouseQty + sub) : null,
  }
}

// ของดีหลังบันทึก
export function quantityAfter(onHand, type, quantity) {
  return stockAfter(onHand, type, quantity)?.onHand ?? null
}
