import { describe, expect, it } from 'vitest'
import { formatQuantity } from './numberFormat.js'

describe('formatQuantity', () => {
  it('จำนวนเต็มไม่มีทศนิยม มีตัวคั่นหลักพัน', () => {
    expect(formatQuantity(1200)).toBe('1,200')
  })

  it('ทศนิยมไม่เกิน 2 ตำแหน่ง ไม่เติม 0', () => {
    expect(formatQuantity(2.5)).toBe('2.5')
    expect(formatQuantity(0.125)).toBe('0.13')
  })

  it('รับข้อความตัวเลข', () => {
    expect(formatQuantity('12.50')).toBe('12.5')
  })

  it('แสดงเครื่องหมาย + / − เมื่อขอ', () => {
    expect(formatQuantity(3, { signed: true })).toBe('+3')
    expect(formatQuantity(-2.5, { signed: true })).toBe('−2.5')
    expect(formatQuantity(0, { signed: true })).toBe('0')
  })
})
