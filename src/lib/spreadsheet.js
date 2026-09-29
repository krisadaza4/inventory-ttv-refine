import { formatThaiDate } from './dateFormat.js'
import { MOVEMENT_TYPE, STOCK_STATUS, getStockStatus, signedQuantity } from './stockRules.js'

// ตารางสำหรับ write-excel-file: แถว = array ของ cell { value, type, ... }
// รหัส/บาร์โค้ดเป็นข้อความเสมอ ไม่ให้ Excel ตัดเลข 0 ข้างหน้าหรือแปลงเป็นเลขยกกำลัง

const STOCK_LABEL = {
  [STOCK_STATUS.OUT]: 'หมด',
  [STOCK_STATUS.LOW]: 'ใกล้หมด',
  [STOCK_STATUS.OK]: 'ปกติ',
}

const TYPE_LABEL = {
  [MOVEMENT_TYPE.IN]: 'รับเข้า',
  [MOVEMENT_TYPE.OUT]: 'เบิกออก',
  [MOVEMENT_TYPE.ADJUST]: 'ปรับยอด',
}

const QUANTITY_FORMAT = '#,##0.##'

const header = (labels) => labels.map((value) => ({ value, type: String, fontWeight: 'bold' }))
const text = (value) => ({ value: value ?? '', type: String })
const number = (value) => ({ value: Number(value), type: Number, format: QUANTITY_FORMAT })

export function productSheet(products) {
  return [
    header(['รหัสสินค้า', 'บาร์โค้ด', 'ชื่อสินค้า', 'หมวดหมู่', 'หน่วย', 'คงเหลือ', 'จุดสั่งซื้อ', 'สถานะสต็อก', 'การใช้งาน']),
    ...products.map((p) => [
      text(p.sku),
      text(p.barcode),
      text(p.name),
      text(p.category),
      text(p.unit),
      number(p.onHand),
      number(p.reorderPoint),
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
      text(TYPE_LABEL[m.type]),
      number(signedQuantity(m.type, m.quantity)),
      text(m.unit),
      text(m.recordedByName),
      text(m.note),
    ]),
  ]
}

// kind: 'products' | 'movements', today: 'YYYY-MM-DD'
export function exportFileName(kind, today) {
  return `inventory-${kind}-${today}.xlsx`
}
