const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// แปลง 'YYYY-MM-DD' (ค.ศ.) เป็นข้อความ พ.ศ. เช่น '24 ก.ย. 2569'
export function formatThaiDate(iso) {
  const match = ISO_DATE.exec(iso ?? '')
  if (!match) return ''
  const [, year, month, day] = match
  const monthName = THAI_MONTHS[Number(month) - 1]
  if (!monthName) return ''
  return `${Number(day)} ${monthName} ${Number(year) + 543}`
}

// เวลาที่บันทึกจริง (created_at เป็น timestamp UTC) แสดงเป็นเวลาไทยเสมอ ไม่ขึ้นกับเครื่องที่เปิด
const BANGKOK_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// timestamp → { date: 'YYYY-MM-DD', time: 'HH:MM' } ตามเวลาไทย อ่านไม่ได้คืน null
export function bangkokParts(timestamp) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const p = Object.fromEntries(BANGKOK_PARTS.formatToParts(date).map((part) => [part.type, part.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

// timestamp → '8 ต.ค. 2569 13:45' (เวลาไทย) อ่านไม่ได้คืน ''
export function formatThaiDateTime(timestamp) {
  const parts = bangkokParts(timestamp)
  return parts ? `${formatThaiDate(parts.date)} ${parts.time}` : ''
}

// แปลง Date เป็น 'YYYY-MM-DD' ตามวันที่ท้องถิ่น (ไม่ใช้ toISOString เพราะเป็น UTC)
export function toIsoDate(date) {
  const yyyy = String(date.getFullYear()).padStart(4, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
