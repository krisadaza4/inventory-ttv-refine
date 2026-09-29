import { describe, expect, it } from 'vitest'
import { MOVEMENT_TYPE, STOCK_STATUS, getStockStatus, signedQuantity, sortByStockStatus } from './stockRules.js'

describe('signedQuantity', () => {
  it('รับเข้า เป็นบวก', () => {
    expect(signedQuantity(MOVEMENT_TYPE.IN, 5)).toBe(5)
  })

  it('เบิกออก เป็นลบ', () => {
    expect(signedQuantity(MOVEMENT_TYPE.OUT, 5)).toBe(-5)
  })

  it('ปรับยอด ใช้ค่าตามที่กรอก (บวก/ลบ)', () => {
    expect(signedQuantity(MOVEMENT_TYPE.ADJUST, 3)).toBe(3)
    expect(signedQuantity(MOVEMENT_TYPE.ADJUST, -3)).toBe(-3)
  })

  it('รับค่าที่เป็นข้อความตัวเลข (numeric จาก Supabase)', () => {
    expect(signedQuantity(MOVEMENT_TYPE.OUT, '1.25')).toBe(-1.25)
  })

  it('ประเภทไม่รู้จัก ให้ error', () => {
    expect(() => signedQuantity('transfer', 1)).toThrow()
  })
})

describe('getStockStatus', () => {
  it('คงเหลือ 0 = หมด', () => {
    expect(getStockStatus(0, 5)).toBe(STOCK_STATUS.OUT)
  })

  it('คงเหลือ 0 และจุดสั่งซื้อ 0 = หมด', () => {
    expect(getStockStatus(0, 0)).toBe(STOCK_STATUS.OUT)
  })

  it('เท่ากับจุดสั่งซื้อ = ใกล้หมด', () => {
    expect(getStockStatus(5, 5)).toBe(STOCK_STATUS.LOW)
  })

  it('มากกว่า 0 แต่น้อยกว่าจุดสั่งซื้อ = ใกล้หมด', () => {
    expect(getStockStatus(1, 5)).toBe(STOCK_STATUS.LOW)
  })

  it('มากกว่าจุดสั่งซื้อ = ปกติ', () => {
    expect(getStockStatus(6, 5)).toBe(STOCK_STATUS.OK)
  })

  it('จุดสั่งซื้อ 0 และมีของ = ปกติ', () => {
    expect(getStockStatus(0.01, 0)).toBe(STOCK_STATUS.OK)
  })

  it('ทศนิยม: 0.5 เท่ากับจุดสั่งซื้อ 0.5 = ใกล้หมด', () => {
    expect(getStockStatus(0.5, 0.5)).toBe(STOCK_STATUS.LOW)
  })

  it('ทศนิยม: ปัดเศษทศนิยม 2 ตำแหน่งก่อนเทียบ (0.1 + 0.2 = 0.3)', () => {
    expect(getStockStatus(0.1 + 0.2, 0.3)).toBe(STOCK_STATUS.LOW)
  })

  it('ทศนิยม: 0.51 มากกว่า 0.5 = ปกติ', () => {
    expect(getStockStatus(0.51, 0.5)).toBe(STOCK_STATUS.OK)
  })

  it('รับค่าที่เป็นข้อความตัวเลข', () => {
    expect(getStockStatus('0', '2')).toBe(STOCK_STATUS.OUT)
    expect(getStockStatus('2.00', '2')).toBe(STOCK_STATUS.LOW)
  })
})

describe('sortByStockStatus', () => {
  const products = [
    { name: 'น้ำดื่ม', onHand: 20, reorderPoint: 5 },
    { name: 'กาแฟ', onHand: 0, reorderPoint: 5 },
    { name: 'ขนมปัง', onHand: 3, reorderPoint: 5 },
    { name: 'ข้าวสาร', onHand: 50, reorderPoint: 10 },
    { name: 'กล่อง', onHand: 0, reorderPoint: 0 },
  ]

  it('เรียง หมด → ใกล้หมด → ปกติ แล้วตามชื่อ', () => {
    expect(sortByStockStatus(products).map((p) => p.name)).toEqual([
      'กล่อง',
      'กาแฟ',
      'ขนมปัง',
      'ข้าวสาร',
      'น้ำดื่ม',
    ])
  })

  it('ไม่แก้ array เดิม', () => {
    const before = products.map((p) => p.name)
    sortByStockStatus(products)
    expect(products.map((p) => p.name)).toEqual(before)
  })

  it('array ว่าง', () => {
    expect(sortByStockStatus([])).toEqual([])
  })
})
