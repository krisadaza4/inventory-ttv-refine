import { describe, expect, it } from 'vitest'
import {
  ACTIVE_VIEW,
  ACTIVE_VIEW_KEY,
  countByActive,
  filterByActive,
  readActiveView,
  saveActiveView,
} from './activeView.js'

const products = [
  { id: 'a', active: true },
  { id: 'b', active: false },
  { id: 'c', active: true },
]

const memoryStorage = (initial = {}) => {
  const data = { ...initial }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), data }
}
const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('filterByActive', () => {
  it('แท็บใช้งาน เฉพาะที่ใช้งาน', () => {
    expect(filterByActive(products, ACTIVE_VIEW.ACTIVE).map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('แท็บปิดใช้งาน เฉพาะที่ปิดใช้งาน', () => {
    expect(filterByActive(products, ACTIVE_VIEW.INACTIVE).map((p) => p.id)).toEqual(['b'])
  })

  it('แท็บทั้งหมด คืนทุกรายการ', () => {
    expect(filterByActive(products, ACTIVE_VIEW.ALL)).toBe(products)
  })
})

describe('countByActive', () => {
  it('นับแต่ละแท็บ', () => {
    expect(countByActive(products)).toEqual({ active: 2, inactive: 1, all: 3 })
  })

  it('ไม่มีสินค้า', () => {
    expect(countByActive([])).toEqual({ active: 0, inactive: 0, all: 0 })
  })
})

describe('readActiveView / saveActiveView', () => {
  it('ไม่เคยบันทึก ใช้แท็บใช้งาน', () => {
    expect(readActiveView(memoryStorage())).toBe(ACTIVE_VIEW.ACTIVE)
  })

  it('จำแท็บที่บันทึกไว้', () => {
    const storage = memoryStorage()
    saveActiveView(ACTIVE_VIEW.INACTIVE, storage)
    expect(storage.data[ACTIVE_VIEW_KEY]).toBe('inactive')
    expect(readActiveView(storage)).toBe(ACTIVE_VIEW.INACTIVE)
  })

  it('ค่าแปลกในเบราว์เซอร์ ใช้แท็บใช้งาน', () => {
    expect(readActiveView(memoryStorage({ [ACTIVE_VIEW_KEY]: 'x' }))).toBe(ACTIVE_VIEW.ACTIVE)
  })

  it('เบราว์เซอร์ไม่ให้ใช้ storage ไม่พัง', () => {
    expect(readActiveView(brokenStorage)).toBe(ACTIVE_VIEW.ACTIVE)
    expect(() => saveActiveView(ACTIVE_VIEW.ALL, brokenStorage)).not.toThrow()
  })
})
