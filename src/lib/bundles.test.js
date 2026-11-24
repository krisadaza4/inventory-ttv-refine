import { describe, expect, it } from 'vitest'
import { bundleSummary, checkBundleDraft } from './bundles.js'

const bundles = [{ sku: 'GL-203R-P1', items: [] }]

describe('checkBundleDraft', () => {
  it('ผ่าน: รหัสเป็นตัวพิมพ์ใหญ่ ตัดช่องว่าง จำนวนเป็นตัวเลข', () => {
    const draft = { sku: ' gl-101i-p1 ', items: [{ productId: 'a', quantity: '1' }, { productId: 'b', quantity: ' 2 ' }] }
    expect(checkBundleDraft(draft, bundles)).toEqual({
      bundle: { sku: 'GL-101I-P1', items: [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }] },
      errors: {},
    })
  })

  it('รหัสว่าง / ซ้ำชุดอื่น / ไม่มีสินค้า ผิด', () => {
    expect(checkBundleDraft({ sku: ' ', items: [] }, bundles).errors).toEqual({
      sku: 'กรุณาใส่รหัสชุด',
      items: 'เลือกสินค้าในชุดอย่างน้อย 1 รายการ',
    })
    expect(checkBundleDraft({ sku: 'gl-203r-p1', items: [{ productId: 'a', quantity: '1' }] }, bundles).errors.sku).toBe('รหัสชุดนี้มีอยู่แล้ว')
  })

  it('แก้ไขชุดเดิมโดยไม่เปลี่ยนรหัส ไม่ถือว่าซ้ำ', () => {
    const result = checkBundleDraft({ sku: 'GL-203R-P1', items: [{ productId: 'a', quantity: '1' }] }, bundles, 'GL-203R-P1')
    expect(result.errors).toEqual({})
  })

  it('จำนวนผิด แจ้งที่สินค้านั้น', () => {
    for (const quantity of ['', '0', '-1', 'x', '1.234']) {
      const { bundle, errors } = checkBundleDraft({ sku: 'X-P1', items: [{ productId: 'a', quantity }] }, bundles)
      expect(bundle).toBeNull()
      expect(errors.a).toBeTruthy()
    }
  })
})

describe('bundleSummary', () => {
  it('แสดงรหัสสินค้า และจำนวนเมื่อมากกว่า 1', () => {
    const byId = new Map([['a', { sku: 'GL-203R' }], ['b', { sku: 'LGT001-P1' }]])
    expect(bundleSummary({ items: [{ productId: 'a', quantity: 1 }, { productId: 'b', quantity: 2 }, { productId: 'z', quantity: 1 }] }, byId)).toBe(
      'GL-203R, LGT001-P1 ×2, (ไม่พบสินค้า)',
    )
  })
})
