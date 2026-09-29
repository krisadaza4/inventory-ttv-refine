import {
  MOVEMENT_COLUMNS,
  PRODUCT_COLUMNS,
  PROFILE_COLUMNS,
  toMovement,
  toProduct,
  toProductRow,
  toProfile,
} from './mappers.js'
import { toThaiError } from './supabaseErrors.js'

export const PAGE_SIZE = 50

// รันคำสั่ง Supabase แล้วคืน { data, error } เสมอ error เป็นข้อความไทย ไม่โยนต่อ
async function run(buildQuery) {
  try {
    const { data, error } = await buildQuery()
    return { data, error: toThaiError(error) }
  } catch (thrown) {
    return { data: null, error: toThaiError(thrown) }
  }
}

// client รับเป็นพารามิเตอร์ เพื่อให้ทดสอบด้วย client จำลองได้
// ตั้งใจไม่มีฟังก์ชันลบ และบันทึกรายการเคลื่อนไหวผ่าน record_movement เท่านั้น
export function createRepository(client) {
  return {
    async listProducts({ includeInactive = false } = {}) {
      const { data, error } = await run(() => {
        let query = client.from('product_stock').select(PRODUCT_COLUMNS)
        if (!includeInactive) query = query.eq('active', true)
        return query.order('name', { ascending: true })
      })
      return { products: error ? [] : data.map(toProduct), error }
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

    // page เริ่มที่ 0 ล่าสุดก่อน
    async listMovements({ productId, type, page = 0 } = {}) {
      const from = page * PAGE_SIZE
      const { data, error } = await run(() => {
        let query = client.from('stock_movements').select(MOVEMENT_COLUMNS)
        if (productId) query = query.eq('product_id', productId)
        if (type) query = query.eq('type', type)
        return query
          .order('movement_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
      })
      if (error) return { movements: [], hasMore: false, error }
      return { movements: data.map(toMovement), hasMore: data.length === PAGE_SIZE, error: null }
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
