// คอลัมน์ที่อ่าน (แถวฐานข้อมูลเป็น snake_case, ในแอปเป็น camelCase)
export const PRODUCT_COLUMNS = 'id, sku, barcode, name, category, unit, reorder_point, active, on_hand, image_path, location, avg_monthly_sales, repair_qty, legacy_sku'
export const MOVEMENT_COLUMNS =
  'id, product_id, type, quantity, movement_date, note, created_by, created_at, ' +
  'product:products(name, sku, unit), recorder:profiles(display_name)'
export const PROFILE_COLUMNS = 'id, display_name, role'
export const MONTHLY_SALES_COLUMNS = 'product_id, year, month, quantity'

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
    // on_hand = ของดี (เบิกได้), repair_qty = รอซ่อม
    onHand: toNumber(row.on_hand),
    repairQty: toNumber(row.repair_qty),
    // รหัสเดิมก่อนแก้ชื่อ (ใช้จับคู่ตอนนำเข้าไฟล์สต็อก) ไม่มี = ''
    legacySku: row.legacy_sku ?? '',
    // ที่อยู่ไฟล์ใน bucket product-images (null = ไม่มีรูป) ใช้ signImageUrls แปลงเป็นลิงก์
    imagePath: row.image_path ?? null,
    location: row.location ?? '',
    // ยอดขายเฉลี่ย/เดือนจากไฟล์สต็อก (null = ไม่มีข้อมูล)
    avgMonthlySales: trimText(row.avg_monthly_sales) === '' ? null : Number(row.avg_monthly_sales),
  }
}

// ส่งเฉพาะคอลัมน์ที่ grant insert/update ไว้ (ไม่มี id, created_at, updated_at)
// active เปลี่ยนผ่าน setProductActive เท่านั้น
export function toProductRow(product) {
  const barcode = trimText(product.barcode)
  const location = trimText(product.location)
  return {
    sku: trimText(product.sku),
    barcode: barcode || null,
    name: trimText(product.name),
    category: trimText(product.category),
    unit: trimText(product.unit),
    reorder_point: toNumber(product.reorderPoint),
    location: location || null,
    // ฟอร์มสินค้าไม่มีช่องนี้: ไม่ส่งมา = ไม่แก้ค่าเดิม
    ...(product.avgMonthlySales === undefined
      ? {}
      : { avg_monthly_sales: product.avgMonthlySales === null ? null : toNumber(product.avgMonthlySales) }),
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

// แถวจาก product_monthly_sales (year เป็น ค.ศ.)
export function toMonthlySale(row) {
  return {
    productId: row.product_id,
    year: Number(row.year),
    month: Number(row.month),
    quantity: toNumber(row.quantity),
  }
}

export function toMonthlySaleRow(sale) {
  return {
    product_id: sale.productId,
    year: sale.year,
    month: sale.month,
    quantity: toNumber(sale.quantity),
    updated_at: new Date().toISOString(),
  }
}
