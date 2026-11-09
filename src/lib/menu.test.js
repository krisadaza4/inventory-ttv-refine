import { describe, expect, it } from 'vitest'
import { PAGE, getMenu, getPageInfo } from './menu.js'
import { ROLE } from './roles.js'

const pagesOf = (menu) => menu.flatMap((group) => group.items.map((item) => item.page))

describe('getMenu', () => {
  it('admin เห็นทุกหน้า แบ่ง 2 กลุ่ม', () => {
    const menu = getMenu(ROLE.ADMIN)
    expect(menu.map((group) => group.label)).toEqual(['งานประจำวัน', 'ผู้ดูแล'])
    expect(pagesOf(menu)).toEqual([PAGE.PRODUCTS, PAGE.MOVE, PAGE.HISTORY, PAGE.SALES, PAGE.MANAGE])
  })

  it('Store/QC เห็นทุกหน้าเหมือน admin', () => {
    expect(pagesOf(getMenu(ROLE.STORE_QC))).toEqual(pagesOf(getMenu(ROLE.ADMIN)))
  })

  it('Manager / Marketing ดูอย่างเดียว ไม่เห็นหน้ารับเข้า/เบิกออกและจัดการสินค้า', () => {
    for (const role of [ROLE.MANAGER, ROLE.MARKETING]) {
      const menu = getMenu(role)
      expect(menu.map((group) => group.label)).toEqual(['งานประจำวัน'])
      expect(pagesOf(menu)).toEqual([PAGE.PRODUCTS, PAGE.HISTORY, PAGE.SALES])
    }
  })

  it('staff ไม่เห็นกลุ่มผู้ดูแล', () => {
    const menu = getMenu(ROLE.STAFF)
    expect(menu.map((group) => group.label)).toEqual(['งานประจำวัน'])
    expect(pagesOf(menu)).toEqual([PAGE.PRODUCTS, PAGE.MOVE, PAGE.HISTORY, PAGE.SALES])
  })

  it('บทบาทไม่รู้จัก ดูอย่างเดียว ไม่เห็นหน้าบันทึกและหน้าจัดการ', () => {
    expect(pagesOf(getMenu('owner'))).toEqual([PAGE.PRODUCTS, PAGE.HISTORY, PAGE.SALES])
  })
})

describe('getPageInfo', () => {
  it('คืนชื่อหน้าและกลุ่มสำหรับ breadcrumb', () => {
    expect(getPageInfo(PAGE.MANAGE)).toMatchObject({ label: 'จัดการสินค้า', group: 'ผู้ดูแล' })
    expect(getPageInfo(PAGE.PRODUCTS)).toMatchObject({ label: 'สินค้าคงคลัง', group: 'งานประจำวัน' })
  })
})
