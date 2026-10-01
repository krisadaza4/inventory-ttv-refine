import { describe, expect, it } from 'vitest'
import { IMAGE_ERROR, MAX_IMAGE_SIDE, checkImageFile, imagePathFor, scaledSize } from './productImages.js'

describe('scaledSize', () => {
  it('รูปใหญ่ย่อให้ด้านยาวเท่า MAX_IMAGE_SIDE คงสัดส่วน', () => {
    expect(MAX_IMAGE_SIDE).toBe(800)
    expect(scaledSize(4000, 3000)).toEqual({ width: 800, height: 600 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 600, height: 800 })
  })

  it('รูปเล็กกว่าไม่ขยาย', () => {
    expect(scaledSize(640, 480)).toEqual({ width: 640, height: 480 })
  })

  it('ปัดเป็นจำนวนเต็ม อย่างน้อย 1px', () => {
    expect(scaledSize(1000, 333)).toEqual({ width: 800, height: 266 })
    expect(scaledSize(10000, 1)).toEqual({ width: 800, height: 1 })
  })
})

describe('checkImageFile', () => {
  it('รับไฟล์รูปทั่วไป', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 5_000_000 })).toBeNull()
    expect(checkImageFile({ type: 'image/png', size: 100 })).toBeNull()
    expect(checkImageFile({ type: 'image/heic', size: 100 })).toBeNull()
  })

  it('ไม่ใช่รูป', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 100 })).toBe(IMAGE_ERROR.NOT_IMAGE)
    expect(checkImageFile({ type: '', size: 100 })).toBe(IMAGE_ERROR.NOT_IMAGE)
  })

  it('ไฟล์ใหญ่เกิน 20MB (ก่อนย่อ)', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 25_000_000 })).toBe(IMAGE_ERROR.TOO_LARGE)
  })

  it('ไม่มีไฟล์', () => {
    expect(checkImageFile(null)).toBe(IMAGE_ERROR.NOT_IMAGE)
  })
})

describe('imagePathFor', () => {
  it('โฟลเดอร์ตาม id สินค้า ชื่อไฟล์ไม่ซ้ำ (ไม่ติด cache เมื่อเปลี่ยนรูป)', () => {
    expect(imagePathFor('p1', 1759132800000)).toBe('p1/1759132800000.jpg')
  })
})
