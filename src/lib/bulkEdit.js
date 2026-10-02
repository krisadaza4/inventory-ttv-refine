// แก้สินค้าทีละหลายรายการ (admin): ตั้งจุดสั่งซื้อจากยอดขายเฉลี่ย และตั้งหมวดหมู่ให้รายการที่เลือก

// จำนวนเดือนที่ต้องมีของสำรอง (ช่วงเวลาสั่งผลิต) ค่าเริ่มต้น 3.4 เดือนตามที่ร้านใช้
export const DEFAULT_COVER_MONTHS = 3.4
export const MAX_COVER_MONTHS = 24

// จำนวนเดือนที่พิมพ์: มากกว่า 0 ไม่เกิน MAX_COVER_MONTHS ทศนิยมไม่เกิน 1 ตำแหน่ง ไม่ถูกต้อง คืน null
export function parseCoverMonths(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(\.\d)?$/.test(text)) return null
  const months = Number(text)
  return months > 0 && months <= MAX_COVER_MONTHS ? months : null
}

// จุดสั่งซื้อที่แนะนำ = ขายเฉลี่ย/เดือน × จำนวนเดือน ปัดขึ้นเป็นจำนวนเต็ม ไม่มียอดขายเฉลี่ย คืน null
export function suggestReorderPoint(avgMonthlySales, months) {
  if (avgMonthlySales === null || avgMonthlySales === undefined) return null
  const avg = Number(avgMonthlySales)
  if (!Number.isFinite(avg) || avg < 0) return null
  // ปัดเศษทศนิยมจากการคูณก่อน (เช่น 0.1 × 3 = 0.30000000000000004) ไม่ให้ปัดขึ้นเกิน
  return Math.ceil(Math.round(avg * months * 100) / 100)
}

// รายการที่จะเปลี่ยน [{ product, current, next }] เฉพาะสินค้าที่เปิดใช้งาน มียอดขายเฉลี่ย และค่าใหม่ต่างจากเดิม
// onlyUnset = เฉพาะสินค้าที่จุดสั่งซื้อยังเป็น 0 (ไม่ทับค่าที่ตั้งเองไว้แล้ว)
export function planReorderPoints(products, months, { onlyUnset = true } = {}) {
  const plan = []
  for (const product of products) {
    if (!product.active) continue
    const current = Number(product.reorderPoint ?? 0)
    if (onlyUnset && current !== 0) continue
    const next = suggestReorderPoint(product.avgMonthlySales, months)
    if (next === null || next === current) continue
    plan.push({ product, current, next })
  }
  return plan.sort((a, b) => a.product.sku.localeCompare(b.product.sku, 'th'))
}

// รวม id ที่ได้ค่าเดียวกัน เพื่อบันทึกครั้งเดียวต่อค่า [{ value, ids }]
export function groupIdsByValue(changes) {
  const groups = new Map()
  for (const { id, value } of changes) {
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(id)
  }
  return [...groups].map(([value, ids]) => ({ value, ids }))
}
