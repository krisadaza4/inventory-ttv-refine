import { describe, expect, it } from 'vitest'
import { groupIdsByValue, planReorderPoints, suggestReorderPoint } from './bulkEdit.js'

describe('suggestReorderPoint', () => {
  it('ขายเฉลี่ย × เดือน ปัดขึ้นเป็นจำนวนเต็ม', () => {
    expect(suggestReorderPoint(10, 1)).toBe(10)
    expect(suggestReorderPoint(10.2, 1)).toBe(11)
    expect(suggestReorderPoint(5, 0.5)).toBe(3)
    expect(suggestReorderPoint('4.50', 2)).toBe(9)
  })

  it('ไม่ปัดขึ้นเกินจากเศษทศนิยมของการคูณ', () => {
    expect(suggestReorderPoint(0.1, 3)).toBe(1)
    expect(suggestReorderPoint(1.1, 3)).toBe(4)
  })

  it('ขาย 0 ได้ 0, ไม่มียอดขายหรือค่าผิด คืน null', () => {
    expect(suggestReorderPoint(0, 1)).toBe(0)
    expect(suggestReorderPoint(null, 1)).toBeNull()
    expect(suggestReorderPoint(undefined, 1)).toBeNull()
    expect(suggestReorderPoint('abc', 1)).toBeNull()
    expect(suggestReorderPoint(-1, 1)).toBeNull()
  })
})

describe('planReorderPoints', () => {
  const products = [
    { sku: 'C', active: true, reorderPoint: 0, avgMonthlySales: 7.5 },
    { sku: 'A', active: true, reorderPoint: 0, avgMonthlySales: 3 },
    { sku: 'B', active: true, reorderPoint: 5, avgMonthlySales: 20 },
    { sku: 'D', active: true, reorderPoint: 0, avgMonthlySales: null },
    { sku: 'E', active: false, reorderPoint: 0, avgMonthlySales: 9 },
    { sku: 'F', active: true, reorderPoint: 0, avgMonthlySales: 0 },
    { sku: 'G', active: true, reorderPoint: '4.00', avgMonthlySales: 4 },
  ]
  const summary = (plan) => plan.map((r) => `${r.product.sku}:${r.current}→${r.next}`)

  it('ค่าเริ่มต้น: เฉพาะที่จุดสั่งซื้อยังเป็น 0 เรียงตามรหัส', () => {
    expect(summary(planReorderPoints(products, 1))).toEqual(['A:0→3', 'C:0→8'])
  })

  it('รวมที่ตั้งไว้แล้วด้วย: ข้ามรายการที่ค่าไม่เปลี่ยน', () => {
    expect(summary(planReorderPoints(products, 1, { onlyUnset: false }))).toEqual(['A:0→3', 'B:5→20', 'C:0→8'])
  })

  it('ข้ามสินค้าที่ปิดใช้งาน ไม่มียอดขายเฉลี่ย และขาย 0 ที่ยังเป็น 0', () => {
    const skus = planReorderPoints(products, 2, { onlyUnset: false }).map((r) => r.product.sku)
    expect(skus).not.toContain('D')
    expect(skus).not.toContain('E')
    expect(skus).not.toContain('F')
  })
})

describe('groupIdsByValue', () => {
  it('รวม id ที่ได้ค่าเดียวกัน', () => {
    expect(
      groupIdsByValue([
        { id: 'a', value: 3 },
        { id: 'b', value: 8 },
        { id: 'c', value: 3 },
      ]),
    ).toEqual([
      { value: 3, ids: ['a', 'c'] },
      { value: 8, ids: ['b'] },
    ])
  })

  it('ไม่มีรายการ คืน array ว่าง', () => {
    expect(groupIdsByValue([])).toEqual([])
  })
})
