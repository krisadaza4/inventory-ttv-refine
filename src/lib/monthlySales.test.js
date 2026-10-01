import { describe, expect, it } from 'vitest'
import { MONTH_LABELS, buildSalesRows, salesYears, sortSalesRows, toBuddhistYear, toGregorianYear } from './monthlySales.js'

const products = [
  { id: 'a', sku: 'GL-101I' },
  { id: 'b', sku: 'GL-203I' },
  { id: 'c', sku: 'NO-SALES' },
]
const sales = [
  { productId: 'a', year: 2026, month: 1, quantity: 205 },
  { productId: 'a', year: 2026, month: 2, quantity: 126 },
  { productId: 'b', year: 2026, month: 1, quantity: 64 },
  { productId: 'b', year: 2026, month: 9, quantity: 6 },
  { productId: 'a', year: 2025, month: 12, quantity: 10 },
]

describe('ปี', () => {
  it('แปลง พ.ศ. / ค.ศ.', () => {
    expect(toBuddhistYear(2026)).toBe(2569)
    expect(toGregorianYear(2569)).toBe(2026)
    expect(toGregorianYear(2026)).toBe(2026)
  })

  it('salesYears ล่าสุดก่อน ไม่ซ้ำ', () => {
    expect(salesYears(sales)).toEqual([2026, 2025])
  })

  it('มี 12 เดือน', () => {
    expect(MONTH_LABELS).toHaveLength(12)
  })
})

describe('buildSalesRows', () => {
  it('จัดเป็น 12 เดือน เดือนที่ไม่มีข้อมูลเป็น null รวมและเฉลี่ย ÷ 12', () => {
    const rows = buildSalesRows(products, sales, 2026)
    expect(rows.map((r) => r.product.sku)).toEqual(['GL-101I', 'GL-203I'])
    expect(rows[0].months.slice(0, 3)).toEqual([205, 126, null])
    expect(rows[0].total).toBe(331)
    expect(rows[0].average).toBe(27.58)
    expect(rows[1].months[8]).toBe(6)
  })

  it('เลือกปีอื่นได้ สินค้าที่ไม่มียอดปีนั้นไม่แสดง', () => {
    expect(buildSalesRows(products, sales, 2025).map((r) => r.product.sku)).toEqual(['GL-101I'])
  })
})

describe('sortSalesRows', () => {
  const rows = buildSalesRows(products, sales, 2026)

  it('เรียงตามรวม มาก → น้อย', () => {
    expect(sortSalesRows(rows, 'total', 'desc').map((r) => r.product.sku)).toEqual(['GL-101I', 'GL-203I'])
  })

  it('เรียงตามเดือน เดือนที่ไม่มีข้อมูลอยู่ท้ายเมื่อเรียงมาก → น้อย', () => {
    expect(sortSalesRows(rows, 'm9', 'desc').map((r) => r.product.sku)).toEqual(['GL-203I', 'GL-101I'])
  })

  it('เรียงตามรหัส', () => {
    expect(sortSalesRows(rows, 'sku', 'desc').map((r) => r.product.sku)).toEqual(['GL-203I', 'GL-101I'])
  })
})
