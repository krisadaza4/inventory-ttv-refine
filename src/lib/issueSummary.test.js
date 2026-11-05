import { describe, expect, it } from 'vitest'
import { filterByPeriod, periodOf } from './dayPeriod.js'
import { summarizeIssues } from './issueSummary.js'

// เวลาไทย = UTC + 7
const at = (bangkokTime) => {
  const [h, m] = bangkokTime.split(':').map(Number)
  return new Date(Date.UTC(2026, 10, 5, h - 7, m)).toISOString()
}

const move = (over) => ({
  type: 'out',
  productId: 'p1',
  productSku: 'A01',
  productName: 'ฝาปรับลม',
  unit: 'ชิ้น',
  recordedByName: 'Admin',
  quantity: 1,
  createdAt: at('09:00'),
  ...over,
})

describe('periodOf', () => {
  it('ก่อน 12:00 = เช้า, ตั้งแต่ 12:00 = บ่าย (เวลาไทย)', () => {
    expect(periodOf(at('08:00'))).toBe('morning')
    expect(periodOf(at('11:59'))).toBe('morning')
    expect(periodOf(at('12:00'))).toBe('afternoon')
    expect(periodOf(at('17:30'))).toBe('afternoon')
    expect(periodOf(null)).toBeNull()
  })
})

describe('filterByPeriod', () => {
  it('กรองตามช่วง ว่าง = ทั้งหมด', () => {
    const list = [move({ createdAt: at('09:00') }), move({ createdAt: at('14:00') })]
    expect(filterByPeriod(list, 'morning')).toHaveLength(1)
    expect(filterByPeriod(list, 'afternoon')).toHaveLength(1)
    expect(filterByPeriod(list, '')).toHaveLength(2)
  })
})

describe('summarizeIssues', () => {
  const list = [
    move({ quantity: 100, createdAt: at('09:00') }),
    move({ quantity: 20, createdAt: at('10:30'), recordedByName: 'User01' }),
    move({ quantity: 30, createdAt: at('13:00') }),
    move({ productId: 'p2', productSku: 'B02', productName: 'ไส้', quantity: 5, createdAt: at('15:00') }),
    move({ type: 'in', quantity: 999 }),
  ]

  it('รวมต่อสินค้า เฉพาะเบิกออก แยกเช้า/บ่าย', () => {
    const { rows, total } = summarizeIssues(list)
    expect(rows.map(({ sku, morning, afternoon, total: t }) => [sku, morning, afternoon, t])).toEqual([
      ['A01', 120, 30, 150],
      ['B02', 0, 5, 5],
    ])
    expect(total).toEqual({ unit: 'ชิ้น', morning: 120, afternoon: 35, total: 155 })
  })

  it('แยกตามผู้บันทึก', () => {
    const { rows } = summarizeIssues(list, { byRecorder: true })
    expect(rows.map(({ sku, recorder, morning, afternoon }) => [sku, recorder, morning, afternoon])).toEqual([
      ['A01', 'Admin', 100, 30],
      ['A01', 'User01', 20, 0],
      ['B02', 'Admin', 0, 5],
    ])
  })

  it('หน่วยต่างกัน ไม่รวมยอดทั้งหมด', () => {
    const { total } = summarizeIssues([move({}), move({ productId: 'p2', productSku: 'B', unit: 'กล่อง' })])
    expect(total).toBeNull()
  })

  it('ไม่มีรายการ', () => {
    expect(summarizeIssues([])).toEqual({ rows: [], total: null })
  })
})
