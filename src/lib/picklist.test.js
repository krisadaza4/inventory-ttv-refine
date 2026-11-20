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

  it('เลขคำสั่งซื้อที่ล้นไปหน้าถัดไป ต่อท้ายแถวสุดท้ายของหน้าก่อน', () => {
    // ย้ายเลขคำสั่งซื้อใบที่ 2 ของ FM-667E ไปไว้ต้นหน้า 3 ใหม่ (ก่อนแถวแรก)
    const page2 = shopee[1].filter((item) => item.y < 140)
    const page3 = [...shopee[1].filter((item) => item.y < 20), ...shopee[1].filter((item) => item.y >= 140)]
    const { rows } = parsePicklist([shopee[0], page2, page3])
    expect(rows.find((r) => r.sku === 'FM-667E').orders).toEqual(['261119N2FKY4N9', '261119N4HAU433', '261119NMKQ8D1D'])
  })
})
