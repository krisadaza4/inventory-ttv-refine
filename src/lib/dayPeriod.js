import { bangkokParts } from './dateFormat.js'

// ช่วงเช้า / บ่าย ของรายการ ตามเวลาที่กดบันทึก (created_at เวลาไทย)
// ผู้ใช้ตกลง (2026-11-05): ก่อน 12:00 = เช้า, ตั้งแต่ 12:00 = บ่าย (ทุกรายการลงช่วงใดช่วงหนึ่ง)
export const AFTERNOON_FROM = '12:00'

export const PERIOD = {
  ALL: '',
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
}

export const PERIOD_LABEL = {
  [PERIOD.MORNING]: 'เช้า',
  [PERIOD.AFTERNOON]: 'บ่าย',
}

export const PERIOD_FILTERS = [
  { value: PERIOD.ALL, label: 'ทั้งวัน' },
  { value: PERIOD.MORNING, label: 'เช้า' },
  { value: PERIOD.AFTERNOON, label: 'บ่าย' },
]

// เวลาบันทึกอ่านไม่ได้ (ไม่มี created_at) คืน null
export function periodOf(createdAt) {
  const parts = bangkokParts(createdAt)
  if (!parts) return null
  return parts.time < AFTERNOON_FROM ? PERIOD.MORNING : PERIOD.AFTERNOON
}

export function filterByPeriod(movements, period) {
  if (!period) return movements
  return movements.filter((m) => periodOf(m.createdAt) === period)
}
