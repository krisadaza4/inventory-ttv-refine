import { PERIOD, periodOf } from './dayPeriod.js'
import { MOVEMENT_TYPE } from './stockRules.js'

// สรุปการเบิกออกช่วงเช้า-บ่าย: รวมจำนวนต่อสินค้า (และต่อผู้บันทึกถ้า byRecorder)
// คืน { rows, total } rows เรียงตามรหัสสินค้า แล้วชื่อผู้บันทึก
// total = ผลรวมทุกแถว เฉพาะเมื่อทุกสินค้าใช้หน่วยเดียวกัน (หน่วยต่างกันบวกกันไม่มีความหมาย) ไม่งั้น null
export function summarizeIssues(movements, { byRecorder = false } = {}) {
  const groups = new Map()
  for (const m of movements) {
    if (m.type !== MOVEMENT_TYPE.OUT) continue
    const period = periodOf(m.createdAt)
    if (!period) continue
    const recorder = byRecorder ? m.recordedByName || '—' : ''
    const key = `${m.productId}\u0000${recorder}`
    let row = groups.get(key)
    if (!row) {
      row = {
        key,
        productId: m.productId,
        sku: m.productSku,
        name: m.productName,
        unit: m.unit,
        recorder,
        morning: 0,
        afternoon: 0,
        total: 0,
      }
      groups.set(key, row)
    }
    const qty = Number(m.quantity) || 0
    if (period === PERIOD.MORNING) row.morning += qty
    else row.afternoon += qty
    row.total += qty
  }
  const rows = [...groups.values()].sort(
    (a, b) => a.sku.localeCompare(b.sku, 'th') || a.recorder.localeCompare(b.recorder, 'th'),
  )
  const units = new Set(rows.map((r) => r.unit))
  const total =
    rows.length > 0 && units.size === 1
      ? rows.reduce(
          (sum, r) => ({
            unit: r.unit,
            morning: sum.morning + r.morning,
            afternoon: sum.afternoon + r.afternoon,
            total: sum.total + r.total,
          }),
          { unit: '', morning: 0, afternoon: 0, total: 0 },
        )
      : null
  return { rows, total }
}
