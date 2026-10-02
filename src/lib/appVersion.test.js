import { describe, expect, it } from 'vitest'
import { VERSION_URL, fetchLatestVersion, isNewVersion } from './appVersion.js'

const respond = (body, ok = true) => async () => ({ ok, json: async () => body })

describe('fetchLatestVersion', () => {
  it('ขอ version.json แบบไม่ใช้ cache แล้วคืนรหัสเวอร์ชัน', async () => {
    const calls = []
    const fetchFn = async (...args) => {
      calls.push(args)
      return { ok: true, json: async () => ({ version: 'abc1234' }) }
    }
    expect(await fetchLatestVersion(fetchFn)).toBe('abc1234')
    expect(calls).toEqual([[VERSION_URL, { cache: 'no-store' }]])
  })

  it('เซิร์ฟเวอร์ตอบผิดพลาด รูปแบบผิด หรือออฟไลน์ คืน null', async () => {
    expect(await fetchLatestVersion(respond({ version: 'x' }, false))).toBeNull()
    expect(await fetchLatestVersion(respond({}))).toBeNull()
    expect(
      await fetchLatestVersion(async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).toBeNull()
  })
})

describe('isNewVersion', () => {
  it('ต่างกัน = มีเวอร์ชันใหม่', () => {
    expect(isNewVersion('a1', 'b2')).toBe(true)
  })

  it('ตรงกัน หรืออ่านไม่ได้ = ไม่แจ้ง', () => {
    expect(isNewVersion('a1', 'a1')).toBe(false)
    expect(isNewVersion('a1', null)).toBe(false)
    expect(isNewVersion('', 'b2')).toBe(false)
  })
})
