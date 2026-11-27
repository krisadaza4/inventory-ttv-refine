import { describe, expect, it } from 'vitest'
import { selectLowStock, stockRatio } from './lowStock.js'

const p = (sku, onHand, reorderPoint, category = 'สินค้าออนไลน์') => ({ id: sku, sku, onHand, reorderPoint, category })
const products = [
  p('A', 20, 25),
  p('B', 5, 25),
  p('C', 0, 25),
  p('D', 100, 25),
  p('E', 40, 100, 'บรรจุภัณฑ์'),
  p('F', 0, 0, 'อะไหล่'),
]

describe('selectLowStock', () => {
  it('ค่าเริ่มต้น: เฉพาะใกล้หมด เรียงสัดส่วนคงเหลือ/จุดสั่งซื้อน้อยก่อน', () => {
    const r = selectLowStock(products)
    expect(r.items.map((x) => x.sku)).toEqual(['B', 'E', 'A'])
    expect(r.items[0].status).toBe('low')
    expect({ low: r.low, out: r.out, total: r.total }).toEqual({ low: 3, out: 2, total: 6 })
  })

  it('รวมสินค้าที่หมด: หมดขึ้นก่อน', () => {
    expect(selectLowStock(products, { includeOut: true }).items.map((x) => x.sku)).toEqual(['C', 'F', 'B', 'E', 'A'])
  })

  it('กรองหมวดหมู่ นับเฉพาะหมวดนั้น', () => {
    const r = selectLowStock(products, { category: 'สินค้าออนไลน์', includeOut: true })
    expect(r.items.map((x) => x.sku)).toEqual(['C', 'B', 'A'])
    expect({ low: r.low, out: r.out, total: r.total }).toEqual({ low: 2, out: 1, total: 4 })
  })
})

describe('stockRatio', () => {
  it('คงเหลือ / จุดสั่งซื้อ อยู่ระหว่าง 0–1', () => {
    expect(stockRatio(p('x', 5, 25))).toBe(0.2)
    expect(stockRatio(p('x', 50, 25))).toBe(1)
    expect(stockRatio(p('x', 0, 0))).toBe(0)
    expect(stockRatio(p('x', 3, 0))).toBe(1)
  })
})
