import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGE, toThaiError } from './supabaseErrors.js'

describe('toThaiError', () => {
  it('ไม่มีข้อผิดพลาด คืน null', () => {
    expect(toThaiError(null)).toBeNull()
    expect(toThaiError(undefined)).toBeNull()
  })

  it('ข้อผิดพลาดจาก record_movement ใช้ข้อความไทยจากฐานข้อมูล (มีตัวเลขคงเหลือ)', () => {
    const error = { code: 'P0001', message: 'จำนวนคงเหลือไม่พอ (คงเหลือ 3.50)', hint: 'insufficient_stock' }
    expect(toThaiError(error)).toBe('จำนวนคงเหลือไม่พอ (คงเหลือ 3.50)')
  })

  it('hint ที่รู้จักแต่ไม่มีข้อความ ใช้ข้อความสำรอง', () => {
    expect(toThaiError({ code: 'P0001', message: '', hint: 'product_inactive' })).toBe(ERROR_MESSAGE.PRODUCT_INACTIVE)
  })

  it('no_profile มี code 42501 แต่ต้องแยกจากไม่มีสิทธิ์ทั่วไป', () => {
    const error = { code: '42501', message: 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน', hint: 'no_profile' }
    expect(toThaiError(error)).toBe(error.message)
  })

  it('ทุก hint ของ record_movement มีข้อความสำรอง', () => {
    const hints = [
      'no_profile',
      'invalid_type',
      'adjust_admin_only',
      'invalid_quantity',
      'future_date',
      'adjust_needs_note',
      'product_not_found',
      'product_inactive',
      'insufficient_stock',
    ]
    for (const hint of hints) {
      const message = toThaiError({ code: 'P0001', hint })
      expect(message).toBeTruthy()
      expect(message).not.toBe(ERROR_MESSAGE.UNKNOWN)
    }
  })

  it('hint ไม่รู้จัก ไม่ใช้ message จากฐานข้อมูล (อาจเป็นภาษาอังกฤษ)', () => {
    expect(toThaiError({ code: 'P0001', message: 'something broke', hint: 'other' })).toBe(ERROR_MESSAGE.UNKNOWN)
  })

  it('SKU ซ้ำ', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_unique"' }
    expect(toThaiError(error)).toBe(ERROR_MESSAGE.DUPLICATE_SKU)
  })

  it('บาร์โค้ดซ้ำ', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "products_barcode_unique"',
      details: 'Key (barcode)=(885) already exists.',
    }
    expect(toThaiError(error)).toBe(ERROR_MESSAGE.DUPLICATE_BARCODE)
  })

  it('ข้อมูลซ้ำแบบอื่น', () => {
    expect(toThaiError({ code: '23505', message: 'duplicate key' })).toBe(ERROR_MESSAGE.DUPLICATE)
  })

  it('ไม่มีสิทธิ์ (RLS)', () => {
    expect(toThaiError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(
      ERROR_MESSAGE.FORBIDDEN,
    )
  })

  it('ข้อผิดพลาดจากการเข้าสู่ระบบ', () => {
    expect(toThaiError({ code: 'invalid_credentials' })).toBe(ERROR_MESSAGE.INVALID_CREDENTIALS)
    expect(toThaiError({ code: 'signup_disabled' })).toBe(ERROR_MESSAGE.SIGNUP_DISABLED)
    expect(toThaiError({ code: 'PGRST301' })).toBe(ERROR_MESSAGE.SESSION_EXPIRED)
  })

  it('ข้อมูลผิด check constraint', () => {
    expect(toThaiError({ code: '23514' })).toBe(ERROR_MESSAGE.INVALID_DATA)
  })

  it('status 429 = ลองบ่อยเกินไป', () => {
    expect(toThaiError({ status: 429, message: 'Too many requests' })).toBe(ERROR_MESSAGE.RATE_LIMIT)
  })

  it('เชื่อมต่อไม่ได้', () => {
    expect(toThaiError({ message: 'TypeError: Failed to fetch' })).toBe(ERROR_MESSAGE.NETWORK)
    expect(toThaiError({ name: 'AuthRetryableFetchError', message: '' })).toBe(ERROR_MESSAGE.NETWORK)
  })

  it('Storage: ไม่มีสิทธิ์ (statusCode 403) และไฟล์ใหญ่เกิน (413)', () => {
    expect(toThaiError({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe(
      ERROR_MESSAGE.FORBIDDEN,
    )
    expect(toThaiError({ statusCode: '413', message: 'Payload too large' })).toBe(ERROR_MESSAGE.IMAGE_TOO_LARGE)
  })

  it('ไม่รู้จัก', () => {
    expect(toThaiError({ message: 'weird' })).toBe(ERROR_MESSAGE.UNKNOWN)
  })
})
