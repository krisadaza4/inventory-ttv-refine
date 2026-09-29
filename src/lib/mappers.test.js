import { describe, expect, it } from 'vitest'
import { toMovement, toProduct, toProductRow, toProfile } from './mappers.js'

describe('toProduct', () => {
  it('แปลงแถวจาก product_stock และแปลง numeric เป็นตัวเลข', () => {
    const row = {
      id: 'p1',
      sku: 'DR-001',
      barcode: null,
      name: 'น้ำดื่ม',
      category: 'เครื่องดื่ม',
      unit: 'ขวด',
      reorder_point: '5.00',
      active: true,
      on_hand: '12.50',
    }
    expect(toProduct(row)).toEqual({
      id: 'p1',
      sku: 'DR-001',
      barcode: null,
      name: 'น้ำดื่ม',
      category: 'เครื่องดื่ม',
      unit: 'ขวด',
      reorderPoint: 5,
      active: true,
      onHand: 12.5,
    })
  })
})

describe('toProductRow', () => {
  const product = {
    id: 'p1',
    sku: ' DR-001 ',
    barcode: ' 885 ',
    name: ' น้ำดื่ม ',
    category: ' เครื่องดื่ม ',
    unit: ' ขวด ',
    reorderPoint: '5',
    active: false,
    onHand: 10,
    createdAt: 'x',
  }

  it('ส่งเฉพาะคอลัมน์ที่ grant ไว้ (ไม่มี id, active, on_hand, created_at)', () => {
    expect(Object.keys(toProductRow(product)).sort()).toEqual([
      'barcode',
      'category',
      'name',
      'reorder_point',
      'sku',
      'unit',
    ])
  })

  it('ตัดช่องว่างและแปลงจุดสั่งซื้อเป็นตัวเลข', () => {
    expect(toProductRow(product)).toEqual({
      sku: 'DR-001',
      barcode: '885',
      name: 'น้ำดื่ม',
      category: 'เครื่องดื่ม',
      unit: 'ขวด',
      reorder_point: 5,
    })
  })

  it('บาร์โค้ดว่างส่งเป็น null (ไม่ชน unique และ check)', () => {
    expect(toProductRow({ ...product, barcode: '  ' }).barcode).toBeNull()
    expect(toProductRow({ ...product, barcode: undefined }).barcode).toBeNull()
  })

  it('จุดสั่งซื้อว่างเป็น 0', () => {
    expect(toProductRow({ ...product, reorderPoint: '' }).reorder_point).toBe(0)
  })
})

describe('toMovement', () => {
  const row = {
    id: 'm1',
    product_id: 'p1',
    type: 'out',
    quantity: '2.50',
    movement_date: '2026-09-29',
    note: null,
    created_by: 'u1',
    created_at: '2026-09-29T03:00:00Z',
    product: { name: 'น้ำดื่ม', sku: 'DR-001', unit: 'ขวด' },
    recorder: { display_name: 'สมชาย' },
  }

  it('แปลงแถวพร้อมข้อมูลสินค้าและผู้บันทึก', () => {
    expect(toMovement(row)).toEqual({
      id: 'm1',
      productId: 'p1',
      type: 'out',
      quantity: 2.5,
      movementDate: '2026-09-29',
      note: null,
      createdBy: 'u1',
      createdAt: '2026-09-29T03:00:00Z',
      productName: 'น้ำดื่ม',
      productSku: 'DR-001',
      unit: 'ขวด',
      recordedByName: 'สมชาย',
    })
  })

  it('แถวจาก record_movement ไม่มีข้อมูลที่ join มา ได้ค่าว่าง', () => {
    const { product: _p, recorder: _r, ...plain } = row
    const movement = toMovement(plain)
    expect(movement.productName).toBe('')
    expect(movement.recordedByName).toBe('')
  })
})

describe('toProfile', () => {
  it('แปลงแถว profiles', () => {
    expect(toProfile({ id: 'u1', display_name: 'สมชาย', role: 'admin' })).toEqual({
      id: 'u1',
      displayName: 'สมชาย',
      role: 'admin',
    })
  })

  it('ไม่มีแถว คืน null', () => {
    expect(toProfile(null)).toBeNull()
  })
})
