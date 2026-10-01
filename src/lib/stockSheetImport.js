import { MONTH_LABELS, toGregorianYear } from './monthlySales.js'
import { validateProduct } from './stockRules.js'

// นำเข้าจากไฟล์ "บันทึกรายการสินค้าคลัง" ของร้าน: รหัสสินค้า + รูป (ฝังในไฟล์) + ยอดคงเหลือ
// ไฟล์ไม่มีชื่อ/หน่วย/หมวดหมู่ ใช้รหัสเป็นชื่อ หน่วย "ชิ้น" หมวดหมู่ "ไม่ระบุ" (แก้ทีหลังในหน้าจัดการสินค้าได้)

export const STOCK_SHEET_DEFAULTS = { unit: 'ชิ้น', category: 'ไม่ระบุ' }

export const STOCK_SHEET_ERROR = {
  NO_HEADER: 'ไม่พบหัวตาราง "รายการสินค้า" และ "ยอดรวมสินค้า" กรุณาใช้ไฟล์บันทึกรายการสินค้าคลัง',
}

const HEADER = {
  code: 'รายการสินค้า',
  pic: 'Pic',
  good: 'ของดีพร้อมขาย',
  repair: 'สินค้ารอซ่อม',
  total: 'ยอดรวมสินค้า',
  location: 'โลเคชั่น',
  avg: 'เฉลี่ย/เดือน',
}

const cellText = (value) => (value === null || value === undefined ? '' : String(value))
// ตัดช่องว่างหัวท้าย และช่องว่างซ้อนให้เหลือช่องเดียว
export const normalizeCode = (value) => cellText(value).trim().replace(/\s+/g, ' ')
const skuKey = (sku) => normalizeCode(sku).toLowerCase()
const toAmount = (value) => (cellText(value).trim() === '' ? 0 : Number(value))
// ยอดขายเฉลี่ย: ปัดทศนิยม 2 ตำแหน่ง (numeric(12,2)) ว่างหรือไม่ใช่ตัวเลข = null
const toAverage = (value) => {
  if (cellText(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// ปีของยอดขายจากหัวรายงาน เช่น "สรุปยอดขายปี 2569 …" คืน ค.ศ. ไม่พบคืน null
function findSalesYear(rows) {
  for (const r of rows) {
    for (const cell of r) {
      const m = cellText(cell).match(/ยอดขายปี\s*(\d{4})/)
      if (m) return toGregorianYear(Number(m[1]))
    }
  }
  return null
}

// rows = แถวจาก read-excel-file, row ในผลเป็นเลขแถวของ Excel (เริ่มที่ 1)
export function parseStockSheet(rows) {
  const headerIndex = rows.findIndex((r) => r.includes(HEADER.code) && r.includes(HEADER.total))
  if (headerIndex === -1) return { items: [], picColumn: -1, salesYear: null, error: STOCK_SHEET_ERROR.NO_HEADER }

  const header = rows[headerIndex]
  const col = Object.fromEntries(Object.entries(HEADER).map(([key, title]) => [key, header.indexOf(title)]))
  const monthCols = MONTH_LABELS.map((label) => header.indexOf(label))
  const salesYear = findSalesYear(rows.slice(0, headerIndex))
  const items = []
  rows.slice(headerIndex + 1).forEach((r, i) => {
    const code = normalizeCode(r[col.code])
    if (code === '') return
    items.push({
      row: headerIndex + 2 + i,
      code,
      good: col.good >= 0 ? toAmount(r[col.good]) : 0,
      repair: col.repair >= 0 ? toAmount(r[col.repair]) : 0,
      total: toAmount(r[col.total]),
      location: col.location >= 0 ? normalizeCode(r[col.location]) : '',
      avg: col.avg >= 0 ? toAverage(r[col.avg]) : null,
      // { เดือน 1–12: จำนวน } เฉพาะช่องที่มีตัวเลข
      monthly: Object.fromEntries(
        monthCols.flatMap((c, i) => {
          const value = c >= 0 ? toAverage(r[c]) : null
          return value === null || value < 0 ? [] : [[i + 1, value]]
        }),
      ),
    })
  })
  return { items, picColumn: col.pic, salesYear, error: null }
}

// --- รูปที่ฝังในไฟล์: sheet → drawing → media -------------------------------------

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null

// { rId: target } จากไฟล์ .rels
export function parseRels(xml) {
  const rels = {}
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) ?? []) rels[attr(tag, 'Id')] = attr(tag, 'Target')
  return rels
}

// target ใน .rels อ้างอิงจากโฟลเดอร์ของไฟล์ต้นทาง (เช่น "../media/image1.png")
export function resolvePath(fromFile, target) {
  if (target.startsWith('/')) return target.slice(1)
  const parts = fromFile.split('/').slice(0, -1)
  for (const part of target.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

const relsPathOf = (file) => {
  const parts = file.split('/')
  const name = parts.pop()
  return [...parts, '_rels', `${name}.rels`].join('/')
}

// คืน Map(แถว Excel → path ของรูปใน zip) แถวที่มีหลายรูป ใช้รูปในคอลัมน์ Pic ก่อน ไม่มีก็ใช้รูปแรก
export function mapImagesToRows(drawingXml, drawingRels, drawingFile, picColumn = -1) {
  const byRow = new Map()
  const anchors = drawingXml.split(/<xdr:(?:twoCellAnchor|oneCellAnchor|absoluteAnchor)\b/).slice(1)
  for (const anchor of anchors) {
    const from = anchor.match(/<xdr:from>\s*<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const embed = anchor.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)
    if (!from || !embed || !drawingRels[embed[1]]) continue
    const row = Number(from[2]) + 1
    const inPic = Number(from[1]) === picColumn
    const current = byRow.get(row)
    if (current && (current.inPic || !inPic)) continue
    byRow.set(row, { path: resolvePath(drawingFile, drawingRels[embed[1]]), inPic })
  }
  return new Map([...byRow].map(([row, { path }]) => [row, path]))
}

// รูปของชีตแรกในไฟล์ zip (จาก openZip) ไม่มีรูปคืน Map ว่าง
export async function readSheetImages(zip, picColumn = -1) {
  const workbookRels = parseRels((await zip.readText('xl/_rels/workbook.xml.rels')) ?? '')
  const workbook = (await zip.readText('xl/workbook.xml')) ?? ''
  const firstSheet = workbook.match(/<sheet\b[^>]*>/)?.[0]
  const sheetRid = firstSheet && (attr(firstSheet, 'r:id') ?? attr(firstSheet, 'id'))
  if (!sheetRid || !workbookRels[sheetRid]) return new Map()
  const sheetFile = resolvePath('xl/workbook.xml', workbookRels[sheetRid])

  const sheetRels = parseRels((await zip.readText(relsPathOf(sheetFile))) ?? '')
  const sheetXml = (await zip.readText(sheetFile)) ?? ''
  const drawingRid = attr(sheetXml.match(/<drawing\b[^>]*>/)?.[0] ?? '', 'r:id')
  if (!drawingRid || !sheetRels[drawingRid]) return new Map()
  const drawingFile = resolvePath(sheetFile, sheetRels[drawingRid])

  const drawingXml = (await zip.readText(drawingFile)) ?? ''
  const drawingRels = parseRels((await zip.readText(relsPathOf(drawingFile))) ?? '')
  return mapImagesToRows(drawingXml, drawingRels, drawingFile, picColumn)
}

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' }
// null = ชนิดที่เบราว์เซอร์เปิดเองไม่ได้ (เช่น emf/wmf) ข้ามรูปนั้น
export const imageTypeOf = (path) => IMAGE_TYPES[path.split('.').pop().toLowerCase()] ?? null

// --- แผนนำเข้า ---------------------------------------------------------------------

// existingProducts รวมที่ปิดใช้งาน: รหัสที่มีแล้วไม่เพิ่มซ้ำ (นำเข้าซ้ำได้เมื่อครั้งก่อนหยุดกลางทาง)
export function planStockImport(items, imagesByRow, existingProducts) {
  const existing = new Set(existingProducts.map((p) => skuKey(p.sku)))
  const seen = new Set()
  const plan = { entries: [], invalid: [] }

  for (const item of items) {
    const product = {
      sku: item.code,
      barcode: '',
      name: item.code,
      category: STOCK_SHEET_DEFAULTS.category,
      unit: STOCK_SHEET_DEFAULTS.unit,
      location: item.location ?? '',
      avgMonthlySales: item.avg ?? null,
      reorderPoint: 0,
    }
    const errors = Object.values(validateProduct(product))
    const quantity = item.total
    if (errors.length > 0) {
      plan.invalid.push({ row: item.row, sku: item.code, reason: errors[0] })
      continue
    }
    if (!Number.isFinite(quantity) || quantity < 0 || Math.round(quantity * 100) !== quantity * 100) {
      plan.invalid.push({ row: item.row, sku: item.code, reason: 'ยอดรวมต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง' })
      continue
    }
    const key = skuKey(product.sku)
    if (seen.has(key)) {
      plan.invalid.push({ row: item.row, sku: item.code, reason: 'รหัสซ้ำในไฟล์' })
      continue
    }
    seen.add(key)
    plan.entries.push({
      row: item.row,
      product,
      quantity,
      good: item.good,
      repair: item.repair,
      monthly: item.monthly ?? {},
      imagePath: imagesByRow.get(item.row) ?? null,
      exists: existing.has(key),
    })
  }
  return plan
}

export const repairNote = (fileName) => `ยอดรอซ่อมเริ่มต้นจากไฟล์ ${fileName}`

export const openingNote = (entry, fileName) =>
  `ยอดเริ่มต้นจากไฟล์ ${fileName} (ของดี ${entry.good}, รอซ่อม ${entry.repair})`

export { skuKey }
