import { STOCK_STATUS, getStockStatus } from './stockRules.js'

// สรุปสินค้าใกล้หมด (การ์ด + บันทึกเป็นรูปภาพ) ผู้ใช้กำหนด 2026-11-27:
// ใกล้หมด = คงเหลือ ≤ จุดสั่งซื้อ (เกณฑ์เดียวกับป้ายสถานะ) สินค้าหมดแล้ว (0) รวมได้ด้วยสวิตช์ ค่าเริ่มต้นไม่รวม
// ไม่แสดง "พอขายอีกกี่วัน" (ผู้ใช้ไม่เอา)

// สัดส่วนคงเหลือต่อจุดสั่งซื้อ 0–1 (ใช้วาดแถบ และเรียงความเร่งด่วน)
export function stockRatio(product) {
  const reorder = Number(product.reorderPoint) || 0
  if (reorder <= 0) return product.onHand > 0 ? 1 : 0
  return Math.max(0, Math.min(1, product.onHand / reorder))
}

// products = สินค้าที่เปิดใช้งาน
// คืน { items: สินค้าที่จะแสดง เรียงเร่งด่วนก่อน, low: จำนวนใกล้หมด, out: จำนวนหมด, total: สินค้าทั้งหมด (ตามหมวดที่เลือก) }
// เรียง: หมดก่อน → สัดส่วนคงเหลือ/จุดสั่งซื้อน้อยก่อน → คงเหลือน้อยก่อน → รหัส
export function selectLowStock(products, { category = '', includeOut = false } = {}) {
  const inCategory = category ? products.filter((p) => p.category === category) : products
  const withStatus = inCategory.map((p) => ({ product: p, status: getStockStatus(p.onHand, p.reorderPoint) }))
  const low = withStatus.filter((x) => x.status === STOCK_STATUS.LOW)
  const out = withStatus.filter((x) => x.status === STOCK_STATUS.OUT)
  const shown = includeOut ? [...out, ...low] : low
  const items = shown
    .toSorted(
      (a, b) =>
        Number(b.status === STOCK_STATUS.OUT) - Number(a.status === STOCK_STATUS.OUT) ||
        stockRatio(a.product) - stockRatio(b.product) ||
        a.product.onHand - b.product.onHand ||
        a.product.sku.localeCompare(b.product.sku, 'th'),
    )
    .map((x) => ({ ...x.product, status: x.status }))
  return { items, low: low.length, out: out.length, total: inCategory.length }
}

export function lowStockFileName(today, ext) {
  return `inventory-low-stock-${today}.${ext}`
}
