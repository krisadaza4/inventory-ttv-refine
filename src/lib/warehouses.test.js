import { describe, expect, it } from 'vitest'
import {
  activeWarehouses,
  attachWarehouses,
  nextSortOrder,
  productsInWarehouse,
  quantityIn,
  stockFor,
  validateWarehouseName,
} from './warehouses.js'

const warehouses = [
  { id: 'w2', name: 'ขายส่ง', sortOrder: 2, active: true },
  { id: 'w1', name: 'Online', sortOrder: 1, active: true },
  { id: 'w3', name: 'เก่า', sortOrder: 0, active: false },
]

const products = [
  { id: 'p1', name: 'A', onHand: 10, repairQty: 1, subQty: 4 },
  { id: 'p2', name: 'B', onHand: 5, repairQty: 0, subQty: 0 },
  { id: 'p3', name: 'C', onHand: 2, repairQty: 0 },
]

const links = [
  { productId: 'p1', warehouseId: 'w1' },
  { productId: 'p2', warehouseId: 'w1' },
  { productId: 'p2', warehouseId: 'w2' },
]

const stockRows = [
  { warehouseId: 'w1', productId: 'p1', quantity: '3.00' },
  { warehouseId: 'w2', productId: 'p1', quantity: 1 },
  { warehouseId: 'w2', productId: 'p3', quantity: 0 },
]

describe('activeWarehouses', () => {
  it('เฉพาะที่ใช้งาน เรียงตามลำดับ', () => {
    expect(activeWarehouses(warehouses).map((w) => w.id)).toEqual(['w1', 'w2'])
  })
})

describe('attachWarehouses', () => {
  const result = attachWarehouses(products, links, stockRows)

  it('คลังใหญ่ = ของดีรวม - ในคลังย่อย', () => {
    expect(result.map((p) => p.centralQty)).toEqual([6, 5, 2])
  })

  it('ยอดแยกตามคลัง', () => {
    expect(result[0].warehouseQty).toEqual({ w1: 3, w2: 1 })
    expect(quantityIn(result[0], 'w2')).toBe(1)
    expect(quantityIn(result[1], 'w2')).toBe(0)
  })

  it('อยู่ในคลังที่ผูกไว้ หรือที่ยังมียอดค้าง (ยอด 0 ที่ไม่ได้ผูก ไม่นับ)', () => {
    expect(result[0].warehouseIds.toSorted()).toEqual(['w1', 'w2'])
    expect(result[1].warehouseIds.toSorted()).toEqual(['w1', 'w2'])
    expect(result[2].warehouseIds).toEqual([])
  })
})

describe('productsInWarehouse', () => {
  const all = attachWarehouses(products, links, stockRows)

  it('ขายได้ = ในคลังนี้ + คลังใหญ่', () => {
    const online = productsInWarehouse(all, 'w1')
    expect(online.map((p) => [p.id, p.inWarehouse, p.sellable])).toEqual([
      ['p1', 3, 9],
      ['p2', 0, 5],
    ])
  })

  it('คลังที่ไม่มีสินค้า คืนรายการว่าง', () => {
    expect(productsInWarehouse(all, 'w9')).toEqual([])
  })
})

describe('stockFor', () => {
  const [p1] = attachWarehouses(products, links, stockRows)

  it('คลังใหญ่ไม่มียอดคลังย่อยที่เลือก', () => {
    expect(stockFor(p1, '')).toEqual({ onHand: 10, repairQty: 1, subQty: 4, warehouseQty: 0 })
  })

  it('คลังย่อยส่งยอดคลังนั้นไปด้วย', () => {
    expect(stockFor(p1, 'w1')).toMatchObject({ warehouseQty: 3 })
  })
})

describe('validateWarehouseName', () => {
  it('ว่าง / ซ้ำ (ไม่สนตัวพิมพ์) / ชื่อคลังใหญ่ ไม่ได้', () => {
    expect(validateWarehouseName('  ', warehouses)).toBe('กรุณาพิมพ์ชื่อคลัง')
    expect(validateWarehouseName('online', warehouses)).toBe('ชื่อคลังนี้มีอยู่แล้ว')
    expect(validateWarehouseName('คลังใหญ่', warehouses)).toBe('ชื่อนี้ใช้กับคลังใหญ่แล้ว')
  })

  it('ชื่อใหม่ หรือแก้คลังเดิมโดยใช้ชื่อเดิม ได้', () => {
    expect(validateWarehouseName('หน้าร้าน', warehouses)).toBeNull()
    expect(validateWarehouseName('Online', warehouses, 'w1')).toBeNull()
  })
})

describe('nextSortOrder', () => {
  it('ต่อท้ายลำดับสูงสุด', () => {
    expect(nextSortOrder(warehouses)).toBe(3)
    expect(nextSortOrder([])).toBe(1)
  })
})
