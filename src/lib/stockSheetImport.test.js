import { describe, expect, it } from 'vitest'
import {
  STOCK_SHEET_DEFAULTS,
  STOCK_SHEET_ERROR,
  imageTypeOf,
  mapImagesToRows,
  normalizeCode,
  openingNote,
  parseRels,
  parseStockSheet,
  planStockImport,
  readSheetImages,
  resolvePath,
} from './stockSheetImport.js'

// รูปแบบเดียวกับไฟล์ "บันทึกรายการสินค้าคลัง": หัวรายงาน 1 แถว แล้วหัวตาราง
const sheet = [
  ['บันทึกรายการสินค้าคลังประจำปี 2026', null, null, null, null, null, null, null, 'สรุปยอดขายปี 2569 เดือน มกราคม - ธันวาคม'],
  ['ลำดับที่', 'รายการสินค้า', 'Pic', 'ของดีพร้อมขาย', 'สินค้ารอซ่อม', 'ยอดรวมสินค้า', 'โลเคชั่น', 'เฉลี่ย/เดือน', 'ม.ค.', 'ก.พ.'],
  [1, 'GL-101I', null, 1786, null, 1786, ' แลค  A6,B5 ', 64.756, 205, null],
  [2, ' GL-203I ', null, 480, 800, 1280],
  [3, null, null, null, null, null],
  [4, 'WX102   ใหม่ เปลี่ยนสปาร์คแล้ว', null, 0, null, 0],
  [5, 'gl-101i', null, 1, null, 1],
  [6, 'BAD', null, null, null, -3],
]

describe('normalizeCode', () => {
  it('ตัดช่องว่างหัวท้ายและช่องว่างซ้อน', () => {
    expect(normalizeCode('  KB10+VAB   ออนไลน์ ')).toBe('KB10+VAB ออนไลน์')
    expect(normalizeCode(null)).toBe('')
  })
})

describe('parseStockSheet', () => {
  it('หาหัวตารางเอง อ่านรหัส ยอดดี รอซ่อม ยอดรวม พร้อมเลขแถว Excel', () => {
    const { items, picColumn, salesYear, error } = parseStockSheet(sheet)
    expect(error).toBeNull()
    expect(picColumn).toBe(2)
    expect(salesYear).toBe(2026)
    expect(items[0]).toEqual({ row: 3, code: 'GL-101I', good: 1786, repair: 0, total: 1786, location: 'แลค A6,B5', avg: 64.76, monthly: { 1: 205 } })
    expect(items[1]).toEqual({ row: 4, code: 'GL-203I', good: 480, repair: 800, total: 1280, location: '', avg: null, monthly: {} })
    expect(items.map((i) => i.row)).toEqual([3, 4, 6, 7, 8])
  })

  it('ไม่มีหัวตาราง คืนข้อความผิดพลาด', () => {
    expect(parseStockSheet([['a', 'b']]).error).toBe(STOCK_SHEET_ERROR.NO_HEADER)
  })
})

describe('planStockImport', () => {
  const { items } = parseStockSheet(sheet)
  const images = new Map([[3, 'xl/media/image1.png']])

  it('ใช้รหัสเป็นชื่อ ใส่หน่วยและหมวดหมู่ค่าเริ่มต้น ยอดใช้ยอดรวม', () => {
    const plan = planStockImport(items, images, [])
    expect(plan.entries[0]).toEqual({
      row: 3,
      product: {
        sku: 'GL-101I',
        barcode: '',
        name: 'GL-101I',
        category: STOCK_SHEET_DEFAULTS.category,
        unit: STOCK_SHEET_DEFAULTS.unit,
        location: 'แลค A6,B5',
        avgMonthlySales: 64.76,
        reorderPoint: 0,
      },
      quantity: 1786,
      good: 1786,
      repair: 0,
      monthly: { 1: 205 },
      imagePath: 'xl/media/image1.png',
      exists: false,
    })
    expect(plan.entries[1].imagePath).toBeNull()
  })

  it('รหัสซ้ำในไฟล์ (ไม่สนตัวพิมพ์) และยอดติดลบไม่นำเข้า', () => {
    const plan = planStockImport(items, images, [])
    expect(plan.entries.map((e) => e.product.sku)).toEqual(['GL-101I', 'GL-203I', 'WX102 ใหม่ เปลี่ยนสปาร์คแล้ว'])
    expect(plan.invalid.map((x) => [x.row, x.reason])).toEqual([
      [7, 'รหัสซ้ำในไฟล์'],
      [8, 'ยอดรวมต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง'],
    ])
  })

  it('ทำเครื่องหมายรหัสที่มีในระบบแล้ว (นำเข้าซ้ำได้)', () => {
    const plan = planStockImport(items, images, [{ sku: 'gl-203i ' }])
    expect(plan.entries.map((e) => e.exists)).toEqual([false, true, false])
  })
})

describe('openingNote', () => {
  it('บอกที่มาและแยกยอดดี/รอซ่อม', () => {
    expect(openingNote({ good: 480, repair: 800 }, 'stock.xlsx')).toBe(
      'ยอดเริ่มต้นจากไฟล์ stock.xlsx (ของดี 480, รอซ่อม 800)',
    )
  })
})

describe('รูปที่ฝังในไฟล์', () => {
  it('resolvePath อ้างอิงจากโฟลเดอร์ของไฟล์ต้นทาง', () => {
    expect(resolvePath('xl/drawings/drawing1.xml', '../media/image1.png')).toBe('xl/media/image1.png')
    expect(resolvePath('xl/workbook.xml', 'worksheets/sheet1.xml')).toBe('xl/worksheets/sheet1.xml')
    expect(resolvePath('xl/workbook.xml', '/xl/worksheets/sheet2.xml')).toBe('xl/worksheets/sheet2.xml')
  })

  it('parseRels อ่าน Id → Target', () => {
    const xml = '<Relationships><Relationship Id="rId1" Type="x" Target="../media/a.png"/></Relationships>'
    expect(parseRels(xml)).toEqual({ rId1: '../media/a.png' })
  })

  const anchor = (col, row, rid) =>
    `<xdr:twoCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row></xdr:from>` +
    `<xdr:pic><xdr:blipFill><a:blip xmlns:r="r" r:embed="${rid}"><a:extLst><a14:imgLayer r:embed="rIdHd"/></a:extLst></a:blip></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>`
  const rels = { rId1: '../media/image1.png', rId2: '../media/image2.jpeg', rId3: '../media/image3.png' }

  it('แถวละหนึ่งรูป เลือกรูปในคอลัมน์ Pic ก่อน ไม่มีก็ใช้รูปแรก ข้ามรูปที่ไม่มี rel', () => {
    const xml = `<xdr:wsDr>${anchor(1, 2, 'rId1')}${anchor(2, 2, 'rId2')}${anchor(2, 3, 'rId3')}${anchor(2, 4, 'rId3')}${anchor(1, 5, 'rId1')}${anchor(1, 5, 'rId2')}${anchor(2, 6, 'rIdX')}</xdr:wsDr>`
    const map = mapImagesToRows(xml, rels, 'xl/drawings/drawing1.xml', 2)
    expect([...map]).toEqual([
      [3, 'xl/media/image2.jpeg'],
      [4, 'xl/media/image3.png'],
      [5, 'xl/media/image3.png'],
      [6, 'xl/media/image1.png'],
    ])
  })

  it('readSheetImages ไล่จาก workbook → sheet → drawing', async () => {
    const files = {
      'xl/workbook.xml': '<workbook><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<worksheet><drawing r:id="rId9"/></worksheet>',
      'xl/worksheets/_rels/sheet1.xml.rels':
        '<Relationships><Relationship Id="rId9" Target="../drawings/drawing1.xml"/></Relationships>',
      'xl/drawings/drawing1.xml': `<xdr:wsDr>${anchor(2, 2, 'rId1')}</xdr:wsDr>`,
      'xl/drawings/_rels/drawing1.xml.rels':
        '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>',
    }
    const zip = { readText: async (name) => files[name] ?? null }
    expect([...(await readSheetImages(zip, 2))]).toEqual([[3, 'xl/media/image1.png']])
  })

  it('ไฟล์ไม่มีรูปคืน Map ว่าง', async () => {
    const zip = { readText: async () => null }
    expect((await readSheetImages(zip)).size).toBe(0)
  })

  it('imageTypeOf รู้จัก png/jpeg ส่วน emf คืน null', () => {
    expect(imageTypeOf('xl/media/a.PNG')).toBe('image/png')
    expect(imageTypeOf('xl/media/a.jpeg')).toBe('image/jpeg')
    expect(imageTypeOf('xl/media/a.emf')).toBeNull()
  })
})
