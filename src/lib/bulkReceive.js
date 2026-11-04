import { MOVEMENT_TYPE, validateMovement } from './stockRules.js'

// รับเข้าหลายรายการในครั้งเดียว: quantities = { [productId]: ข้อความจำนวน } ช่องว่างข้าม
// ตรวจทีละรายการด้วยกติกาเดียวกับหน้ารับ-เบิก คืน { moves: [{ productId, quantity }], errors: { [productId]: ข้อความ } }
export function planBulkReceive(quantities, products, role, today) {
  const moves = []
  const errors = {}
  for (const [productId, text] of Object.entries(quantities)) {
    if (String(text ?? '').trim() === '') continue
    const product = products.find((p) => p.id === productId)
    if (!product) continue
    const movement = { type: MOVEMENT_TYPE.IN, quantity: text, movementDate: today, note: '' }
    const found = validateMovement(movement, product, role, today)
    if (found.quantity) errors[productId] = found.quantity
    else moves.push({ productId, quantity: String(text).trim() })
  }
  return { moves, errors }
}
