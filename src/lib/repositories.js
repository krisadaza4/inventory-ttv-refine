import {
  MONTHLY_SALES_COLUMNS,
  MOVEMENT_COLUMNS,
  PRODUCT_COLUMNS,
  PROFILE_COLUMNS,
  toMonthlySale,
  toMonthlySaleRow,
  toMovement,
  toProduct,
  toProductRow,
  toProfile,
} from './mappers.js'
import { IMAGE_BUCKET, IMAGE_URL_TTL, LOGO_PATH, imagePathFor } from './productImages.js'
import { REPAIR_FILTER, REPAIR_TYPES } from './stockRules.js'
import { toThaiError } from './supabaseErrors.js'

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

// ตัวกรองประเภทในหน้าประวัติ: REPAIR_FILTER = ส่งซ่อม/ซ่อมเสร็จ/ตัดจำหน่าย รวมกัน
const filterType = (query, type) => {
  if (!type) return query
  return type === REPAIR_FILTER ? query.in('type', REPAIR_TYPES) : query.eq('type', type)
}

// client รับเป็นพารามิเตอร์ เพื่อให้ทดสอบด้วย client จำลองได้
// ตั้งใจไม่มีฟังก์ชันลบ และบันทึกรายการเคลื่อนไหวผ่าน record_movement เท่านั้น
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
    async listMovements({ productId, type, page = 0 } = {}) {
      const from = page * PAGE_SIZE
      const { data, error } = await run(() => {
        let query = client.from('stock_movements').select(MOVEMENT_COLUMNS)
        if (productId) query = query.eq('product_id', productId)
        query = filterType(query, type)
        return query
          .order('movement_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
      })
      if (error) return { movements: [], hasMore: false, error }
      return { movements: data.map(toMovement), hasMore: data.length === PAGE_SIZE, error: null }
    },

    // ทุกรายการตามตัวกรอง (สำหรับส่งออก Excel) ล่าสุดก่อน
    async listAllMovements({ productId, type } = {}) {
      const all = []
      for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_PAGE_SIZE) {
        const { data, error } = await run(() => {
          let query = client.from('stock_movements').select(MOVEMENT_COLUMNS)
          if (productId) query = query.eq('product_id', productId)
          query = filterType(query, type)
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

    // ไม่มี profile คืน profile: null (หน้าจอแสดง "ยังไม่ได้กำหนดบทบาท")
    async getMyProfile(userId) {
      const { data, error } = await run(() =>
        client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
      )
      return { profile: error ? null : toProfile(data), error }
    },
  }
}
