// คอลัมน์ที่อ่าน (แถวฐานข้อมูลเป็น snake_case, ในแอปเป็น camelCase)
export const PRODUCT_COLUMNS = 'id, sku, barcode, name, category, unit, reorder_point, active, on_hand'
export const MOVEMENT_COLUMNS =
  'id, product_id, type, quantity, movement_date, note, created_by, created_at, ' +
  'product:products(name, sku, unit), recorder:profiles(display_name)'
export const PROFILE_COLUMNS = 'id, display_name, role'

const trimText = (value) => String(value ?? '').trim()

// numeric จาก Supabase อาจมาเป็นข้อความ
const toNumber = (value) => (trimText(value) === '' ? 0 : Number(value))

// แถวจาก view product_stock
export function toProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    unit: row.unit,
    reorderPoint: toNumber(row.reorder_point),
    active: row.active,
    onHand: toNumber(row.on_hand),
  }
}

// ส่งเฉพาะคอลัมน์ที่ grant insert/update ไว้ (ไม่มี id, created_at, updated_at)
// active เปลี่ยนผ่าน setProductActive เท่านั้น
export function toProductRow(product) {
  const barcode = trimText(product.barcode)
  return {
    sku: trimText(product.sku),
    barcode: barcode || null,
    name: trimText(product.name),
    category: trimText(product.category),
    unit: trimText(product.unit),
    reorder_point: toNumber(product.reorderPoint),
  }
}

// แถวจาก record_movement ไม่มี product/recorder ที่ join มา
export function toMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: toNumber(row.quantity),
    movementDate: row.movement_date,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    productName: row.product?.name ?? '',
    productSku: row.product?.sku ?? '',
    unit: row.product?.unit ?? '',
    recordedByName: row.recorder?.display_name ?? '',
  }
}

export function toProfile(row) {
  if (!row) return null
  return { id: row.id, displayName: row.display_name, role: row.role }
}
