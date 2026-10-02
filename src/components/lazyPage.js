import { lazy } from 'react'

const RELOADED_KEY = 'inventory-ttv:chunk-reload'

// โหลดหน้าเมื่อเปิดครั้งแรกเท่านั้น หน้าแรกจะได้เปิดเร็วขึ้น
// ถ้า deploy ใหม่ระหว่างเปิดแอปค้างไว้ ไฟล์ของเวอร์ชันเก่าจะหายไป: โหลดทั้งหน้าใหม่ครั้งเดียว (กันวนรีเฟรช)
export function lazyPage(load) {
  return lazy(async () => {
    try {
      const module = await load()
      try {
        sessionStorage.removeItem(RELOADED_KEY)
      } catch {
        // ไม่เป็นไร
      }
      return module
    } catch (error) {
      let reloaded = true
      try {
        reloaded = sessionStorage.getItem(RELOADED_KEY) === '1'
        if (!reloaded) sessionStorage.setItem(RELOADED_KEY, '1')
      } catch {
        // อ่าน/เขียนไม่ได้ ไม่รีเฟรชเอง
      }
      if (reloaded) throw error
      window.location.reload()
      return new Promise(() => {})
    }
  })
}
