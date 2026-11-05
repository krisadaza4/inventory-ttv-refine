import { describe, expect, it } from 'vitest'
import { isSelectable, isoOf, monthGrid, parseMonth, shiftMonth } from './thaiCalendar.js'

describe('parseMonth / isoOf', () => {
  it('แยกปีเดือน และประกอบกลับ', () => {
    expect(parseMonth('2026-10-08')).toEqual({ year: 2026, month: 10 })
    expect(parseMonth('')).toBeNull()
    expect(isoOf(2026, 3, 5)).toBe('2026-03-05')
  })
})

describe('shiftMonth', () => {
  it('ข้ามปีทั้งไปและกลับ', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2026, month: 5 }, 12)).toEqual({ year: 2027, month: 5 })
  })
})

describe('monthGrid', () => {
  it('ต.ค. 2569 เริ่มวันพฤหัส (ช่องที่ 5) มี 31 วัน', () => {
    const weeks = monthGrid({ year: 2026, month: 10 })
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    const days = weeks.flat().filter(Boolean)
    expect(days).toHaveLength(31)
    expect(days.at(-1)).toBe('2026-10-31')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('ก.พ. ปีอธิกสุรทิน 29 วัน', () => {
    expect(monthGrid({ year: 2028, month: 2 }).flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('isSelectable', () => {
  it('ตาม min / max', () => {
    expect(isSelectable('2026-11-05', { max: '2026-11-05' })).toBe(true)
    expect(isSelectable('2026-11-06', { max: '2026-11-05' })).toBe(false)
    expect(isSelectable('2026-09-30', { min: '2026-10-01' })).toBe(false)
    expect(isSelectable('2026-10-01')).toBe(true)
  })
})
