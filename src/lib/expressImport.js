import { validateProduct } from './stockRules.js'

// นำเข้ารายการสินค้าจากรายงาน "สินค้าและวัตถุดิบ" ของโปรแกรมบัญชี Express (design.md ข้อ 7.1)
// rows = แถวจาก read-excel-file (array ของค่า) ไฟล์มีหัวรายงานก่อนตาราง จึงหาแถวหัวตารางจากชื่อคอลัมน์

export const IMPORT_ERROR = {
  NO_HEADER: 'ไม่พบหัวตาราง "รหัสสินค้า" และ "รายละเอียดสินค้า" กรุณาใช้ไฟล์รายงานสินค้าที่ส่งออกจาก Express',
}

// รหัสบ/ช ของ Express ที่เป็นสินค้าในสต็อก (ST01, ST02, …) ที่เหลือเป็นค่าบริการ ค่าใช้จ่าย วัสดุ ฯลฯ
const STOCK_ACCOUNT = /^ST/i

const cellText = (value) => (value === null || value === undefined ? '' : String(value))
const normalizeSku = (sku) => cellText(sku).trim().toLowerCase()

export function parseExpressReport(rows) {
  const headerIndex = rows.findIndex((r) => r.includes('รหัสสินค้า') && r.includes('รายละเอียดสินค้า'))
  if (headerIndex === -1) return { items: [], error: IMPORT_ERROR.NO_HEADER }

  const header = rows[headerIndex]
  const col = {
    sku: header.indexOf('รหัสสินค้า'),
    name: header.indexOf('รายละเอียดสินค้า'),
    // คอลัมน์ "หมวดสินค้า" เป็นรหัสหมวด ชื่อหมวดอยู่คอลัมน์ถัดไป (ไม่มีหัว)
    category: header.indexOf('หมวดสินค้า') + 1,
    unit: header.indexOf('นับเป็น'),
    account: header.indexOf('รหัสบ/ช'),
  }
  const read = (r, key) => (col[key] >= 0 ? cellText(r[col[key]]) : '')

  const items = []
  rows.slice(headerIndex + 1).forEach((r, i) => {
    if (cellText(r[col.sku]).trim() === '') return
    items.push({
      row: headerIndex + 2 + i,
      sku: read(r, 'sku'),
      name: read(r, 'name'),
      category: col.category > 0 ? read(r, 'category') : '',
      unit: read(r, 'unit'),
      account: read(r, 'account'),
    })
  })
  return { items, error: null }
}

// แยกว่าแถวไหนเพิ่มใหม่ / ข้าม / ผิด ไม่แก้สินค้าที่มีอยู่แล้ว (เทียบรหัสแบบไม่สนตัวพิมพ์และช่องว่าง)
export function planImport(items, existingProducts) {
  const existing = new Set(existingProducts.map((p) => normalizeSku(p.sku)))
  const seen = new Set()
  const plan = { toInsert: [], skippedNonStock: 0, skippedExisting: 0, invalid: [] }

  for (const item of items) {
    if (!STOCK_ACCOUNT.test(item.account.trim())) {
      plan.skippedNonStock += 1
      continue
    }
    const product = {
      sku: item.sku.trim(),
      barcode: '',
      name: item.name.trim(),
      category: item.category.trim(),
      unit: item.unit.trim(),
      reorderPoint: 0,
    }
    const errors = Object.values(validateProduct(product))
    if (errors.length > 0) {
      plan.invalid.push({ row: item.row, sku: product.sku, reason: errors[0] })
      continue
    }
    const key = normalizeSku(product.sku)
    if (seen.has(key)) {
      plan.invalid.push({ row: item.row, sku: product.sku, reason: 'รหัสซ้ำในไฟล์' })
      continue
    }
    seen.add(key)
    if (existing.has(key)) {
      plan.skippedExisting += 1
      continue
    }
    plan.toInsert.push(product)
  }
  return plan
}
