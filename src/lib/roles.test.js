import { describe, expect, it } from 'vitest'
import { ROLE, canAdjust, canManageProducts } from './roles.js'

describe('ROLE', () => {
  it('ตรงกับค่าใน profiles.role', () => {
    expect(ROLE).toEqual({ ADMIN: 'admin', STAFF: 'staff' })
  })
})

describe('canManageProducts', () => {
  it('admin จัดการสินค้าได้', () => {
    expect(canManageProducts(ROLE.ADMIN)).toBe(true)
  })

  it('staff จัดการสินค้าไม่ได้', () => {
    expect(canManageProducts(ROLE.STAFF)).toBe(false)
  })

  it('ไม่มีบทบาท (ไม่มี profile) ไม่ได้', () => {
    expect(canManageProducts(undefined)).toBe(false)
    expect(canManageProducts(null)).toBe(false)
    expect(canManageProducts('')).toBe(false)
  })

  it('ค่าไม่รู้จักหรือตัวพิมพ์ไม่ตรง ไม่ได้', () => {
    expect(canManageProducts('Admin')).toBe(false)
    expect(canManageProducts('owner')).toBe(false)
  })
})

describe('canAdjust', () => {
  it('admin ปรับยอดได้', () => {
    expect(canAdjust(ROLE.ADMIN)).toBe(true)
  })

  it('staff ปรับยอดไม่ได้', () => {
    expect(canAdjust(ROLE.STAFF)).toBe(false)
  })

  it('ไม่มีบทบาท ไม่ได้', () => {
    expect(canAdjust(undefined)).toBe(false)
  })
})
