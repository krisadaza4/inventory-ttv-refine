import { describe, expect, it } from 'vitest'
import lazada from './__fixtures__/picklist-lazada.json'
import shopee from './__fixtures__/picklist-shopee.json'
import tiktok from './__fixtures__/picklist-tiktok.json'
import { PLATFORM, detectPlatform, parsePicklist } from './picklist.js'

// fixtures = ข้อความจาก PDF จริงของวันที่ 19 พ.ย. 2569 (daily-withdraw) อ่านด้วย pdfjs แบบเดียวกับในแอป

describe('detectPlatform', () => {
  it('รู้จักทั้ง 3 เจ้า', () => {
    expect(detectPlatform(shopee)).toBe(PLATFORM.SHOPEE)
    expect(detectPlatform(lazada)).toBe(PLATFORM.LAZADA)
    expect(detectPlatform(tiktok)).toBe(PLATFORM.TIKTOK)
  })

  it('ไฟล์รูปภาพ (ไม่มีข้อความ) แจ้งให้ดาวน์โหลด PDF จากเว็บ seller', () => {
    const result = parsePicklist([[]])
    expect(result.platform).toBeNull()
    expect(result.error).toContain('ไฟล์นี้เป็นรูปภาพ')
  })

  it('ไฟล์อื่นคืน null และ parsePicklist แจ้งว่าไม่รู้จัก', () => {
    const pages = [[{ s: 'ใบเสร็จ', x: 10, y: 10, w: 20 }]]
    expect(detectPlatform(pages)).toBeNull()
    expect(parsePicklist(pages).error).toContain('ไม่รู้จักรูปแบบไฟล์')
  })
})

describe('Lazada', () => {
  it('SKU ที่ถูกตัดเป็น 2 บรรทัดต่อกันได้ และจำนวน/เลขคำสั่งซื้อตรง', () => {
    const { rows, warnings, error } = parsePicklist(lazada)
    expect(error).toBeNull()
    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { sku: 'KB8A-VAB', quantity: 1, orders: ['1137871154030387'] },
      { sku: 'ZL-71', quantity: 1, orders: ['1127867647308178'] },
      { sku: 'RP-25', quantity: 2, orders: ['1129525838172376'] },
    ])
  })
})

describe('TikTok', () => {
  it('ใช้ Seller SKU ยอดรวมตรงกับ Item quantity ในหัวไฟล์', () => {
    const { rows, warnings } = parsePicklist(tiktok)
    expect(warnings).toEqual([])
    expect(rows).toEqual([
      { sku: 'FM-667E', quantity: 1, orders: ['587257640383972694'] },
      { sku: 'AP-910', quantity: 1, orders: ['587250708509853107'] },
      { sku: 'GL-702BI', quantity: 1, orders: ['587253819565180145'] },
    ])
  })

  it('ยอดรวมไม่ตรงหัวไฟล์ เตือน', () => {
    const changed = tiktok.map((page) => page.map((item) => (item.s === 'Item quantity: 3' ? { ...item, s: 'Item quantity: 5' } : item)))
    expect(parsePicklist(changed).warnings.join(' ')).toContain('ไม่ตรงกับหัวไฟล์')
  })
})

describe('Shopee', () => {
  it('หนึ่งแถวต่อ SKU รวมเลขคำสั่งซื้อทุกใบใต้แถว และต่อข้ามหน้า', () => {
    const { rows, warnings } = parsePicklist(shopee)
    expect(warnings).toEqual([])
    expect(rows.map((r) => [r.sku, r.quantity, r.orders.length])).toEqual([
      ['RP-25G', 4, 4],
      ['KB5A02-VAB', 1, 1],
      ['KB5A02-VAB-P1', 1, 1],
      ['GL-101I', 7, 3],
      ['GL-506I', 1, 1],
      ['GL-101R', 2, 1],
      ['WX-106S', 1, 1],
      ['AP-005', 1, 1],
      ['FM-616E', 1, 1],
      ['FM-667', 1, 1],
      ['FM-667E', 3, 3],
      ['AP002-B', 1, 1],
    ])
    expect(rows[0].orders).toEqual(['261118M2YQMD96', '261118M34M39TC', '261118MAJN15R1', '261118MBBGCRSC'])
    expect(rows.at(-2).orders).toEqual(['261119N2FKY4N9', '261119N4HAU433', '261119NMKQ8D1D'])
  })

  it('คำสั่งซื้อเดียวมีหลายตัวเลือก: แถวย่อยที่ไม่มีเลขคำสั่งซื้อ ใช้เลขของแถวก่อนหน้า (ไฟล์จริง 25 พ.ย.)', () => {
    const head = shopee[0].filter((item) => item.y < 90)
    const at = (s, x, y) => ({ s, x, y, w: 10 })
    const page = [
      ...head,
      at('1', 14.9, 103.3), at('GC301', 32.1, 103.3), at('GC-301BN1', 248.4, 103.3), at('GC301BN1', 331.5, 103.3),
      at('1', 414.6, 103.3), at('2611258EP6F2RU', 472.2, 103.3), at('package 1', 472.2, 121.3),
      // แถวย่อย: ไม่มีเลข # และไม่มีเลขคำสั่งซื้อ
      at('GC-301BK2', 248.4, 163.2), at('GC301BK2', 331.5, 163.2), at('1', 414.6, 163.2),
      // สินค้าถัดไป มีเลข # ของตัวเอง แต่ไม่มีเลขคำสั่งซื้อ → ยังเตือน
      at('2', 14.9, 220), at('AP-005', 248.4, 220), at('AP-005', 331.5, 220), at('1', 414.6, 220),
    ]
    const { rows, warnings } = parsePicklist([page])
    expect(rows.map((r) => [r.sku, r.orders])).toEqual([
      ['GC-301BN1', ['2611258EP6F2RU']],
      ['GC-301BK2', ['2611258EP6F2RU']],
      ['AP-005', []],
    ])
    expect(warnings).toEqual(['แถวที่ 3 (AP-005): ไม่พบเลขคำสั่งซื้อ'])
  })

  it('เลขคำสั่งซื้อที่ล้นไปหน้าถัดไป ต่อท้ายแถวสุดท้ายของหน้าก่อน', () => {
    // ย้ายเลขคำสั่งซื้อใบที่ 2 ของ FM-667E ไปไว้ต้นหน้า 3 ใหม่ (ก่อนแถวแรก)
    const page2 = shopee[1].filter((item) => item.y < 140)
    const page3 = [...shopee[1].filter((item) => item.y < 20), ...shopee[1].filter((item) => item.y >= 140)]
    const { rows } = parsePicklist([shopee[0], page2, page3])
    expect(rows.find((r) => r.sku === 'FM-667E').orders).toEqual(['261119N2FKY4N9', '261119N4HAU433', '261119NMKQ8D1D'])
  })
})
