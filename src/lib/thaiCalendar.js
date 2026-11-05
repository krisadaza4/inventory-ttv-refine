// ข้อมูลปฏิทินสำหรับช่องเลือกวันที่ของแอป (แสดง พ.ศ. ชื่อเดือนไทย) ค่าเป็น 'YYYY-MM-DD' (ค.ศ.) เหมือน <input type="date">

export const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

// เริ่มสัปดาห์วันอาทิตย์ แบบปฏิทินไทยทั่วไป
export const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const pad = (n) => String(n).padStart(2, '0')

export const isoOf = (year, month, day) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`

// 'YYYY-MM-DD' → { year, month } (month 1–12) อ่านไม่ได้คืน null
export function parseMonth(iso) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso ?? '')
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null
}

// เลื่อนเดือน delta (+1 / -1 / +12 …)
export function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

// ตารางวันของเดือน: แถวละ 7 ช่อง ช่องว่างก่อนวันที่ 1 และหลังวันสุดท้าย = null
export function monthGrid({ year, month }) {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  const cells = [...Array(firstWeekday).fill(null)]
  for (let d = 1; d <= days; d += 1) cells.push(isoOf(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// เลือกวันนี้ได้ไหม ตาม min / max ('YYYY-MM-DD' ว่าง = ไม่จำกัด)
export function isSelectable(iso, { min, max } = {}) {
  if (min && iso < min) return false
  if (max && iso > max) return false
  return true
}
