import { describe, expect, it } from 'vitest'
import { exportFileName, movementSheet, productSheet } from './spreadsheet.js'

const values = (row) => row.map((cell) => cell.value)

describe('productSheet', () => {
  const products = [
    {
      sku: '00123',
      barcode: '0885123456789',
      name: 'น้ำดื่ม',
      category: 'เครื่องดื่ม',
      unit: 'ขวด',
      reorderPoint: 10,
      onHand: 4,
      active: true,
    },
    { sku: 'US-2', barcode: null, name: 'สบู่', category: 'ของใช้', unit: 'ก้อน', reorderPoint: 0, onHand: 2.5, active: false },
  ]

  it('แถวแรกเป็นหัวคอลัมน์ภาษาไทย ตัวหนา', () => {
    const [header] = productSheet(products)
    expect(values(header)).toEqual([
      'รหัสสินค้า',
      'บาร์โค้ด',
      'ชื่อสินค้า',
      'หมวดหมู่',
      'หน่วย',
      'คงเหลือ',
      'จุดสั่งซื้อ',
      'สถานะสต็อก',
      'การใช้งาน',
    ])
    expect(header.every((cell) => cell.fontWeight === 'bold')).toBe(true)
  })

  it('รหัสและบาร์โค้ดเป็นข้อความ (Excel ไม่ตัดเลข 0 ข้างหน้า)', () => {
    const [, row] = productSheet(products)
    expect(row[0]).toMatchObject({ value: '00123', type: String })
    expect(row[1]).toMatchObject({ value: '0885123456789', type: String })
  })

  it('จำนวนเป็นตัวเลข และสถานะเป็นข้อความไทย', () => {
    const [, first, second] = productSheet(products)
    expect(first[5]).toMatchObject({ value: 4, type: Number })
    expect(first[6]).toMatchObject({ value: 10, type: Number })
    expect(values(first).slice(7)).toEqual(['ใกล้หมด', 'ใช้งาน'])
    expect(second[5].value).toBe(2.5)
    expect(values(second).slice(7)).toEqual(['ปกติ', 'ปิดใช้งาน'])
  })

  it('ไม่มีบาร์โค้ด เป็นช่องว่าง', () => {
    const [, , row] = productSheet(products)
    expect(row[1].value).toBe('')
  })

  it('ไม่มีสินค้า มีแต่หัวคอลัมน์', () => {
    expect(productSheet([])).toHaveLength(1)
  })
})

describe('movementSheet', () => {
  const movements = [
    {
      movementDate: '2026-09-29',
      productSku: '00123',
      productName: 'น้ำดื่ม',
      type: 'out',
      quantity: 3,
      unit: 'ขวด',
      recordedByName: 'มานี',
      note: null,
    },
    {
      movementDate: '2026-09-28',
      productSku: 'US-2',
      productName: 'สบู่',
      type: 'adjust',
      quantity: -1.5,
      unit: 'ก้อน',
      recordedByName: 'สมชาย',
      note: 'นับสต็อก',
    },
  ]

  it('หัวคอลัมน์ภาษาไทย', () => {
    expect(values(movementSheet(movements)[0])).toEqual([
      'วันที่',
      'รหัสสินค้า',
      'ชื่อสินค้า',
      'ประเภท',
      'จำนวน (+/−)',
      'หน่วย',
      'ผู้บันทึก',
      'หมายเหตุ',
    ])
  })

  it('วันที่ พ.ศ., ประเภทไทย, จำนวนมีเครื่องหมายตามประเภท', () => {
    const [, out, adjust] = movementSheet(movements)
    expect(values(out)).toEqual(['29 ก.ย. 2569', '00123', 'น้ำดื่ม', 'เบิกออก', -3, 'ขวด', 'มานี', ''])
    expect(values(adjust)).toEqual(['28 ก.ย. 2569', 'US-2', 'สบู่', 'ปรับยอด', -1.5, 'ก้อน', 'สมชาย', 'นับสต็อก'])
    expect(out[1].type).toBe(String)
    expect(out[4].type).toBe(Number)
  })
})

describe('exportFileName', () => {
  it('ชื่อไฟล์ตามชนิดและวันที่', () => {
    expect(exportFileName('products', '2026-09-29')).toBe('inventory-products-2026-09-29.xlsx')
    expect(exportFileName('movements', '2026-09-29')).toBe('inventory-movements-2026-09-29.xlsx')
  })
})
