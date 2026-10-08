// แท็บหน้าจัดการสินค้า: ใช้งาน / ปิดใช้งาน / ทั้งหมด จำแท็บล่าสุดในเบราว์เซอร์ (แยกแต่ละเครื่อง)
export const ACTIVE_VIEW = { ACTIVE: 'active', INACTIVE: 'inactive', ALL: 'all' }
export const ACTIVE_VIEW_KEY = 'inventory-ttv:manage-active-view'

const VIEWS = Object.values(ACTIVE_VIEW)

export function filterByActive(products, view) {
  if (view === ACTIVE_VIEW.ALL) return products
  const wanted = view !== ACTIVE_VIEW.INACTIVE
  return products.filter((p) => p.active === wanted)
}

export function countByActive(products) {
  const active = products.filter((p) => p.active).length
  return { [ACTIVE_VIEW.ACTIVE]: active, [ACTIVE_VIEW.INACTIVE]: products.length - active, [ACTIVE_VIEW.ALL]: products.length }
}

// ไม่มี/อ่านไม่ได้/ค่าแปลก คืนแท็บใช้งาน
export function readActiveView(storage = globalThis.localStorage) {
  try {
    const saved = storage.getItem(ACTIVE_VIEW_KEY)
    return VIEWS.includes(saved) ? saved : ACTIVE_VIEW.ACTIVE
  } catch {
    return ACTIVE_VIEW.ACTIVE
  }
}

// บันทึกไม่ได้ก็ไม่เป็นไร แค่ไม่จำแท็บ
export function saveActiveView(view, storage = globalThis.localStorage) {
  try {
    storage.setItem(ACTIVE_VIEW_KEY, view)
  } catch {
    // ไม่จำค่า
  }
}
