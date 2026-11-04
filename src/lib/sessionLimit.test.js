import { describe, expect, it } from 'vitest'
import { SESSION_MAX_MS, msUntilRelogin, reloginTimeout } from './sessionLimit.js'

const HOUR = 60 * 60 * 1000
const signedIn = '2026-11-04T01:00:00Z'
const at = (hours) => Date.parse(signedIn) + hours * HOUR

describe('msUntilRelogin', () => {
  it('อายุ 12 ชั่วโมงนับจากเข้าสู่ระบบ', () => {
    expect(SESSION_MAX_MS).toBe(12 * HOUR)
    expect(msUntilRelogin(signedIn, at(0))).toBe(12 * HOUR)
    expect(msUntilRelogin(signedIn, at(11.5))).toBe(0.5 * HOUR)
  })

  it('ครบหรือเกิน 12 ชั่วโมง เหลือ ≤ 0', () => {
    expect(msUntilRelogin(signedIn, at(12))).toBe(0)
    expect(msUntilRelogin(signedIn, at(30))).toBeLessThan(0)
  })

  it('ไม่มีเวลาเข้าสู่ระบบ หรืออ่านไม่ได้ ไม่บังคับ (null)', () => {
    expect(msUntilRelogin(null, at(0))).toBeNull()
    expect(msUntilRelogin('x', at(0))).toBeNull()
  })
})

describe('reloginTimeout', () => {
  it('ไม่ติดลบ และไม่เกินที่ setTimeout รับได้', () => {
    expect(reloginTimeout(-5)).toBe(0)
    expect(reloginTimeout(HOUR)).toBe(HOUR)
    expect(reloginTimeout(40 * 24 * HOUR)).toBe(2 ** 31 - 1)
  })
})
