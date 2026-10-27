import { describe, expect, it } from 'vitest'
import changelogText from '../../CHANGELOG.md?raw'
import packageJson from '../../package.json'
import {
  CHANGELOG_SEEN_KEY,
  compareVersions,
  isNewRelease,
  parseChangelog,
  readSeenVersion,
  saveSeenVersion,
  shouldShowChangelog,
} from './changelog.js'

const sample = `# Changelog

ข้อความอธิบาย

## อัพเดทถัดไป

<!-- ตัวอย่าง
- ไม่ควรนับ
-->
- **สำรองข้อมูลอัตโนมัติ**
- หน้า \`ลืมรหัสผ่าน\`

## v1.2.0 — 2026-10-05

- ข้อ ก
- ข้อ ข

## ย้ายมาระบบใหม่ — 2026-10-08

- ย้ายแล้ว

## v1.0.0 — 2026-09-29

- แรก
`

const memoryStorage = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), removeItem: (k) => delete data[k], data }
}

describe('parseChangelog', () => {
  it('แยกรายการอัพเดทถัดไป ตัด markdown และไม่นับในคอมเมนต์', () => {
    expect(parseChangelog(sample).roadmap).toEqual(['สำรองข้อมูลอัตโนมัติ', 'หน้า ลืมรหัสผ่าน'])
  })

  it('แยกแต่ละหัวข้อเป็นเวอร์ชัน พร้อมเลขเวอร์ชันและวันที่', () => {
    expect(parseChangelog(sample).releases).toEqual([
      { title: 'v1.2.0 — 2026-10-05', version: '1.2.0', date: '2026-10-05', items: ['ข้อ ก', 'ข้อ ข'] },
      { title: 'ย้ายมาระบบใหม่ — 2026-10-08', version: null, date: '2026-10-08', items: ['ย้ายแล้ว'] },
      { title: 'v1.0.0 — 2026-09-29', version: '1.0.0', date: '2026-09-29', items: ['แรก'] },
    ])
  })

  it('ไฟล์ว่าง', () => {
    expect(parseChangelog('')).toEqual({ roadmap: [], releases: [] })
  })

  it('CHANGELOG.md จริงมีหัวข้อของเวอร์ชันใน package.json อยู่บนสุด', () => {
    const { releases } = parseChangelog(changelogText)
    expect(releases[0].version).toBe(packageJson.version)
    expect(releases[0].items.length).toBeGreaterThan(0)
  })
})

describe('compareVersions', () => {
  it('เทียบทีละหลัก ไม่ใช่ตัวอักษร', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0)
    expect(compareVersions('1.0.0', null)).toBeGreaterThan(0)
  })
})

describe('shouldShowChangelog', () => {
  it('เพิ่งเข้าสู่ระบบ ไม่เคยติ๊กไม่แสดง หรือติ๊กไว้ที่เวอร์ชันเก่า ให้เปิด', () => {
    expect(shouldShowChangelog(null, '1.9.0', true)).toBe(true)
    expect(shouldShowChangelog('1.8.0', '1.9.0', true)).toBe(true)
  })

  it('ติ๊กไม่แสดงอีกไว้ที่เวอร์ชันนี้ ไม่เปิด', () => {
    expect(shouldShowChangelog('1.9.0', '1.9.0', true)).toBe(false)
  })

  it('เปิดหน้าเว็บโดยยังเข้าสู่ระบบค้างอยู่ (ไม่ได้เพิ่งเข้าสู่ระบบ) ไม่เปิด', () => {
    expect(shouldShowChangelog(null, '1.9.0', false)).toBe(false)
  })
})

describe('isNewRelease', () => {
  const r = (version) => ({ version })
  it('ใหม่กว่าที่เคยเห็น ติดป้ายใหม่', () => {
    expect(isNewRelease(r('1.9.0'), '1.7.0', '1.9.0')).toBe(true)
    expect(isNewRelease(r('1.8.0'), '1.7.0', '1.9.0')).toBe(true)
    expect(isNewRelease(r('1.7.0'), '1.7.0', '1.9.0')).toBe(false)
  })

  it('ไม่เคยเห็นเลย ติดป้ายเฉพาะเวอร์ชันปัจจุบัน', () => {
    expect(isNewRelease(r('1.9.0'), null, '1.9.0')).toBe(true)
    expect(isNewRelease(r('1.8.0'), null, '1.9.0')).toBe(false)
  })

  it('หัวข้อที่ไม่ใช่เวอร์ชัน และเวอร์ชันที่ยังไม่ออก ไม่ติดป้าย', () => {
    expect(isNewRelease(r(null), '1.0.0', '1.9.0')).toBe(false)
    expect(isNewRelease(r('2.0.0'), '1.0.0', '1.9.0')).toBe(false)
  })
})

describe('readSeenVersion / saveSeenVersion', () => {
  it('จำเวอร์ชันที่ติ๊กไม่แสดงอีก และเอาติ๊กออกได้', () => {
    const storage = memoryStorage()
    saveSeenVersion('1.9.0', storage)
    expect(storage.data[CHANGELOG_SEEN_KEY]).toBe('1.9.0')
    expect(readSeenVersion(storage)).toBe('1.9.0')
    saveSeenVersion(null, storage)
    expect(readSeenVersion(storage)).toBeNull()
  })

  it('ไม่มี/ค่าแปลก/เบราว์เซอร์ไม่ให้ใช้ storage คืน null ไม่พัง', () => {
    expect(readSeenVersion(memoryStorage())).toBeNull()
    expect(readSeenVersion(memoryStorage({ [CHANGELOG_SEEN_KEY]: 'x' }))).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readSeenVersion(broken)).toBeNull()
    expect(() => saveSeenVersion('1.9.0', broken)).not.toThrow()
  })
})
