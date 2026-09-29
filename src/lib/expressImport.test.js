import { describe, expect, it } from 'vitest'
import { IMPORT_ERROR, parseExpressReport, planImport } from './expressImport.js'

// รูปแบบเดียวกับรายงาน "สินค้าและวัตถุดิบ" ของ Express: หัวรายงาน 4 แถว, หัวตาราง, แถวว่างคั่น
const report = [
  [null, 'บริษัท ตัวอย่าง จำกัด', null],
  [null, 'รายงานสินค้าและวัตถุดิบ    วันที่ 1 ส.ค. 2569     ถึง 31 ส.ค. 2569', null],
  [null, 'รหัสสินค้า จาก  A  ถึง  Z', null],
  [null, null, null, null, null, null, null, null, null, null, null, null, 'รายการรับ'],
  [null, 'หมวดสินค้า', null, 'รหัสสินค้า', 'รายละเอียดสินค้า', null, 'หน่วย', 'นับเป็น', 'ตัวคูณ', 'รหัสบ/ช'],
  [null, null, null, null, null, null, null, null, null, null],
  [null, 'บก', 'สินค้าบริการ', '4100-05', 'ค่าบริการจัดส่งสินค้า', null, 'ย่อย', 'รายการ', null, 'IC'],
  [null, null, null, null, null, null, null, null, null, null],
  [null, 'IM2', 'เตาแก็ส GL', 'GL702I', 'เตาแก๊สหน้ากระจก 2 หัว', null, 'ย่อย', 'PCS.', null, 'ST01'],
  [null, 'IM2', 'สินค้านำเข้าไฟฟ้า', ' AF8024 ', ' เตาทอดไร้น้ำมัน ', null, 'ย่อย', 'PCS.', null, 'ST01'],
  [null, 'KB', 'เตาแม่ค้า', 'KB-01', 'เตาแม่ค้า 1 หัว', null, 'ย่อย', 'KGS.', null, 'ST02'],
  [null, 'SL', 'วัสดุสิ้นเปลืองผลิต', 'SL-9', 'ถุงมือ', null, 'ย่อย', 'คู่', null, 'SL'],
  [null, 'KB', 'เตาแม่ค้า', 'KB-02', null, null, 'ย่อย', 'PCS.', null, 'ST02'],
  [null, 'KB', 'เตาแม่ค้า', 'KB-01', 'ซ้ำในไฟล์', null, 'ย่อย', 'PCS.', null, 'ST02'],
]

describe('parseExpressReport', () => {
  it('หาหัวตารางเอง ข้ามหัวรายงานและแถวว่าง', () => {
    const { items, error } = parseExpressReport(report)
    expect(error).toBeNull()
    expect(items.map((i) => i.sku)).toEqual(['4100-05', 'GL702I', ' AF8024 ', 'KB-01', 'SL-9', 'KB-02', 'KB-01'])
  })

  it('อ่านชื่อหมวดจากคอลัมน์ถัดจากรหัสหมวด และหน่วยจาก "นับเป็น"', () => {
    const { items } = parseExpressReport(report)
    expect(items[1]).toEqual({
      row: 9,
      sku: 'GL702I',
      name: 'เตาแก๊สหน้ากระจก 2 หัว',
      category: 'เตาแก็ส GL',
      unit: 'PCS.',
      account: 'ST01',
    })
  })

  it('ไม่พบหัวตาราง = ไม่ใช่ไฟล์รายงานสินค้าของ Express', () => {
    expect(parseExpressReport([['ชื่อ', 'ราคา'], ['ก', 1]])).toEqual({ items: [], error: IMPORT_ERROR.NO_HEADER })
  })

  it('ไฟล์ว่าง', () => {
    expect(parseExpressReport([]).error).toBe(IMPORT_ERROR.NO_HEADER)
  })
})

describe('planImport', () => {
  const { items } = parseExpressReport(report)
  const existing = [{ sku: 'GL702I' }]
  const plan = planImport(items, existing)

  it('นำเข้าเฉพาะกลุ่มสินค้า (รหัสบ/ช ขึ้นต้นด้วย ST) ที่ยังไม่มีในระบบ ตัดช่องว่าง จุดสั่งซื้อ 0', () => {
    expect(plan.toInsert).toEqual([
      { sku: 'AF8024', barcode: '', name: 'เตาทอดไร้น้ำมัน', category: 'สินค้านำเข้าไฟฟ้า', unit: 'PCS.', reorderPoint: 0 },
      { sku: 'KB-01', barcode: '', name: 'เตาแม่ค้า 1 หัว', category: 'เตาแม่ค้า', unit: 'KGS.', reorderPoint: 0 },
    ])
  })

  it('นับรายการที่ข้าม', () => {
    expect(plan.skippedNonStock).toBe(2)
    expect(plan.skippedExisting).toBe(1)
  })

  it('แถวผิด: ข้อมูลไม่ครบ และรหัสซ้ำในไฟล์ พร้อมเลขแถว', () => {
    expect(plan.invalid).toEqual([
      { row: 13, sku: 'KB-02', reason: 'กรุณากรอกชื่อสินค้า' },
      { row: 14, sku: 'KB-01', reason: 'รหัสซ้ำในไฟล์' },
    ])
  })

  it('รหัสที่มีอยู่แล้วเทียบแบบไม่สนตัวพิมพ์และช่องว่าง', () => {
    const again = planImport(items, [{ sku: 'gl702i' }, { sku: 'af8024' }])
    expect(again.toInsert.map((p) => p.sku)).toEqual(['KB-01'])
    expect(again.skippedExisting).toBe(2)
  })
})
