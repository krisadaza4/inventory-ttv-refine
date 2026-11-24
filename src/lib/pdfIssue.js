import { ISSUE_NOTE_MAX, planBulkIssue } from './bulkIssue.js'

// เบิกออกจาก PDF ของเว็บ seller (ผู้ใช้กำหนด 2026-11-19): หมายเหตุ "ออนไลน์" ทุกรายการ,
// กันเบิกซ้ำด้วยเลขคำสั่งซื้อ (แพลตฟอร์ม + เลขคำสั่งซื้อ + SKU), รหัสที่ไม่ตรงกับในระบบไม่เบิก แต่แจ้งให้ผู้ใช้ไปแก้รหัส
// ชุดสินค้า (2026-11-24): รหัสชุดใน PDF (เช่น GL-203R-P1) แตกเป็นชิ้นส่วนตามตารางชุดสินค้า ร้านหยิบชิ้นส่วนมาจัดตอนแพ็ก
//   ถ้ารหัสตรงทั้งชุดและสินค้าที่ยังมีสต็อก (เช่น KB5A02-VAB-P1 ที่แพ็กไว้แล้ว) ตัดสินค้านั้นตรง ไม่แตกชุด (ผู้ใช้กำหนด 2026-11-24)
//   สต็อกหมดแล้วค่อยแตกเป็นชิ้นส่วน
export const PDF_ISSUE_NOTE = 'ออนไลน์'

export const normalizeSku = (sku) => String(sku ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
export const orderKey = (platform, orderNo, sku) => `${platform}|${orderNo}|${normalizeSku(sku)}`

// รหัสที่ดูเหมือนชุดของ seller (ลงท้าย -P1, -P2-…) ใช้บอกผู้ใช้ว่าอาจยังไม่ได้ตั้งค่าชุด
export const looksLikeBundle = (sku) => /-P\d+(-|$)/i.test(String(sku ?? '').trim())

export const UNMATCHED_REASON = {
  NO_PRODUCT: 'no_product',
  BUNDLE_NOT_SET: 'bundle_not_set',
  BUNDLE_INACTIVE: 'bundle_inactive',
}

// files = [{ name, platform, rows: [{ sku, quantity, orders }] }] จาก parsePicklist
// products = สินค้าที่เปิดใช้งาน issuedKeys = Set ของ orderKey ที่เคยเบิกแล้ว
// bundles = [{ sku, items: [{ productId, quantity }] }] ตารางชุดสินค้า
// คืน
//   lines     = [{ productId, quantity, sources, partial, fromBundle }] รวมต่อสินค้า
//               เรียง: สินค้าที่มาจากชุดก่อน (ตามรหัสชุดแรก สินค้าหลักของชุดก่อน) แล้วสินค้าอื่นตาม SKU
//   bundled   = แถวชุดที่ถูกแตกเป็นชิ้นส่วน [{ platform, sku: รหัสชุด, quantity: จำนวนชุด, items: [{ productId, quantity }] }]
//               sources = [{ platform, sku: รหัสใน PDF, bundle: รหัสชุด | null, bundleQty: จำนวนชุด, quantity: จำนวนสินค้านี้, orders }]
//   orders    = [{ platform, order_no, sku }] คำสั่งซื้อที่จะบันทึกว่าเบิกแล้ว (เฉพาะแถวที่เบิกได้)
//   unmatched = แถวที่เบิกไม่ได้ [{ platform, sku, quantity, orders, reason }]
//   skipped   = แถวที่ทุกคำสั่งซื้อเคยเบิกแล้ว (หรือซ้ำกับไฟล์อื่นที่เลือกมาพร้อมกัน)
// partial = บางคำสั่งซื้อในแถวเคยเบิกแล้ว (Shopee รวมจำนวนหลายคำสั่งซื้อไว้แถวเดียว แยกจำนวนไม่ได้ ให้ผู้ใช้ตรวจจำนวนเอง)
export function planPdfIssue(files, products, issuedKeys = new Set(), bundles = []) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const bySku = new Map()
  for (const product of products) {
    bySku.set(normalizeSku(product.sku), product)
  }
  for (const product of products) {
    const legacy = normalizeSku(product.legacySku)
    if (legacy && !bySku.has(legacy)) bySku.set(legacy, product)
  }
  const bundleBySku = new Map(bundles.map((b) => [normalizeSku(b.sku), b]))

  const seen = new Set(issuedKeys)
  const lineByProduct = new Map()
  const orders = []
  const unmatched = []
  const skipped = []
  const bundled = []

  for (const file of files) {
    for (const row of file.rows) {
      const source = { platform: file.platform, sku: row.sku, quantity: row.quantity, orders: row.orders }
      const stocked = bySku.get(normalizeSku(row.sku))
      const bundle = stocked && stocked.onHand > 0 ? null : bundleBySku.get(normalizeSku(row.sku))
      const product = bundle ? null : stocked
      if (!bundle && !product) {
        const reason = looksLikeBundle(row.sku) ? UNMATCHED_REASON.BUNDLE_NOT_SET : UNMATCHED_REASON.NO_PRODUCT
        unmatched.push({ ...source, reason })
        continue
      }
      // ชุดที่มีชิ้นส่วนถูกปิดใช้งาน เบิกไม่ได้ทั้งชุด (กันเบิกไม่ครบชุด)
      if (bundle && (bundle.items.length === 0 || bundle.items.some((item) => !byId.has(item.productId)))) {
        unmatched.push({ ...source, reason: UNMATCHED_REASON.BUNDLE_INACTIVE })
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

      const parts = bundle
        ? bundle.items.map((item) => ({ productId: item.productId, quantity: row.quantity * item.quantity }))
        : [{ productId: product.id, quantity: row.quantity }]
      if (bundle) bundled.push({ platform: file.platform, sku: bundle.sku, quantity: row.quantity, items: parts })
      for (const part of parts) {
        const line = lineByProduct.get(part.productId) ?? { productId: part.productId, quantity: 0, sources: [], partial: false, fromBundle: false }
        line.quantity += part.quantity
        if (bundle) line.fromBundle = true
        line.sources.push({
          platform: file.platform,
          sku: row.sku,
          bundle: bundle ? bundle.sku : null,
          bundleQty: row.quantity,
          quantity: part.quantity,
          orders: fresh,
        })
        if (fresh.length < row.orders.length) line.partial = true
        lineByProduct.set(part.productId, line)
      }
    }
  }

  const skuOf = (line) => byId.get(line.productId)?.sku ?? ''
  // กลุ่มชุด: รหัสชุดแรกของสินค้านั้น และสินค้าหลัก (รหัสชุดขึ้นต้นด้วยรหัสสินค้า) ขึ้นก่อนชิ้นส่วนในชุดเดียวกัน
  const firstBundle = (line) => line.sources.map((s) => s.bundle).filter(Boolean).toSorted()[0] ?? ''
  const isMain = (line) => {
    const bundleSku = normalizeSku(firstBundle(line))
    return bundleSku !== '' && bundleSku.startsWith(`${normalizeSku(skuOf(line))}-`)
  }
  const lines = [...lineByProduct.values()].toSorted(
    (a, b) =>
      Number(b.fromBundle) - Number(a.fromBundle) ||
      firstBundle(a).localeCompare(firstBundle(b), 'th') ||
      Number(isMain(b)) - Number(isMain(a)) ||
      skuOf(a).localeCompare(skuOf(b), 'th'),
  )
  return { lines, orders, unmatched, skipped, bundled }
}

// หมายเหตุของแต่ละสินค้า: "ออนไลน์" หรือ "ออนไลน์ (ชุด GL-203R-P1, …)" เมื่อมาจากชุด (ไม่เกิน ISSUE_NOTE_MAX ตัวอักษร)
export function lineNote(line) {
  const names = [...new Set(line.sources.filter((s) => s.bundle).map((s) => s.bundle))]
  if (names.length === 0) return PDF_ISSUE_NOTE
  const note = `${PDF_ISSUE_NOTE} (ชุด ${names.join(', ')})`
  return note.length <= ISSUE_NOTE_MAX ? note : `${note.slice(0, ISSUE_NOTE_MAX - 2)}…)`
}

// คำสั่งซื้อของสินค้าที่ยังอยู่ในใบ (ไม่ซ้ำ) แถวชุดที่เอาชิ้นส่วนออกบางตัว ยังนับคำสั่งซื้อจากชิ้นส่วนที่เหลือ
export function ordersOfLines(lines) {
  const seen = new Set()
  const out = []
  for (const line of lines) {
    for (const s of line.sources) {
      for (const orderNo of s.orders) {
        const key = orderKey(s.platform, orderNo, s.sku)
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ platform: s.platform, order_no: orderNo, sku: s.sku })
      }
    }
  }
  return out
}

// ตรวจจำนวนก่อนส่ง (จำนวนแก้ได้ในหน้าต่าง quantities = { [productId]: ข้อความจำนวน })
// คืน { moves, errors } แบบเดียวกับ planBulkIssue
export function checkPdfIssue(lines, quantities, products, role, today) {
  const rows = lines.map((line) => ({
    productId: line.productId,
    quantity: quantities[line.productId] ?? String(line.quantity),
    note: lineNote(line),
  }))
  return planBulkIssue(rows, products, role, today)
}
