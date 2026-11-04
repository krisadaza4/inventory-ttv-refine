import { describe, expect, it } from 'vitest'
import { planBulkReceive } from './bulkReceive.js'

const products = [
  { id: 'p1', name: 'A', onHand: 10, repairQty: 1 },
  { id: 'p2', name: 'B', onHand: 0, repairQty: 0 },
]
const today = '2026-11-04'

describe('planBulkReceive', () => {
  it('ข้ามช่องว่าง เก็บรายการที่ถูกต้อง (ตัดช่องว่างหัวท้าย)', () => {
    expect(planBulkReceive({ p1: ' 2 ', p2: '', x: '5' }, products, 'staff', today)).toEqual({
      moves: [{ productId: 'p1', quantity: '2' }],
      errors: {},
    })
  })

  it('ไม่ใช่ตัวเลข / 0 / ทศนิยมเกิน 2 ตำแหน่ง เป็นข้อผิดพลาดของรายการนั้น', () => {
    const { moves, errors } = planBulkReceive({ p1: 'abc', p2: '0' }, products, 'staff', today)
    expect(moves).toEqual([])
    expect(Object.keys(errors).toSorted()).toEqual(['p1', 'p2'])
    expect(planBulkReceive({ p1: '1.234' }, products, 'staff', today).errors.p1).toBeTruthy()
  })
})
