// ช่วงวันที่สำหรับกรองประวัติ (เทียบกับวันที่ของรายการ movement_date รูปแบบ 'YYYY-MM-DD')
// ค่าว่าง = ไม่จำกัดด้านนั้น

export const DATE_PRESETS = [
  { id: 'today', label: 'วันนี้' },
  { id: 'month', label: 'เดือนนี้' },
  { id: 'last-month', label: 'เดือนที่แล้ว' },
  { id: 'year', label: 'ปีนี้' },
]

const pad = (n) => String(n).padStart(2, '0')
const lastDay = (year, month) => new Date(year, month, 0).getDate()

// today = 'YYYY-MM-DD' (วันที่ท้องถิ่น) คืน { from, to }
export function presetRange(id, today) {
  const [y, m] = today.split('-').map(Number)
  switch (id) {
    case 'today':
      return { from: today, to: today }
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` }
    case 'last-month': {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` }
    }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    default:
      return { from: '', to: '' }
  }
}

// ปุ่มลัดไหนตรงกับช่วงตอนนี้ (ไว้ไฮไลต์ปุ่ม) ไม่ตรง = null
export function matchPreset(range, today) {
  if (!range.from && !range.to) return null
  const hit = DATE_PRESETS.find(({ id }) => {
    const p = presetRange(id, today)
    return p.from === range.from && p.to === range.to
  })
  return hit ? hit.id : null
}

// กรอกกลับด้าน (จาก > ถึง) สลับให้
export function normalizeRange({ from = '', to = '' }) {
  return from && to && from > to ? { from: to, to: from } : { from, to }
}

// ต่อท้ายชื่อไฟล์ส่งออก: '' (ไม่กรอง) / '_2026-11-01_2026-11-30' / '_2026-11-05' / '_from-…' / '_to-…'
export function rangeFileSuffix({ from, to }) {
  if (from && to) return from === to ? `_${from}` : `_${from}_${to}`
  if (from) return `_from-${from}`
  if (to) return `_to-${to}`
  return ''
}
