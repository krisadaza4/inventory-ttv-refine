// เตือน admin ให้สำรองข้อมูล: จำวันที่สำรองล่าสุดในเบราว์เซอร์ (แยกแต่ละเครื่อง)
export const BACKUP_KEY = 'inventory-ttv:last-backup'
export const REMIND_AFTER_DAYS = 7

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// วันที่สำรองล่าสุด 'YYYY-MM-DD' ไม่มี/อ่านไม่ได้ คืน null
export function readLastBackup(storage = globalThis.localStorage) {
  try {
    const saved = storage.getItem(BACKUP_KEY)
    return ISO_DATE.test(saved ?? '') ? saved : null
  } catch {
    return null
  }
}

// บันทึกไม่ได้ก็ไม่เป็นไร แค่จะเตือนอีกครั้ง
export function saveLastBackup(date, storage = globalThis.localStorage) {
  try {
    storage.setItem(BACKUP_KEY, date)
  } catch {
    // ไม่จำค่า
  }
}

// จำนวนวันจาก last ถึง today (ทั้งคู่ 'YYYY-MM-DD') last เป็น null คืน null
export function daysSince(last, today) {
  if (!last) return null
  const toDay = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86400000
  }
  return Math.round(toDay(today) - toDay(last))
}

// ข้อความเตือน หรือ null ถ้ายังไม่ถึงเวลา
export function backupReminder(last, today) {
  const days = daysSince(last, today)
  if (days === null) return 'เครื่องนี้ยังไม่เคยสำรองข้อมูล กด "สำรองข้อมูล" เพื่อเก็บไฟล์ Excel ไว้'
  if (days < REMIND_AFTER_DAYS) return null
  return `สำรองข้อมูลครั้งล่าสุด ${days} วันที่แล้ว กด "สำรองข้อมูล" เพื่อเก็บไฟล์ใหม่`
}
