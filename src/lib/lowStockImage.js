import { formatQuantity } from './numberFormat.js'

// วาดสรุปสินค้าใกล้หมดเป็นรูป PNG ด้วย canvas (คมเท่ากันทุกเครื่อง ได้ครบทุกการ์ดแม้รายการยาวเกินจอ)
// ใช้พื้นขาวเสมอ (ไม่ตามโหมดมืด) ส่งต่อใน LINE แล้วอ่านง่าย
const FONT = "'IBM Plex Sans Thai', 'Segoe UI', 'Noto Sans Thai', sans-serif"
const COLORS = {
  bg: '#f4f7f5',
  card: '#ffffff',
  border: '#e3e9e5',
  text: '#111827',
  muted: '#6b7280',
  primary: '#047857',
  low: '#b54708',
  lowBg: '#fffaeb',
  lowBorder: '#fec84b',
  out: '#b42318',
  outBg: '#fef3f2',
  outBorder: '#fda29b',
}

const COLS = 4
const CARD_W = 270
const CARD_H = 262
const GAP = 16
const PAD = 28
const HEAD_H = 96
const FOOT_H = 36
const IMG = 150

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ตัดข้อความให้พอดีความกว้าง ไม่เกิน maxLines บรรทัด (ภาษาไทยไม่มีเว้นวรรค ตัดทีละตัวอักษร)
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = []
  let line = ''
  for (const ch of String(text)) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line)
      line = ch
      if (lines.length === maxLines) break
    } else {
      line += ch
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  const used = lines.join('').length
  if (used < String(text).length && lines.length) {
    let last = lines.at(-1)
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

async function loadImage(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

// items = จาก selectLowStock imageUrls = { imagePath: signed url } meta = { title, subtitle }
// คืน Blob (image/png)
export async function renderLowStockImage(items, imageUrls, meta) {
  try {
    await Promise.all([document.fonts.load(`600 16px ${FONT}`), document.fonts.load(`700 22px ${FONT}`)])
  } catch {
    // ใช้ฟอนต์สำรองของเครื่อง
  }
  const images = await Promise.all(items.map((p) => loadImage(imageUrls[p.imagePath])))

  const rows = Math.max(1, Math.ceil(items.length / COLS))
  const width = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP
  const height = PAD + HEAD_H + rows * CARD_H + (rows - 1) * GAP + FOOT_H + PAD
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)

  // หัวรูป
  ctx.fillStyle = COLORS.low
  ctx.font = `700 26px ${FONT}`
  ctx.fillText('⚠', PAD, PAD + 30)
  ctx.fillStyle = COLORS.text
  ctx.fillText(meta.title, PAD + 36, PAD + 30)
  ctx.fillStyle = COLORS.muted
  ctx.font = `500 15px ${FONT}`
  ctx.fillText(meta.subtitle, PAD, PAD + 60)

  items.forEach((p, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = PAD + col * (CARD_W + GAP)
    const y = PAD + HEAD_H + row * (CARD_H + GAP)
    const out = p.status === 'out'
    const tone = out ? COLORS.out : COLORS.low

    roundRect(ctx, x, y, CARD_W, CARD_H, 14)
    ctx.fillStyle = out ? COLORS.outBg : COLORS.lowBg
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = out ? COLORS.outBorder : COLORS.lowBorder
    ctx.stroke()

    // รูปสินค้า
    const ix = x + (CARD_W - IMG) / 2
    const iy = y + 16
    roundRect(ctx, ix, iy, IMG, IMG, 10)
    ctx.fillStyle = COLORS.card
    ctx.fill()
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.stroke()
    const img = images[i]
    if (img) {
      const k = Math.min((IMG - 12) / img.width, (IMG - 12) / img.height)
      const w = img.width * k
      const h = img.height * k
      ctx.drawImage(img, ix + (IMG - w) / 2, iy + (IMG - h) / 2, w, h)
    } else {
      ctx.fillStyle = COLORS.muted
      ctx.font = `500 13px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('ไม่มีรูป', ix + IMG / 2, iy + IMG / 2 + 4)
      ctx.textAlign = 'left'
    }

    // รหัส + ชื่อ
    ctx.textAlign = 'center'
    const cx = x + CARD_W / 2
    let ty = iy + IMG + 26
    ctx.fillStyle = COLORS.text
    ctx.font = `700 18px ${FONT}`
    ctx.fillText(wrapText(ctx, p.sku, CARD_W - 24, 1)[0] ?? '', cx, ty)
    if (p.name && p.name !== p.sku) {
      ctx.fillStyle = COLORS.muted
      ctx.font = `500 12px ${FONT}`
      ty += 17
      ctx.fillText(wrapText(ctx, p.name, CARD_W - 24, 1)[0] ?? '', cx, ty)
    }

    // ป้ายคงเหลือ
    const label = out ? 'หมด' : `คงเหลือ ${formatQuantity(p.onHand)} ${p.unit ?? ''}`.trim()
    ctx.font = `700 15px ${FONT}`
    const bw = ctx.measureText(label).width + 28
    const by = y + CARD_H - 46
    roundRect(ctx, cx - bw / 2, by, bw, 30, 15)
    ctx.fillStyle = tone
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, cx, by + 20)

    ctx.textAlign = 'left'
  })

  ctx.fillStyle = COLORS.muted
  ctx.font = `500 12px ${FONT}`
  ctx.fillText('Inventory TTV · ใกล้หมด = คงเหลือไม่เกินจุดสั่งซื้อ', PAD, height - PAD + 4)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png')
  })
}
