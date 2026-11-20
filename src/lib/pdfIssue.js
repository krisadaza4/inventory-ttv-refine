import { planBulkIssue } from './bulkIssue.js'

// เบิกออกจาก PDF ของเว็บ seller (ผู้ใช้กำหนด 2026-11-19): หมายเหตุ "ออนไลน์" ทุกรายการ, SKU ชุด (เช่น KB8A-VAB) เป็นสินค้าชุดเดียว,
// กันเบิกซ้ำด้วยเลขคำสั่งซื้อ (แพลตฟอร์ม + เลขคำสั่งซื้อ + SKU), รหัสที่ไม่ตรงกับในระบบไม่เบิก แต่แจ้งให้ผู้ใช้ไปแก้รหัส
export const PDF_ISSUE_NOTE = 'ออนไลน์'

export const normalizeSku = (sku) => String(sku ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
export const orderKey = (platform, orderNo, sku) => `${platform}|${orderNo}|${normalizeSku(sku)}`

// files = [{ name, platform, rows: [{ sku, quantity, orders }] }] จาก parsePicklist
// products = สินค้าที่เปิดใช้งาน issuedKeys = Set ของ orderKey ที่เคยเบิกแล้ว
// คืน
//   lines     = [{ productId, quantity, sources: [{ platform, sku, quantity, orders }], partial }] รวมต่อสินค้า เรียงตาม SKU
//   orders    = [{ platform, order_no, sku }] คำสั่งซื้อที่จะบันทึกว่าเบิกแล้ว (เฉพาะรายการที่จับคู่สินค้าได้)
//   unmatched = แถวที่รหัสไม่ตรงกับสินค้าในระบบ [{ platform, sku, quantity, orders }]
//   skipped   = แถวที่ทุกคำสั่งซื้อเคยเบิกแล้ว (หรือซ้ำกับไฟล์อื่นที่เลือกมาพร้อมกัน)
// partial = บางคำสั่งซื้อในแถวเคยเบิกแล้ว (Shopee รวมจำนวนหลายคำสั่งซื้อไว้แถวเดียว แยกจำนวนไม่ได้ ให้ผู้ใช้ตรวจจำนวนเอง)
export function planPdfIssue(files, products, issuedKeys = new Set()) {
  const bySku = new Map()
  for (const product of products) {
    bySku.set(normalizeSku(product.sku), product)
  }
  for (const product of products) {
    const legacy = normalizeSku(product.legacySku)
    if (legacy && !bySku.has(legacy)) bySku.set(legacy, product)
  }

  const seen = new Set(issuedKeys)
  const lineByProduct = new Map()
  const orders = []
  const unmatched = []
  const skipped = []

  for (const file of files) {
    for (const row of file.rows) {
      const source = { platform: file.platform, sku: row.sku, quantity: row.quantity, orders: row.orders }
      const product = bySku.get(normalizeSku(row.sku))
      if (!product) {
        unmatched.push(source)
        continue
      }
      const keys = row.orders.map((orderNo) => orderKey(file.platform, orderNo, row.sku))
      const fresh = row.orders.filter((_, i) => !seen.has(keys[i]))
      if (row.orders.length > 0 && fresh.length === 0) {
        skipped.push(source)
        continue
      }
      keys.forEach((key) => seen.add(key))
      for (const orderNo of fresh) orders.push({ platform: file.platform, order_no: orderNo, sku: row.sku })

      const line = lineByProduct.get(product.id) ?? { productId: product.id, quantity: 0, sources: [], partial: false }
      line.quantity += row.quantity
      line.sources.push({ ...source, orders: fresh })
      if (fresh.length < row.orders.length) line.partial = true
      lineByProduct.set(product.id, line)
    }
  }

  const skuOf = (line) => products.find((p) => p.id === line.productId)?.sku ?? ''
  const lines = [...lineByProduct.values()].toSorted((a, b) => skuOf(a).localeCompare(skuOf(b), 'th'))
  return { lines, orders, unmatched, skipped }
}

// ตรวจจำนวนก่อนส่ง (จำนวนแก้ได้ในหน้าต่าง quantities = { [productId]: ข้อความจำนวน })
// คืน { moves, errors } แบบเดียวกับ planBulkIssue
export function checkPdfIssue(lines, quantities, products, role, today) {
  const rows = lines.map((line) => ({
    productId: line.productId,
    quantity: quantities[line.productId] ?? String(line.quantity),
    note: PDF_ISSUE_NOTE,
  }))
  return planBulkIssue(rows, products, role, today)
}
