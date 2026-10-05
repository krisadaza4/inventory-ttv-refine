import { validateMovement } from './stockRules.js'

// คลังย่อย: คลังใหญ่ = สินค้าคงคลังเดิม (ไม่มีแถวในตาราง warehouses) คลังย่อย = Online / ขายส่ง / อะไหล่ …
// ยอดคลังใหญ่ = ของดีรวม (onHand) - ของดีในคลังย่อยทั้งหมด (subQty)
// คลังย่อยขายได้ = ยอดในคลังนั้น + คลังใหญ่ (ขายแล้วตัดคลังย่อยก่อน ส่วนที่ขาดตัดคลังใหญ่)

// ค่าตัวกรอง "คลังใหญ่" ในหน้าประวัติ
export const CENTRAL = 'central'

const toAmount = (value) => Math.round(Number(value) * 100) / 100

// คลังที่ใช้งานอยู่ เรียงตามลำดับที่ตั้งไว้ แล้วตามชื่อ
export function activeWarehouses(warehouses) {
  return warehouses
    .filter((w) => w.active)
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'th'))
}

// เติมข้อมูลคลังให้สินค้า
// links = [{ productId, warehouseId }] (ผูกไว้), stockRows = [{ warehouseId, productId, quantity }]
// warehouseQty = { [warehouseId]: ยอด }, warehouseIds = คลังที่ผูกไว้หรือยังมียอดค้าง
export function attachWarehouses(products, links, stockRows) {
  const qtyByProduct = new Map()
  const idsByProduct = new Map()
  const add = (productId, warehouseId) => {
    if (!idsByProduct.has(productId)) idsByProduct.set(productId, new Set())
    idsByProduct.get(productId).add(warehouseId)
  }
  for (const link of links) add(link.productId, link.warehouseId)
  for (const row of stockRows) {
    const quantity = toAmount(row.quantity)
    if (!qtyByProduct.has(row.productId)) qtyByProduct.set(row.productId, {})
    qtyByProduct.get(row.productId)[row.warehouseId] = quantity
    if (quantity !== 0) add(row.productId, row.warehouseId)
  }
  return products.map((p) => ({
    ...p,
    centralQty: toAmount((p.onHand ?? 0) - (p.subQty ?? 0)),
    warehouseQty: qtyByProduct.get(p.id) ?? {},
    warehouseIds: [...(idsByProduct.get(p.id) ?? [])],
  }))
}

// ยอดของสินค้าในคลังย่อย (ไม่เคยมีรายการ = 0)
export function quantityIn(product, warehouseId) {
  return toAmount(product.warehouseQty?.[warehouseId] ?? 0)
}

// สินค้าที่แสดงในคลังย่อย พร้อม inWarehouse (ยอดในคลังนี้) และ sellable (ขายได้ = ในคลังนี้ + คลังใหญ่)
export function productsInWarehouse(products, warehouseId) {
  return products
    .filter((p) => p.warehouseIds?.includes(warehouseId))
    .map((p) => {
      const inWarehouse = quantityIn(p, warehouseId)
      return { ...p, inWarehouse, sellable: toAmount(inWarehouse + (p.centralQty ?? p.onHand)) }
    })
}

// ยอดที่ใช้ตรวจ validateMovement / stockAfter ('' = คลังใหญ่)
export function stockFor(product, warehouseId) {
  return {
    onHand: product.onHand,
    repairQty: product.repairQty,
    subQty: product.subQty ?? 0,
    warehouseQty: warehouseId ? quantityIn(product, warehouseId) : 0,
  }
}

// ตรวจชื่อคลังก่อนบันทึก คืนข้อความผิดพลาด หรือ null
export function validateWarehouseName(name, warehouses, editingId = null) {
  const text = String(name ?? '').trim()
  if (!text) return 'กรุณาพิมพ์ชื่อคลัง'
  if (text === 'คลังใหญ่' || text === 'สินค้าคงคลัง') return 'ชื่อนี้ใช้กับคลังใหญ่แล้ว'
  const same = warehouses.find((w) => w.id !== editingId && w.name.trim().toLowerCase() === text.toLowerCase())
  return same ? 'ชื่อคลังนี้มีอยู่แล้ว' : null
}

// ลำดับถัดไปสำหรับคลังใหม่ (ต่อท้าย)
export function nextSortOrder(warehouses) {
  return warehouses.reduce((max, w) => Math.max(max, w.sortOrder), 0) + 1
}

// บันทึกหลายรายการในครั้งเดียว: รับเข้าคลังใหญ่ (type = in, warehouseId = '') หรือโอนเข้าคลังย่อย (transfer_in)
// quantities = { [productId]: ข้อความจำนวน } ช่องว่างข้าม
// ตรวจทีละรายการด้วยกติกาเดียวกับหน้ารับ-เบิก คืน { moves: [{ productId, quantity }], errors: { [productId]: ข้อความ } }
export function planBulkMovements(quantities, products, { type, warehouseId = '' }, role, today) {
  const moves = []
  const errors = {}
  for (const [productId, text] of Object.entries(quantities)) {
    if (String(text ?? '').trim() === '') continue
    const product = products.find((p) => p.id === productId)
    if (!product) continue
    const movement = { type, quantity: text, movementDate: today, note: '', warehouseId }
    const found = validateMovement(movement, stockFor(product, warehouseId), role, today)
    if (found.quantity) errors[productId] = found.quantity
    else moves.push({ productId, quantity: String(text).trim() })
  }
  return { moves, errors }
}

// ปีที่มีรายการเบิกออก (ค.ศ.) ล่าสุดก่อน รวมปีปัจจุบันเสมอ
export function outYears(movements, currentYear) {
  const years = new Set([currentYear])
  for (const m of movements) if (m.type === 'out') years.add(Number(m.movementDate.slice(0, 4)))
  return [...years].toSorted((a, b) => b - a)
}

// ยอดขาย/เบิกออกจากประวัติ แยกตามคลัง รายเดือน (year เป็น ค.ศ.)
// คลังใหญ่ = เบิกออกที่ไม่ระบุคลัง, ขายผ่านคลังย่อยนับเต็มจำนวนให้คลังนั้น (แม้ตัดของจากคลังใหญ่บางส่วน)
// warehouses รวมที่ปิดใช้งาน: แสดงคลังที่ใช้งานอยู่เสมอ ที่ปิดแล้วแสดงเมื่อมียอด
// คืน { rows: [{ id, name, months[12], total }], totals: { months[12], total } }
export function salesByWarehouse(movements, warehouses, year) {
  const rows = [
    { id: '', name: 'คลังใหญ่', active: true, months: Array(12).fill(0) },
    ...activeWarehouses(warehouses).map((w) => ({ id: w.id, name: w.name, active: true, months: Array(12).fill(0) })),
  ]
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const m of movements) {
    if (m.type !== 'out' || Number(m.movementDate.slice(0, 4)) !== year) continue
    const id = m.warehouseId ?? ''
    if (!byId.has(id)) {
      const known = warehouses.find((w) => w.id === id)
      const row = { id, name: known?.name ?? m.warehouseName ?? 'คลังย่อย', active: false, months: Array(12).fill(0) }
      rows.push(row)
      byId.set(id, row)
    }
    byId.get(id).months[Number(m.movementDate.slice(5, 7)) - 1] += Number(m.quantity)
  }
  const done = rows.map((r) => {
    const months = r.months.map(toAmount)
    return { id: r.id, name: r.name, months, total: toAmount(months.reduce((sum, q) => sum + q, 0)) }
  })
  const months = Array.from({ length: 12 }, (_, i) => toAmount(done.reduce((sum, r) => sum + r.months[i], 0)))
  return { rows: done, totals: { months, total: toAmount(months.reduce((sum, q) => sum + q, 0)) } }
}

// ช่องติ๊กคลังย่อยในฟอร์มสินค้า: คลังที่ต้องเพิ่มและเอาออก เทียบกับค่าเดิม
export function warehouseChanges(initialIds, checkedIds) {
  const before = new Set(initialIds)
  const after = new Set(checkedIds)
  return {
    add: [...after].filter((id) => !before.has(id)),
    remove: [...before].filter((id) => !after.has(id)),
  }
}
