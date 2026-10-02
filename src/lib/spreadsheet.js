import { formatThaiDate } from './dateFormat.js'
import { MONTH_LABELS, toBuddhistYear } from './monthlySales.js'
import { MOVEMENT_LABEL, STOCK_STATUS, getStockStatus, signedQuantity } from './stockRules.js'

// ตารางสำหรับ write-excel-file: แถว = array ของ cell { value, type, ... }
// รหัส/บาร์โค้ดเป็นข้อความเสมอ ไม่ให้ Excel ตัดเลข 0 ข้างหน้าหรือแปลงเป็นเลขยกกำลัง

const STOCK_LABEL = {
  [STOCK_STATUS.OUT]: 'หมด',
  [STOCK_STATUS.LOW]: 'ใกล้หมด',
  [STOCK_STATUS.OK]: 'ปกติ',
}

const QUANTITY_FORMAT = '#,##0.##'

const header = (labels) => labels.map((value) => ({ value, type: String, fontWeight: 'bold' }))
const text = (value) => ({ value: value ?? '', type: String })
const number = (value) => ({ value: Number(value), type: Number, format: QUANTITY_FORMAT })
const optionalNumber = (value) => (value === null || value === undefined ? text('') : number(value))

export function productSheet(products) {
  return [
    header(['รหัสสินค้า', 'บาร์โค้ด', 'ชื่อสินค้า', 'หมวดหมู่', 'หน่วย', 'โลเคชั่น', 'คงเหลือ (ของดี)', 'รอซ่อม', 'จุดสั่งซื้อ', 'ขายเฉลี่ย/เดือน', 'สถานะสต็อก', 'การใช้งาน']),
    ...products.map((p) => [
      text(p.sku),
      text(p.barcode),
      text(p.name),
      text(p.category),
      text(p.unit),
      text(p.location),
      number(p.onHand),
      number(p.repairQty ?? 0),
      number(p.reorderPoint),
      optionalNumber(p.avgMonthlySales),
      text(STOCK_LABEL[getStockStatus(p.onHand, p.reorderPoint)]),
      text(p.active ? 'ใช้งาน' : 'ปิดใช้งาน'),
    ]),
  ]
}

export function movementSheet(movements) {
  return [
    header(['วันที่', 'รหัสสินค้า', 'ชื่อสินค้า', 'ประเภท', 'จำนวน (+/−)', 'หน่วย', 'ผู้บันทึก', 'หมายเหตุ']),
    ...movements.map((m) => [
      text(formatThaiDate(m.movementDate)),
      text(m.productSku),
      text(m.productName),
      text(MOVEMENT_LABEL[m.type]),
      number(signedQuantity(m.type, m.quantity)),
      text(m.unit),
      text(m.recordedByName),
      text(m.note),
    ]),
  ]
}

// ยอดขายรายเดือน: rows จาก buildSalesRows (เดือนที่ไม่มีข้อมูลเป็นช่องว่าง)
export function monthlySalesSheet(rows) {
  return [
    header(['รหัสสินค้า', 'ชื่อสินค้า', ...MONTH_LABELS, 'รวม', 'เฉลี่ย/เดือน']),
    ...rows.map((r) => [
      text(r.product.sku),
      text(r.product.name),
      ...r.months.map((q) => (q === null ? text('') : number(q))),
      number(r.total),
      number(r.average),
    ]),
  ]
}

// สำรองข้อมูลทั้งหมด (admin) เป็นไฟล์เดียวหลายแผ่นงาน: สินค้า (รวมที่ปิดใช้งาน) / ประวัติ / ยอดขายรายเดือน
// สินค้ามีรหัสเดิม ไฟล์รูป และรหัสระบบเพิ่ม เพื่อใช้กู้คืนหรือตรวจสอบภายหลัง
export function backupSheets({ products, movements, sales }) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const productRows = productSheet(products).map((row, i) => {
    if (i === 0) return [...row, ...header(['รหัสเดิม', 'ไฟล์รูป', 'รหัสระบบ'])]
    const p = products[i - 1]
    return [...row, text(p.legacySku), text(p.imagePath), text(p.id)]
  })
  const salesRows = [
    header(['รหัสสินค้า', 'ชื่อสินค้า', 'ปี (พ.ศ.)', 'เดือน', 'จำนวน']),
    ...sales.map((s) => {
      const p = byId.get(s.productId)
      return [
        text(p?.sku ?? s.productId),
        text(p?.name),
        number(toBuddhistYear(s.year)),
        text(MONTH_LABELS[s.month - 1]),
        number(s.quantity),
      ]
    }),
  ]
  return [
    { data: productRows, sheet: 'สินค้า', stickyRowsCount: 1 },
    { data: movementSheet(movements), sheet: 'ประวัติ', stickyRowsCount: 1 },
    { data: salesRows, sheet: 'ยอดขายรายเดือน', stickyRowsCount: 1 },
  ]
}

// kind: 'products' | 'movements' | 'backup', today: 'YYYY-MM-DD'
export function exportFileName(kind, today) {
  return `inventory-${kind}-${today}.xlsx`
}
