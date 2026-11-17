import { MOVEMENT_TYPE, validateMovement } from './stockRules.js'

// หมายเหตุของการเบิกหลายรายการ: เลือกจากรายการนี้เท่านั้น (ผู้ใช้กำหนด 2026-11-17)
export const ISSUE_NOTE_OPTIONS = ['ออนไลน์', 'ขายส่ง']

// ตรวจรายการเบิกหลายรายการก่อนส่ง (ฐานข้อมูลตรวจซ้ำอีกชั้น)
// rows = [{ productId, quantity: ข้อความจำนวน, note }] คืน
//   moves  = รายการที่ผ่านทั้งหมด [{ productId, type: 'out', quantity, note }]
//   errors = { [productId]: { quantity?, note? } } ว่าง = ผ่านทุกรายการ
// จำนวนว่างถือว่ายังไม่ได้กรอก (เป็นข้อผิดพลาด ไม่ข้ามเงียบ ๆ เพราะแถวถูกเลือกมาแล้ว)
export function planBulkIssue(rows, products, role, today) {
  const moves = []
  const errors = {}
  for (const row of rows) {
    const product = products.find((p) => p.id === row.productId)
    if (!product) continue
    const text = String(row.quantity ?? '').trim()
    const found = {}
    if (text === '') {
      found.quantity = 'กรุณาใส่จำนวนที่เบิก'
    } else {
      const movement = { type: MOVEMENT_TYPE.OUT, quantity: text, movementDate: today, note: row.note }
      const checked = validateMovement(movement, product, role, today)
      if (checked.type) found.quantity = checked.type
      else if (checked.quantity) found.quantity = checked.quantity
    }
    if (!ISSUE_NOTE_OPTIONS.includes(row.note)) found.note = 'เลือกหมายเหตุ'
    if (Object.keys(found).length > 0) errors[row.productId] = found
    else moves.push({ productId: row.productId, type: MOVEMENT_TYPE.OUT, quantity: text, note: row.note })
  }
  return { moves, errors }
}
