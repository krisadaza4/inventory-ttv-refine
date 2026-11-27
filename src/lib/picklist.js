// อ่านใบรายการหยิบสินค้า (PDF) ที่โหลดจากเว็บ seller: Shopee (Picklist), Lazada (Checklist), TikTok (Picking List)
// รับข้อความจาก PDF เป็นหน้า ๆ: pages = [[{ s: ข้อความ, x, y: ระยะจากขอบบน, w }]] (ดู pdfText.js)
// ใช้ตำแหน่งคอลัมน์จากหัวตาราง อ่านเฉพาะ SKU / จำนวน / เลขคำสั่งซื้อ (ชื่อสินค้าภาษาไทยใน PDF อ่านออกมาเพี้ยน ไม่ใช้)

export const PLATFORM = { SHOPEE: 'shopee', LAZADA: 'lazada', TIKTOK: 'tiktok' }
export const PLATFORM_LABEL = { shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok' }

const SAME_LINE = 2.5 // ข้อความที่ y ต่างกันไม่เกินนี้ถือว่าอยู่บรรทัดเดียวกัน
const NUMBER = /^\d+(\.\d+)?$/

const text = (item) => item.s.trim()
const sortByLine = (a, b) => (Math.abs(a.y - b.y) <= SAME_LINE ? a.x - b.x : a.y - b.y)
const cleanSku = (parts) => parts.join('').replace(/\s+/g, ' ').trim()

// แพลตฟอร์มของไฟล์จากหัวกระดาษ ไม่รู้จักคืน null
export function detectPlatform(pages) {
  const all = pages.flat().map(text)
  const has = (re) => all.some((s) => re.test(s))
  if (has(/^Picking List$/i) && has(/^Seller SKU$/i)) return PLATFORM.TIKTOK
  if (has(/^Checklist printed on/i) || (has(/^Order Number$/i) && has(/^Quantity$/i))) return PLATFORM.LAZADA
  if (has(/^Picklist$/i) && has(/^Parent SKU$/i)) return PLATFORM.SHOPEE
  return null
}

const findLabel = (page, re) => page.find((item) => re.test(text(item)))
const inColumn = (item, from, to) => item.x >= from && item.x < to

// แถวตามคอลัมน์หลัก (เลขคำสั่งซื้อ หรือจำนวน) ส่วนอื่นของแถวคือข้อความที่อยู่ระหว่างแถวนี้กับแถวถัดไป
function bands(anchors) {
  const sorted = anchors.toSorted((a, b) => a.y - b.y)
  return sorted.map((item, i) => ({ anchor: item, top: item.y - SAME_LINE, bottom: i + 1 < sorted.length ? sorted[i + 1].y - SAME_LINE : Infinity }))
}

const within = (item, band) => item.y >= band.top && item.y < band.bottom

// Lazada / TikTok: สินค้าเดียวกันจากหลายคำสั่งซื้อ อาจพิมพ์เป็นแถวเดียว (จำนวนรวม) แล้วเรียงเลขคำสั่งซื้อซ้อนลงมา
// แถวหลัก = เลขคำสั่งซื้อที่มีจำนวนอยู่บรรทัดเดียวกัน เลขที่ไม่มีจำนวนบนบรรทัด = เป็นของแถวด้านบน
function splitOrderItems(page, orderItems, qtyX) {
  const hasQty = (order) =>
    page.some((item) => Math.abs(item.y - order.y) <= SAME_LINE && Math.abs(item.x - qtyX) <= 8 && NUMBER.test(text(item)))
  return { anchors: orderItems.filter(hasQty), stacked: orderItems.filter((order) => !hasQty(order)) }
}

// ใส่เลขคำสั่งซื้อที่ซ้อนอยู่ให้แถวที่มันอยู่ใต้ (ก่อนแถวแรกของหน้า = แถวสุดท้ายของหน้าก่อน)
function attachStacked(stacked, pageBands, pageRows, rows) {
  for (const order of stacked.toSorted((a, b) => a.y - b.y)) {
    const index = pageBands.findIndex((band) => within(order, band))
    const target = index >= 0 ? pageRows[index] : pageBands.length === 0 || order.y < pageBands[0].top ? rows.at(-pageRows.length - 1) : null
    if (target && !target.orders.includes(text(order))) target.orders.push(text(order))
  }
}

function quantityAt(page, band, x) {
  const found = page.find((item) => Math.abs(item.y - band.anchor.y) <= SAME_LINE && Math.abs(item.x - x) <= 8 && NUMBER.test(text(item)))
  return found ? Number(text(found)) : null
}

// Lazada: หนึ่งแถวต่อหนึ่งคำสั่งซื้อ SKU อาจถูกตัดเป็นหลายบรรทัด เช่น "KB8A-" / "VAB"
function parseLazada(pages) {
  const rows = []
  let cols = null
  for (const page of pages) {
    const sku = findLabel(page, /^SKU$/)
    const image = findLabel(page, /^Image$/)
    const order = findLabel(page, /^Order Number$/)
    const qty = findLabel(page, /^Quantity$/)
    if (sku && order && qty) cols = { skuFrom: sku.x - 3, skuTo: (image ?? order).x - 3, orderX: order.x, qtyX: qty.x, headY: sku.y }
    if (!cols) continue
    const headY = sku ? cols.headY : -Infinity
    const orderItems = page.filter((item) => item.y > headY + SAME_LINE && Math.abs(item.x - cols.orderX) <= 8 && /^\d{6,}$/.test(text(item)))
    const { anchors, stacked } = splitOrderItems(page, orderItems, cols.qtyX)
    const pageBands = bands(anchors)
    const pageRows = []
    for (const band of pageBands) {
      const parts = page.filter((item) => within(item, band) && inColumn(item, cols.skuFrom, cols.skuTo)).toSorted(sortByLine).map(text)
      const row = { sku: cleanSku(parts), quantity: quantityAt(page, band, cols.qtyX), orders: [text(band.anchor)] }
      rows.push(row)
      pageRows.push(row)
    }
    attachStacked(stacked, pageBands, pageRows, rows)
  }
  return { rows, expectedTotal: null }
}

// TikTok: ใช้ Seller SKU (ถ้าว่างใช้ SKU) สินค้าเดียวกันหลายคำสั่งซื้ออาจรวมเป็นแถวเดียว เลขคำสั่งซื้อซ้อนลงมา
// หัวกระดาษมี "Item quantity: N" (ตรวจยอดรวม) และ "Order quantity: N" (ตรวจจำนวนคำสั่งซื้อ)
function parseTiktok(pages) {
  const rows = []
  let cols = null
  let expectedTotal = null
  let expectedOrders = null
  for (const page of pages) {
    for (const item of page) {
      const m = /^Item quantity:\s*(\d+)/i.exec(text(item))
      if (m) expectedTotal = Number(m[1])
      const o = /^Order quantity:\s*(\d+)/i.exec(text(item))
      if (o) expectedOrders = Number(o[1])
    }
    const seller = findLabel(page, /^Seller SKU$/i)
    const sku = page.find((item) => text(item) === 'SKU')
    const qty = findLabel(page, /^Qty$/i)
    const order = findLabel(page, /^Order ID$/i)
    if (seller && qty && order) {
      cols = { skuFrom: (sku ?? seller).x - 3, sellerFrom: seller.x - 3, qtyX: qty.x, orderX: order.x, headY: seller.y }
    }
    if (!cols) continue
    const headY = seller ? cols.headY : -Infinity
    const orderItems = page.filter((item) => item.y > headY + SAME_LINE && Math.abs(item.x - cols.orderX) <= 8 && /^\d{6,}$/.test(text(item)))
    const { anchors, stacked } = splitOrderItems(page, orderItems, cols.qtyX)
    const pageBands = bands(anchors)
    const pageRows = []
    for (const band of pageBands) {
      const pick = (from, to) => page.filter((item) => within(item, band) && inColumn(item, from, to)).toSorted(sortByLine).map(text)
      const sellerSku = cleanSku(pick(cols.sellerFrom, cols.qtyX - 3))
      const platformSku = cleanSku(pick(cols.skuFrom, cols.sellerFrom))
      const row = { sku: sellerSku || platformSku, quantity: quantityAt(page, band, cols.qtyX), orders: [text(band.anchor)] }
      rows.push(row)
      pageRows.push(row)
    }
    attachStacked(stacked, pageBands, pageRows, rows)
  }
  return { rows, expectedTotal, expectedOrders }
}

// Shopee: หนึ่งแถวต่อหนึ่ง SKU จำนวน = รวมทุกคำสั่งซื้อ เลขคำสั่งซื้อเรียงลงมาใต้แถว (ต่อไปหน้าถัดไปได้)
function parseShopee(pages) {
  const rows = []
  let cols = null
  for (const page of pages) {
    const parent = findLabel(page, /^Parent SKU$/i)
    let headY = -Infinity
    if (parent) {
      const head = page.filter((item) => Math.abs(item.y - parent.y) <= SAME_LINE).toSorted((a, b) => a.x - b.x)
      const skuIndex = head.findIndex((item) => text(item) === 'SKU')
      if (skuIndex > 0 && head.length >= skuIndex + 4) {
        const before = head[skuIndex - 1]
        // หัวคอลัมน์ "เลข SKU" ถูกแยกเป็น "เลข" + "SKU"
        const skuFrom = before !== parent && head[skuIndex].x - before.x < 30 ? before.x : head[skuIndex].x
        cols = { indexX: head[0].x, skuFrom: skuFrom - 3, skuTo: head[skuIndex + 1].x - 3, qtyX: head.at(-2).x, orderX: head.at(-1).x }
      }
      headY = parent.y
    }
    if (!cols) continue
    const anchors = page.filter((item) => item.y > headY + SAME_LINE && Math.abs(item.x - cols.qtyX) <= 8 && NUMBER.test(text(item)))
    const isOrder = (item) => item.y > headY + SAME_LINE && Math.abs(item.x - cols.orderX) <= 8 && /^[0-9A-Z]{8,}$/.test(text(item))
    const pageBands = bands(anchors)
    // เลขคำสั่งซื้อที่อยู่ก่อนแถวแรกของหน้า เป็นของแถวสุดท้ายในหน้าก่อน
    const firstTop = pageBands.length ? pageBands[0].top : Infinity
    const carried = page.filter((item) => isOrder(item) && item.y < firstTop).toSorted((a, b) => a.y - b.y).map(text)
    if (carried.length && rows.length) rows.at(-1).orders.push(...carried)
    for (const band of pageBands) {
      const parts = page.filter((item) => within(item, band) && inColumn(item, cols.skuFrom, cols.skuTo)).toSorted(sortByLine).map(text)
      let orders = page.filter((item) => isOrder(item) && within(item, band)).toSorted((a, b) => a.y - b.y).map(text)
      // แถวย่อย (ตัวเลือกสินค้าอื่นของสินค้าเดียวกัน ไม่มีเลข # ของตัวเอง) ที่ไม่มีเลขคำสั่งซื้อ:
      // Shopee พิมพ์เลขคำสั่งซื้อครั้งเดียวใต้ตัวเลือกแรก เมื่อคำสั่งซื้อเดียวมีหลายตัวเลือก → ใช้เลขคำสั่งซื้อของแถวก่อนหน้า
      const hasIndex = page.some(
        (item) => Math.abs(item.y - band.anchor.y) <= SAME_LINE && Math.abs(item.x - cols.indexX) <= 6 && /^\d+$/.test(text(item)),
      )
      if (orders.length === 0 && !hasIndex && rows.length > 0) orders = [...rows.at(-1).orders]
      rows.push({ sku: cleanSku(parts), quantity: Number(text(band.anchor)), orders })
    }
  }
  return { rows, expectedTotal: null }
}

const PARSERS = { [PLATFORM.SHOPEE]: parseShopee, [PLATFORM.LAZADA]: parseLazada, [PLATFORM.TIKTOK]: parseTiktok }

// คืน { platform, rows: [{ sku, quantity, orders }], warnings: [ข้อความ] } หรือ { platform: null, error }
export function parsePicklist(pages) {
  // ไฟล์ที่ไม่มีข้อความเลย = ไฟล์รูปภาพ (เช่น สั่งพิมพ์ผ่าน "Microsoft Print to PDF" ซึ่งแปลงทั้งหน้าเป็นรูป) อ่านไม่ได้
  if (pages.every((page) => page.length === 0)) {
    return {
      platform: null,
      rows: [],
      warnings: [],
      error: 'ไฟล์นี้เป็นรูปภาพ ไม่มีข้อความให้อ่าน (มักเกิดจากสั่งพิมพ์ผ่าน "Microsoft Print to PDF") กรุณาดาวน์โหลด PDF จากเว็บ seller โดยตรง',
    }
  }
  const platform = detectPlatform(pages)
  if (!platform) return { platform: null, rows: [], warnings: [], error: 'ไม่รู้จักรูปแบบไฟล์ (รองรับ Shopee Picklist / Lazada Checklist / TikTok Picking List)' }
  const { rows, expectedTotal, expectedOrders = null } = PARSERS[platform](pages)
  const warnings = []
  rows.forEach((row, i) => {
    if (!row.sku) warnings.push(`แถวที่ ${i + 1}: อ่านรหัสสินค้าไม่ได้`)
    if (!(row.quantity > 0)) warnings.push(`แถวที่ ${i + 1} (${row.sku || 'ไม่มีรหัส'}): อ่านจำนวนไม่ได้`)
    if (row.orders.length === 0) warnings.push(`แถวที่ ${i + 1} (${row.sku || 'ไม่มีรหัส'}): ไม่พบเลขคำสั่งซื้อ`)
  })
  const total = rows.reduce((sum, row) => sum + (row.quantity || 0), 0)
  if (expectedTotal !== null && expectedTotal !== total) {
    warnings.push(`จำนวนรวมที่อ่านได้ (${total}) ไม่ตรงกับหัวไฟล์ (${expectedTotal}) กรุณาตรวจกับไฟล์`)
  }
  const orderCount = new Set(rows.flatMap((row) => row.orders)).size
  if (expectedOrders !== null && expectedOrders !== orderCount) {
    warnings.push(`จำนวนคำสั่งซื้อที่อ่านได้ (${orderCount}) ไม่ตรงกับหัวไฟล์ (${expectedOrders}) กรุณาตรวจกับไฟล์`)
  }
  if (rows.length === 0) return { platform, rows, warnings, error: 'ไม่พบรายการสินค้าในไฟล์' }
  return { platform, rows: rows.filter((row) => row.sku && row.quantity > 0), warnings, error: null }
}
