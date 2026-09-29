import { describe, expect, it } from 'vitest'
import { PAGE, getMenu, getPageInfo } from './menu.js'
import { ROLE } from './roles.js'

const pagesOf = (menu) => menu.flatMap((group) => group.items.map((item) => item.page))

describe('getMenu', () => {
  it('admin เห็นทุกหน้า แบ่ง 2 กลุ่ม', () => {
    const menu = getMenu(ROLE.ADMIN)
    expect(menu.map((group) => group.label)).toEqual(['งานประจำวัน', 'ผู้ดูแล'])
    expect(pagesOf(menu)).toEqual([PAGE.PRODUCTS, PAGE.MOVE, PAGE.HISTORY, PAGE.MANAGE])
  })

  it('staff ไม่เห็นกลุ่มผู้ดูแล', () => {
    const menu = getMenu(ROLE.STAFF)
    expect(menu.map((group) => group.label)).toEqual(['งานประจำวัน'])
    expect(pagesOf(menu)).toEqual([PAGE.PRODUCTS, PAGE.MOVE, PAGE.HISTORY])
  })

  it('บทบาทไม่รู้จัก เห็นเหมือน staff', () => {
    expect(pagesOf(getMenu('owner'))).not.toContain(PAGE.MANAGE)
  })
})

describe('getPageInfo', () => {
  it('คืนชื่อหน้าและกลุ่มสำหรับ breadcrumb', () => {
    expect(getPageInfo(PAGE.MANAGE)).toMatchObject({ label: 'จัดการสินค้า', group: 'ผู้ดูแล' })
    expect(getPageInfo(PAGE.PRODUCTS)).toMatchObject({ label: 'สินค้าคงคลัง', group: 'งานประจำวัน' })
  })
})
