import { describe, expect, it } from 'vitest'
import { matchPreset, normalizeRange, presetRange, rangeFileSuffix } from './dateRange.js'

describe('presetRange', () => {
  it('วันนี้', () => {
    expect(presetRange('today', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-05' })
  })

  it('เดือนนี้ ถึงวันสุดท้ายของเดือน', () => {
    expect(presetRange('month', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(presetRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('เดือนที่แล้ว ข้ามปีได้', () => {
    expect(presetRange('last-month', '2026-11-05')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('last-month', '2027-01-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('ปีนี้', () => {
    expect(presetRange('year', '2026-11-05')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
})

describe('matchPreset', () => {
  it('ตรงปุ่มลัด', () => {
    expect(matchPreset({ from: '2026-11-01', to: '2026-11-30' }, '2026-11-05')).toBe('month')
  })

  it('ไม่ตรง หรือไม่กรอง = null', () => {
    expect(matchPreset({ from: '2026-11-02', to: '2026-11-30' }, '2026-11-05')).toBeNull()
    expect(matchPreset({ from: '', to: '' }, '2026-11-05')).toBeNull()
  })
})

describe('normalizeRange', () => {
  it('สลับเมื่อกรอกกลับด้าน', () => {
    expect(normalizeRange({ from: '2026-11-30', to: '2026-11-01' })).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })

  it('ด้านเดียวไม่แตะ', () => {
    expect(normalizeRange({ from: '2026-11-30', to: '' })).toEqual({ from: '2026-11-30', to: '' })
  })
})

describe('rangeFileSuffix', () => {
  it('รูปแบบต่าง ๆ', () => {
    expect(rangeFileSuffix({ from: '', to: '' })).toBe('')
    expect(rangeFileSuffix({ from: '2026-11-05', to: '2026-11-05' })).toBe('_2026-11-05')
    expect(rangeFileSuffix({ from: '2026-11-01', to: '2026-11-30' })).toBe('_2026-11-01_2026-11-30')
    expect(rangeFileSuffix({ from: '2026-11-01', to: '' })).toBe('_from-2026-11-01')
    expect(rangeFileSuffix({ from: '', to: '2026-11-30' })).toBe('_to-2026-11-30')
  })
})
