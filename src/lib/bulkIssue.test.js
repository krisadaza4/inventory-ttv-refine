import { describe, expect, it } from 'vitest'
import { ISSUE_NOTE_MAX, ISSUE_NOTE_OPTIONS, planBulkIssue } from './bulkIssue.js'

const products = [
  { id: 'p1', name: 'A', onHand: 10, repairQty: 1 },
  { id: 'p2', name: 'B', onHand: 3, repairQty: 0 },
  { id: 'p3', name: 'C', onHand: 0, repairQty: 0 },
]
const today = '2026-11-17'

describe('ISSUE_NOTE_OPTIONS', () => {
  it('ตัวเลือกในลูกศรมีแค่ ขายส่ง', () => {
    expect(ISSUE_NOTE_OPTIONS).toEqual(['ขายส่ง'])
  })
})

describe('planBulkIssue', () => {
  it('ผ่านทุกรายการ: คืน moves ตัดช่องว่างหัวท้ายของจำนวน', () => {
    const rows = [
      { productId: 'p1', quantity: ' 2 ', note: 'ออนไลน์' },
      { productId: 'p2', quantity: '3', note: 'ขายส่ง' },
    ]
    expect(planBulkIssue(rows, products, 'staff', today)).toEqual({
      moves: [
        { productId: 'p1', type: 'out', quantity: '2', note: 'ออนไลน์' },
        { productId: 'p2', type: 'out', quantity: '3', note: 'ขายส่ง' },
      ],
      errors: {},
    })
  })

  it('เบิกเกินคงเหลือ: ผิดเฉพาะรายการนั้น', () => {
    const rows = [
      { productId: 'p1', quantity: '2', note: 'ออนไลน์' },
      { productId: 'p2', quantity: '4', note: 'ขายส่ง' },
    ]
    const { moves, errors } = planBulkIssue(rows, products, 'staff', today)
    expect(moves.map((m) => m.productId)).toEqual(['p1'])
    expect(errors.p2.quantity).toBe('คงเหลือไม่พอ (คงเหลือ 3)')
    expect(errors.p1).toBeUndefined()
  })

  it('ไม่ใส่จำนวน / ไม่ใช่ตัวเลข / 0 / ทศนิยมเกิน 2 ตำแหน่ง ผิด', () => {
    for (const quantity of ['', ' ', 'abc', '0', '1.234']) {
      const { errors } = planBulkIssue([{ productId: 'p1', quantity, note: 'ออนไลน์' }], products, 'staff', today)
      expect(errors.p1.quantity).toBeTruthy()
    }
  })

  it('สินค้าหมด (คงเหลือ 0) เบิกไม่ได้', () => {
    const { errors } = planBulkIssue([{ productId: 'p3', quantity: '1', note: 'ขายส่ง' }], products, 'staff', today)
    expect(errors.p3.quantity).toBeTruthy()
  })

  it('ไม่ใส่หมายเหตุก็เบิกได้ (บันทึกเป็นค่าว่าง)', () => {
    for (const note of ['', '   ', undefined]) {
      const { errors, moves } = planBulkIssue([{ productId: 'p1', quantity: '1', note }], products, 'staff', today)
      expect(errors).toEqual({})
      expect(moves).toEqual([{ productId: 'p1', type: 'out', quantity: '1', note: '' }])
    }
  })

  it('พิมพ์หมายเหตุเอง: ตัดช่องว่างหัวท้าย', () => {
    const rows = [{ productId: 'p1', quantity: '1', note: '  ร้านสมชาย  ' }]
    expect(planBulkIssue(rows, products, 'staff', today).moves[0].note).toBe('ร้านสมชาย')
  })

  it('หมายเหตุยาวเกิน 200 ตัวอักษร ผิด', () => {
    const long = [{ productId: 'p1', quantity: '1', note: 'ก'.repeat(ISSUE_NOTE_MAX + 1) }]
    expect(planBulkIssue(long, products, 'staff', today).errors.p1.note).toContain('200')
    const ok = [{ productId: 'p1', quantity: '1', note: 'ก'.repeat(ISSUE_NOTE_MAX) }]
    expect(planBulkIssue(ok, products, 'staff', today).errors).toEqual({})
  })

  it('จำนวนและหมายเหตุผิดพร้อมกัน แจ้งทั้งสองช่อง', () => {
    const { errors } = planBulkIssue([{ productId: 'p1', quantity: '', note: 'ก'.repeat(ISSUE_NOTE_MAX + 1) }], products, 'staff', today)
    expect(Object.keys(errors.p1).toSorted()).toEqual(['note', 'quantity'])
  })

  it('ดูอย่างเดียว (manager / marketing) เบิกไม่ได้', () => {
    for (const role of ['manager', 'marketing']) {
      const { errors, moves } = planBulkIssue([{ productId: 'p1', quantity: '1', note: 'ออนไลน์' }], products, role, today)
      expect(moves).toEqual([])
      expect(errors.p1.quantity).toBe('บัญชีนี้ดูข้อมูลได้อย่างเดียว บันทึกรายการไม่ได้')
    }
  })

  it('Store/QC เบิกได้เหมือน admin', () => {
    const { errors, moves } = planBulkIssue([{ productId: 'p1', quantity: '1', note: 'ขายส่ง' }], products, 'store_qc', today)
    expect(errors).toEqual({})
    expect(moves).toHaveLength(1)
  })

  it('ไม่มีสินค้าตรงรหัส ข้ามไป', () => {
    expect(planBulkIssue([{ productId: 'x', quantity: '1', note: 'ออนไลน์' }], products, 'staff', today)).toEqual({
      moves: [],
      errors: {},
    })
  })
})
