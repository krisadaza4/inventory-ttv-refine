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
