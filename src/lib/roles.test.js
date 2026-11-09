import { describe, expect, it } from 'vitest'
import { ROLE, ROLE_LABEL, canAdjust, canManageProducts, canRecordMovements, canWriteOff } from './roles.js'

const ALL_ROLES = Object.values(ROLE)

describe('ROLE', () => {
  it('ตรงกับค่าใน profiles.role', () => {
    expect(ROLE).toEqual({
      ADMIN: 'admin',
      STORE_QC: 'store_qc',
      STAFF: 'staff',
      MANAGER: 'manager',
      MARKETING: 'marketing',
    })
  })

  it('ทุกบทบาทมีชื่อแสดง', () => {
    for (const role of ALL_ROLES) expect(ROLE_LABEL[role]).toBeTruthy()
    expect(ROLE_LABEL[ROLE.STORE_QC]).toBe('Store/QC')
  })
})

describe('สิทธิ์เต็ม (จัดการสินค้า ปรับยอด ตัดจำหน่าย)', () => {
  for (const [name, can] of [
    ['canManageProducts', canManageProducts],
    ['canAdjust', canAdjust],
    ['canWriteOff', canWriteOff],
  ]) {
    it(`${name}: admin และ Store/QC ได้ ที่เหลือไม่ได้`, () => {
      expect(can(ROLE.ADMIN)).toBe(true)
      expect(can(ROLE.STORE_QC)).toBe(true)
      expect(can(ROLE.STAFF)).toBe(false)
      expect(can(ROLE.MANAGER)).toBe(false)
      expect(can(ROLE.MARKETING)).toBe(false)
    })

    it(`${name}: ไม่มีบทบาท ค่าไม่รู้จัก หรือตัวพิมพ์ไม่ตรง ไม่ได้`, () => {
      for (const value of [undefined, null, '', 'Admin', 'owner', 'STORE_QC']) expect(can(value)).toBe(false)
    })
  }
})

describe('canRecordMovements', () => {
  it('admin, Store/QC, staff บันทึกได้', () => {
    expect(canRecordMovements(ROLE.ADMIN)).toBe(true)
    expect(canRecordMovements(ROLE.STORE_QC)).toBe(true)
    expect(canRecordMovements(ROLE.STAFF)).toBe(true)
  })

  it('Manager, Marketing, ไม่มีบทบาท, ค่าไม่รู้จัก ดูอย่างเดียว', () => {
    for (const value of [ROLE.MANAGER, ROLE.MARKETING, undefined, null, '', 'owner']) {
      expect(canRecordMovements(value)).toBe(false)
    }
  })
})
