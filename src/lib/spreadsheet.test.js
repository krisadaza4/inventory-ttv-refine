import { describe, expect, it } from 'vitest'
import { backupSheets, exportFileName, movementSheet, productSheet } from './spreadsheet.js'

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
      repairQty: 3,
      avgMonthlySales: 12.5,
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
      'โลเคชั่น',
      'คงเหลือ (ของดี)',
      'รอซ่อม',
      'จุดสั่งซื้อ',
      'ขายเฉลี่ย/เดือน',
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
    expect(first[6]).toMatchObject({ value: 4, type: Number })
    expect(first[7]).toMatchObject({ value: 3, type: Number })
    expect(first[8]).toMatchObject({ value: 10, type: Number })
    expect(first[9]).toMatchObject({ value: 12.5, type: Number })
    expect(values(first).slice(10)).toEqual(['ใกล้หมด', 'ใช้งาน'])
    expect(second[6].value).toBe(2.5)
    expect(second[7].value).toBe(0)
    expect(second[9]).toMatchObject({ value: '', type: String })
    expect(values(second).slice(10)).toEqual(['ปกติ', 'ปิดใช้งาน'])
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

describe('monthlySalesSheet', () => {
  it('หัวคอลัมน์ 12 เดือน + รวม + เฉลี่ย เดือนว่างเป็นช่องว่าง', async () => {
    const { monthlySalesSheet } = await import('./spreadsheet.js')
    const months = Array(12).fill(null)
    months[0] = 205
    const [head, row] = monthlySalesSheet([{ product: { sku: 'A', name: 'เอ' }, months, total: 205, average: 17.08 }])
    expect(head).toHaveLength(16)
    expect(head[2].value).toBe('ม.ค.')
    expect(row[2]).toMatchObject({ value: 205, type: Number })
    expect(row[3]).toMatchObject({ value: '', type: String })
    expect(row[15]).toMatchObject({ value: 17.08, type: Number })
  })
})

describe('backupSheets', () => {
  const products = [
    {
      id: 'p1',
      sku: 'A-1',
      legacySku: 'OLD-1',
      imagePath: 'products/p1.jpg',
      barcode: '',
      name: 'เอ',
      category: 'ไม่ระบุ',
      unit: 'ชิ้น',
      location: '',
      onHand: 3,
      repairQty: 0,
      reorderPoint: 1,
      avgMonthlySales: null,
      active: false,
    },
  ]
  const movements = [
    {
      movementDate: '2026-10-02',
      productSku: 'A-1',
      productName: 'เอ',
      type: 'in',
      quantity: 3,
      unit: 'ชิ้น',
      recordedByName: 'admin',
      note: '',
    },
  ]
  const sales = [{ productId: 'p1', year: 2026, month: 1, quantity: 205 }]

  it('3 แผ่นงาน หัวตารางค้าง', () => {
    const sheets = backupSheets({ products, movements, sales })
    expect(sheets.map((s) => s.sheet)).toEqual(['สินค้า', 'ประวัติ', 'ยอดขายรายเดือน'])
    expect(sheets.every((s) => s.stickyRowsCount === 1)).toBe(true)
    expect(sheets[1].data).toHaveLength(2)
  })

  it('สินค้ามีรหัสเดิม ไฟล์รูป และรหัสระบบต่อท้าย รวมที่ปิดใช้งาน', () => {
    const [head, row] = backupSheets({ products, movements, sales })[0].data
    expect(values(head).slice(-3)).toEqual(['รหัสเดิม', 'ไฟล์รูป', 'รหัสระบบ'])
    expect(values(row).slice(-3)).toEqual(['OLD-1', 'products/p1.jpg', 'p1'])
    expect(values(row)).toContain('ปิดใช้งาน')
  })

  it('ยอดขาย: ปี พ.ศ. ชื่อเดือนไทย และรหัสสินค้า', () => {
    const [, row] = backupSheets({ products, movements, sales })[2].data
    expect(values(row)).toEqual(['A-1', 'เอ', 2569, 'ม.ค.', 205])
  })
})
