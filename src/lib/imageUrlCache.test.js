import { describe, expect, it } from 'vitest'
import { REFRESH_MARGIN_MS, planImageUrls, rememberImageUrls, sameUrls } from './imageUrlCache.js'

const now = 1_000_000

describe('planImageUrls', () => {
  it('ครั้งแรกไม่มีใน cache ขอทั้งหมด (ไม่ซ้ำ)', () => {
    expect(planImageUrls(new Map(), ['a', 'b', 'a'], now)).toEqual({ urls: {}, toSign: ['a', 'b'] })
  })

  it('ใช้ URL เดิมที่ยังไม่ใกล้หมดอายุ ขอใหม่เฉพาะรูปใหม่และที่ใกล้หมดอายุ', () => {
    const cache = new Map([
      ['a', { url: 'ua', expiresAt: now + REFRESH_MARGIN_MS + 1 }],
      ['b', { url: 'ub', expiresAt: now + REFRESH_MARGIN_MS }],
    ])
    expect(planImageUrls(cache, ['a', 'b', 'c'], now)).toEqual({ urls: { a: 'ua' }, toSign: ['b', 'c'] })
  })
})

describe('rememberImageUrls', () => {
  it('เก็บ URL พร้อมเวลาหมดอายุ และลบรูปที่ไม่ใช้แล้ว', () => {
    const cache = new Map([['old', { url: 'x', expiresAt: now }]])
    rememberImageUrls(cache, { a: 'ua' }, ['a'], 3600, now)
    expect([...cache]).toEqual([['a', { url: 'ua', expiresAt: now + 3_600_000 }]])
  })

  it('บันทึกรายการแล้วโหลดสินค้าใหม่ (รูปเหมือนเดิม) ไม่ต้องขอ URL ใหม่', () => {
    const cache = rememberImageUrls(new Map(), { a: 'ua', b: 'ub' }, ['a', 'b'], 3600, now)
    expect(planImageUrls(cache, ['a', 'b'], now + 60_000).toSign).toEqual([])
  })
})

describe('sameUrls', () => {
  it('เทียบเนื้อหา', () => {
    expect(sameUrls({ a: '1' }, { a: '1' })).toBe(true)
    expect(sameUrls({ a: '1' }, { a: '2' })).toBe(false)
    expect(sameUrls({ a: '1' }, { a: '1', b: '2' })).toBe(false)
  })
})
