import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, backupReminder, daysSince, readLastBackup, saveLastBackup } from './backupReminder.js'

const memoryStorage = () => {
  const data = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) }
}
const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('readLastBackup / saveLastBackup', () => {
  it('บันทึกแล้วอ่านคืนได้', () => {
    const storage = memoryStorage()
    saveLastBackup('2026-10-02', storage)
    expect(readLastBackup(storage)).toBe('2026-10-02')
  })

  it('ไม่มีค่า ค่าผิดรูปแบบ หรืออ่านไม่ได้ คืน null และไม่ล้ม', () => {
    expect(readLastBackup(memoryStorage())).toBeNull()
    const storage = memoryStorage()
    storage.setItem(BACKUP_KEY, 'เมื่อวาน')
    expect(readLastBackup(storage)).toBeNull()
    expect(readLastBackup(brokenStorage)).toBeNull()
    expect(() => saveLastBackup('2026-10-02', brokenStorage)).not.toThrow()
  })
})

describe('daysSince', () => {
  it('นับวันข้ามเดือน', () => {
    expect(daysSince('2026-09-25', '2026-10-02')).toBe(7)
    expect(daysSince('2026-10-02', '2026-10-02')).toBe(0)
    expect(daysSince(null, '2026-10-02')).toBeNull()
  })
})

describe('backupReminder', () => {
  it('ยังไม่เคยสำรอง เตือน', () => {
    expect(backupReminder(null, '2026-10-02')).toMatch('ยังไม่เคยสำรอง')
  })

  it('ไม่ถึง 7 วัน ไม่เตือน, 7 วันขึ้นไป เตือนพร้อมจำนวนวัน', () => {
    expect(backupReminder('2026-09-26', '2026-10-02')).toBeNull()
    expect(backupReminder('2026-09-25', '2026-10-02')).toMatch('7 วันที่แล้ว')
  })
})
