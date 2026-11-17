import { MOVEMENT_TYPE, validateMovement } from './stockRules.js'

// หมายเหตุของการเบิกหลายรายการ: ช่องพิมพ์ช่องเดียว ไม่บังคับกรอก มีลูกศรให้เลือก "ขายส่ง" ได้ (ผู้ใช้กำหนด 2026-11-17)
export const ISSUE_NOTE_OPTIONS = ['ขายส่ง']
export const ISSUE_NOTE_MAX = 200

// ตรวจรายการเบิกหลายรายการก่อนส่ง (ฐานข้อมูลตรวจซ้ำอีกชั้น)
// rows = [{ productId, quantity: ข้อความจำนวน, note: ข้อความหมายเหตุ (ว่างได้) }] คืน
//   moves  = รายการที่ผ่านทั้งหมด [{ productId, type: 'out', quantity, note: หมายเหตุที่ตัดช่องว่างหัวท้ายแล้ว ('' = ไม่มี) }]
//   errors = { [productId]: { quantity?, note? } } ว่าง = ผ่านทุกรายการ
// จำนวนว่างถือว่ายังไม่ได้กรอก (เป็นข้อผิดพลาด ไม่ข้ามเงียบ ๆ เพราะแถวถูกเลือกมาแล้ว)
export function planBulkIssue(rows, products, role, today) {
  const moves = []
  const errors = {}
  for (const row of rows) {
    const product = products.find((p) => p.id === row.productId)
    if (!product) continue
    const found = {}

    const note = String(row.note ?? '').trim()
    if (note.length > ISSUE_NOTE_MAX) found.note = `หมายเหตุยาวเกิน ${ISSUE_NOTE_MAX} ตัวอักษร`

    const text = String(row.quantity ?? '').trim()
    if (text === '') {
      found.quantity = 'กรุณาใส่จำนวนที่เบิก'
    } else {
      const movement = { type: MOVEMENT_TYPE.OUT, quantity: text, movementDate: today, note }
      const checked = validateMovement(movement, product, role, today)
      if (checked.type) found.quantity = checked.type
      else if (checked.quantity) found.quantity = checked.quantity
    }

    if (Object.keys(found).length > 0) errors[row.productId] = found
    else moves.push({ productId: row.productId, type: MOVEMENT_TYPE.OUT, quantity: text, note })
  }
  return { moves, errors }
}
