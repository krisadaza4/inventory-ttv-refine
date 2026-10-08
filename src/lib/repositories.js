import {
  MONTHLY_SALES_COLUMNS,
  MOVEMENT_COLUMNS,
  PRODUCT_COLUMNS,
  PROFILE_COLUMNS,
  WAREHOUSE_COLUMNS,
  toMonthlySale,
  toMonthlySaleRow,
  toMovement,
  toProduct,
  toProductRow,
  toProfile,
  toWarehouse,
  toWarehouseRow,
} from './mappers.js'
import { groupIdsByValue } from './bulkEdit.js'
import { IMAGE_BUCKET, IMAGE_URL_TTL, LOGO_PATH, imagePathFor } from './productImages.js'
import { REPAIR_FILTER, REPAIR_TYPES } from './stockRules.js'
import { ERROR_MESSAGE, toThaiError } from './supabaseErrors.js'
import { CENTRAL } from './warehouses.js'

export const PAGE_SIZE = 50
// ส่งออก Excel: ดึงทีละ 1000 แถว (ค่าสูงสุดต่อครั้งของ Supabase) กันไฟล์ใหญ่เกินด้วย EXPORT_MAX_ROWS
export const EXPORT_PAGE_SIZE = 1000
export const EXPORT_MAX_ROWS = 50000
// นำเข้าสินค้าจาก Excel: บันทึกทีละชุด ไม่ส่งทีละรายการ
export const IMPORT_BATCH_SIZE = 500

// รันคำสั่ง Supabase แล้วคืน { data, error } เสมอ error เป็นข้อความไทย ไม่โยนต่อ
async function run(buildQuery) {
  try {
    const { data, error } = await buildQuery()
    return { data, error: toThaiError(error) }
  } catch (thrown) {
    return { data: null, error: toThaiError(thrown) }
  }
}

// แก้หลายรายการ: ส่ง id ทีละ UPDATE_BATCH_SIZE (id อยู่ใน URL ห้ามยาวเกิน)
export const UPDATE_BATCH_SIZE = 100

// update แถวตาม id แล้วนับแถวที่บันทึกได้จริง RLS กรองแถวออกเงียบ ๆ จึงถือว่าไม่ครบ = ไม่มีสิทธิ์
async function updateByIds(client, ids, row) {
  let updated = 0
  for (let i = 0; i < ids.length; i += UPDATE_BATCH_SIZE) {
    const batch = ids.slice(i, i + UPDATE_BATCH_SIZE)
    const { data, error } = await run(() => client.from('products').update(row).in('id', batch).select('id'))
    if (error) return { updated, error }
    updated += data.length
    if (data.length < batch.length) return { updated, error: ERROR_MESSAGE.NOT_FOUND }
  }
  return { updated, error: null }
}

// ดึงทุกแถวทีละ EXPORT_PAGE_SIZE build(from, to) คืนคำสั่งที่เรียงแน่นอนแล้ว
async function fetchAll(build) {
  const all = []
  for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await run(() => build(from, from + EXPORT_PAGE_SIZE - 1))
    if (error) return { rows: [], error }
    all.push(...data)
    if (data.length < EXPORT_PAGE_SIZE) break
  }
  return { rows: all, error: null }
}

// ตัวกรองคลังในหน้าประวัติ: CENTRAL = คลังใหญ่ (ไม่มีคลังย่อย), id = คลังย่อยนั้น
const filterWarehouse = (query, warehouse) => {
  if (!warehouse) return query
  return warehouse === CENTRAL ? query.is('warehouse_id', null) : query.eq('warehouse_id', warehouse)
}

// ตัวกรองประเภทในหน้าประวัติ: REPAIR_FILTER = ส่งซ่อม/ซ่อมเสร็จ/ตัดจำหน่าย รวมกัน
const filterType = (query, type) => {
  if (!type) return query
  return type === REPAIR_FILTER ? query.in('type', REPAIR_TYPES) : query.eq('type', type)
}

// client รับเป็นพารามิเตอร์ เพื่อให้ทดสอบด้วย client จำลองได้
// ตั้งใจไม่มีฟังก์ชันลบข้อมูลหลัก (ลบได้เฉพาะการผูกสินค้ากับคลังย่อย) และบันทึกรายการเคลื่อนไหวผ่าน record_movement เท่านั้น
export function createRepository(client) {
  return {
    // ดึงทีละ EXPORT_PAGE_SIZE เพราะ Supabase คืนได้สูงสุด 1000 แถวต่อครั้ง (เรียงด้วย id ด้วยให้แบ่งหน้าได้แน่นอน)
    async listProducts({ includeInactive = false } = {}) {
      const all = []
      for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_PAGE_SIZE) {
        const { data, error } = await run(() => {
          let query = client.from('product_stock').select(PRODUCT_COLUMNS)
          if (!includeInactive) query = query.eq('active', true)
          return query
            .order('name', { ascending: true })
            .order('id', { ascending: true })
            .range(from, from + EXPORT_PAGE_SIZE - 1)
        })
        if (error) return { products: [], error }
        all.push(...data.map(toProduct))
        if (data.length < EXPORT_PAGE_SIZE) break
      }
      return { products: all, error: null }
    },

    // ไม่มี id = เพิ่มใหม่, มี id = แก้ไข คืน id ของสินค้า (หน้าจอโหลดรายการใหม่เพื่อได้คงเหลือ)
    async saveProduct(product) {
      const row = toProductRow(product)
      const { data, error } = await run(() => {
        const table = client.from('products')
        const query = product.id ? table.update(row).eq('id', product.id) : table.insert(row)
        return query.select('id').single()
      })
      return { id: error ? null : data.id, error }
    },

    // เพิ่มสินค้าหลายรายการ (นำเข้าจาก Excel) ชุดไหนผิดพลาดหยุดทันที ชุดก่อนหน้าบันทึกไปแล้ว
    // นำเข้าซ้ำได้: หน้าจอกรองรหัสที่มีอยู่แล้วออกก่อนเสมอ
    async insertProducts(products) {
      let inserted = 0
      for (let i = 0; i < products.length; i += IMPORT_BATCH_SIZE) {
        const batch = products.slice(i, i + IMPORT_BATCH_SIZE)
        const { error } = await run(() => client.from('products').insert(batch.map(toProductRow)))
        if (error) return { inserted, error }
        inserted += batch.length
      }
      return { inserted, error: null }
    },

    // รูปสินค้า (admin): อัปโหลดไฟล์ใหม่ → บันทึก image_path → ลบรูปเก่า
    // บันทึก image_path ไม่สำเร็จ ลบไฟล์ที่เพิ่งอัปโหลด ไม่ให้มีไฟล์ค้างใน bucket
    async uploadProductImage(product, blob) {
      const bucket = client.storage.from(IMAGE_BUCKET)
      const path = imagePathFor(product.id)
      const uploaded = await run(() => bucket.upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      if (uploaded.error) return { imagePath: null, error: uploaded.error }

      const { error } = await run(() =>
        client.from('products').update({ image_path: path }).eq('id', product.id).select('id').single(),
      )
      if (error) {
        await run(() => bucket.remove([path]))
        return { imagePath: null, error }
      }
      if (product.imagePath) await run(() => bucket.remove([product.imagePath]))
      return { imagePath: path, error: null }
    },

    async removeProductImage(product) {
      const { error } = await run(() =>
        client.from('products').update({ image_path: null }).eq('id', product.id).select('id').single(),
      )
      if (error) return { error }
      if (product.imagePath) await run(() => client.storage.from(IMAGE_BUCKET).remove([product.imagePath]))
      return { error: null }
    },

    // bucket เป็นแบบส่วนตัว: ขอลิงก์ชั่วคราวทีเดียวหลายรูป คืน { [path]: url } รูปที่ขอไม่ได้จะไม่มีในผล
    async signImageUrls(paths) {
      const urls = {}
      for (let i = 0; i < paths.length; i += IMPORT_BATCH_SIZE) {
        const batch = paths.slice(i, i + IMPORT_BATCH_SIZE)
        const { data, error } = await run(() => client.storage.from(IMAGE_BUCKET).createSignedUrls(batch, IMAGE_URL_TTL))
        if (error) return { urls, error }
        for (const item of data) if (item.signedUrl && !item.error) urls[item.path] = item.signedUrl
      }
      return { urls, error: null }
    },

    // โลโก้ร้าน: ยังไม่เคยตั้ง (ไม่มีไฟล์) คืน url = null
    async getLogoUrl() {
      const { data, error } = await run(() => client.storage.from(IMAGE_BUCKET).createSignedUrl(LOGO_PATH, IMAGE_URL_TTL))
      return { url: error ? null : (data?.signedUrl ?? null) }
    },

    // เขียนทับไฟล์เดิม cache สั้น เพื่อให้เห็นโลโก้ใหม่เร็ว
    async uploadLogo(blob) {
      const { error } = await run(() =>
        client.storage
          .from(IMAGE_BUCKET)
          .upload(LOGO_PATH, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' }),
      )
      return { error }
    },

    // ตั้งหมวดหมู่ให้หลายรายการ คืนจำนวนที่บันทึกได้ (ชุดไหนผิดพลาดหยุดทันที)
    async setProductsCategory(ids, category) {
      return updateByIds(client, ids, { category: String(category ?? '').trim() })
    },

    // ตั้งจุดสั่งซื้อหลายรายการ changes = [{ id, reorderPoint }] บันทึกครั้งเดียวต่อค่า
    async setReorderPoints(changes) {
      let updated = 0
      for (const { value, ids } of groupIdsByValue(changes.map((c) => ({ id: c.id, value: c.reorderPoint })))) {
        const result = await updateByIds(client, ids, { reorder_point: value })
        updated += result.updated
        if (result.error) return { updated, error: result.error }
      }
      return { updated, error: null }
    },

    // เปิด/ปิดใช้งานหลายรายการ คืนจำนวนที่บันทึกได้ (ชุดไหนผิดพลาดหยุดทันที)
    async setProductsActive(ids, active) {
      return updateByIds(client, ids, { active })
    },

    async setProductActive(id, active) {
      const { error } = await run(() =>
        client.from('products').update({ active }).eq('id', id).select('id').single(),
      )
      return { error }
    },

    async recordMovement(movement) {
      const note = String(movement.note ?? '').trim()
      const { data, error } = await run(() =>
        client.rpc('record_movement', {
          p_product_id: movement.productId,
          p_type: movement.type,
          p_quantity: Number(movement.quantity),
          p_movement_date: movement.movementDate,
          p_note: note || null,
          p_warehouse_id: movement.warehouseId || null,
        }),
      )
      return { movement: error ? null : toMovement(data), error }
    },

    // ยอดขายรายเดือนทั้งหมด (สินค้า ~ร้อยรายการ × 12 เดือนต่อปี) ดึงทีละ EXPORT_PAGE_SIZE
    async listMonthlySales() {
      const all = []
      for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_PAGE_SIZE) {
        const { data, error } = await run(() =>
          client
            .from('product_monthly_sales')
            .select(MONTHLY_SALES_COLUMNS)
            .order('product_id', { ascending: true })
            .order('year', { ascending: true })
            .order('month', { ascending: true })
            .range(from, from + EXPORT_PAGE_SIZE - 1),
        )
        if (error) return { sales: [], error }
        all.push(...data.map(toMonthlySale))
        if (data.length < EXPORT_PAGE_SIZE) break
      }
      return { sales: all, error: null }
    },

    // นำเข้ายอดขายรายเดือน (admin): มีแล้วแก้ทับ ไม่มีเพิ่มใหม่ ทีละ IMPORT_BATCH_SIZE
    async upsertMonthlySales(sales) {
      let saved = 0
      for (let i = 0; i < sales.length; i += IMPORT_BATCH_SIZE) {
        const batch = sales.slice(i, i + IMPORT_BATCH_SIZE)
        const { error } = await run(() =>
          client.from('product_monthly_sales').upsert(batch.map(toMonthlySaleRow), { onConflict: 'product_id,year,month' }),
        )
        if (error) return { saved, error }
        saved += batch.length
      }
      return { saved, error: null }
    },

    // page เริ่มที่ 0 ล่าสุดก่อน
    async listMovements({ productId, type, warehouse, page = 0 } = {}) {
      const from = page * PAGE_SIZE
      const { data, error } = await run(() => {
        let query = client.from('stock_movements').select(MOVEMENT_COLUMNS)
        if (productId) query = query.eq('product_id', productId)
        query = filterWarehouse(filterType(query, type), warehouse)
        return query
          .order('movement_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
      })
      if (error) return { movements: [], hasMore: false, error }
      return { movements: data.map(toMovement), hasMore: data.length === PAGE_SIZE, error: null }
    },

    // ทุกรายการตามตัวกรอง (สำหรับส่งออก Excel) ล่าสุดก่อน
    async listAllMovements({ productId, type, warehouse } = {}) {
      const all = []
      for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_PAGE_SIZE) {
        const { data, error } = await run(() => {
          let query = client.from('stock_movements').select(MOVEMENT_COLUMNS)
          if (productId) query = query.eq('product_id', productId)
          query = filterWarehouse(filterType(query, type), warehouse)
          return query
            .order('movement_date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, from + EXPORT_PAGE_SIZE - 1)
        })
        if (error) return { movements: [], error }
        all.push(...data.map(toMovement))
        if (data.length < EXPORT_PAGE_SIZE) break
      }
      return { movements: all, error: null }
    },

    // คลังย่อยทั้งหมด (รวมที่ปิดใช้งาน) เรียงตามลำดับที่ตั้งไว้
    async listWarehouses() {
      const { data, error } = await run(() =>
        client
          .from('warehouses')
          .select(WAREHOUSE_COLUMNS)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      )
      return { warehouses: error ? [] : data.map(toWarehouse), error }
    },

    // ไม่มี id = เพิ่มใหม่ (admin)
    async saveWarehouse(warehouse) {
      const row = toWarehouseRow(warehouse)
      const { data, error } = await run(() => {
        const table = client.from('warehouses')
        const query = warehouse.id ? table.update(row).eq('id', warehouse.id) : table.insert(row)
        return query.select('id').single()
      })
      return { id: error ? null : data.id, error }
    },

    // สินค้าที่ผูกกับคลังย่อย [{ productId, warehouseId }]
    async listProductWarehouses() {
      const { rows, error } = await fetchAll((from, to) =>
        client
          .from('product_warehouses')
          .select('product_id, warehouse_id')
          .order('warehouse_id', { ascending: true })
          .order('product_id', { ascending: true })
          .range(from, to),
      )
      return { links: rows.map((r) => ({ productId: r.product_id, warehouseId: r.warehouse_id })), error }
    },

    // ยอดในคลังย่อย [{ warehouseId, productId, quantity }]
    async listWarehouseStock() {
      const { rows, error } = await fetchAll((from, to) =>
        client
          .from('warehouse_stock')
          .select('warehouse_id, product_id, quantity')
          .order('warehouse_id', { ascending: true })
          .order('product_id', { ascending: true })
          .range(from, to),
      )
      return {
        stock: rows.map((r) => ({ warehouseId: r.warehouse_id, productId: r.product_id, quantity: Number(r.quantity) })),
        error,
      }
    },

    // เพิ่มสินค้าหลายรายการเข้าคลังย่อย (admin) ที่มีอยู่แล้วข้าม
    async addProductsToWarehouse(productIds, warehouseId) {
      let saved = 0
      for (let i = 0; i < productIds.length; i += IMPORT_BATCH_SIZE) {
        const batch = productIds.slice(i, i + IMPORT_BATCH_SIZE)
        const { error } = await run(() =>
          client.from('product_warehouses').upsert(
            batch.map((productId) => ({ product_id: productId, warehouse_id: warehouseId })),
            { onConflict: 'product_id,warehouse_id', ignoreDuplicates: true },
          ),
        )
        if (error) return { saved, error }
        saved += batch.length
      }
      return { saved, error: null }
    },

    // เอาสินค้าออกจากคลังย่อย (admin) ไม่แตะยอด สินค้าที่ยังมียอดในคลังนั้นยังแสดงอยู่
    async removeProductsFromWarehouse(productIds, warehouseId) {
      let removed = 0
      for (let i = 0; i < productIds.length; i += UPDATE_BATCH_SIZE) {
        const batch = productIds.slice(i, i + UPDATE_BATCH_SIZE)
        const { data, error } = await run(() =>
          client
            .from('product_warehouses')
            .delete()
            .eq('warehouse_id', warehouseId)
            .in('product_id', batch)
            .select('product_id'),
        )
        if (error) return { removed, error }
        removed += data.length
      }
      return { removed, error: null }
    },

    // ไม่มี profile คืน profile: null (หน้าจอแสดง "ยังไม่ได้กำหนดบทบาท")
    async getMyProfile(userId) {
      const { data, error } = await run(() =>
        client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
      )
      return { profile: error ? null : toProfile(data), error }
    },
  }
}
