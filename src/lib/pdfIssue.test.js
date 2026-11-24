import { describe, expect, it } from 'vitest'
import { PDF_ISSUE_NOTE, UNMATCHED_REASON, checkPdfIssue, lineNote, looksLikeBundle, orderKey, ordersOfLines, planPdfIssue } from './pdfIssue.js'

const products = [
  { id: 'a', sku: 'KB8A-VAB', legacySku: '', onHand: 10 },
  { id: 'b', sku: 'GL-101I', legacySku: '', onHand: 5 },
  { id: 'c', sku: 'GL-702I', legacySku: 'GL-702 I', onHand: 3 },
]

const shopee = { name: 's.pdf', platform: 'shopee', rows: [
  { sku: 'GL-101I', quantity: 3, orders: ['S1', 'S2'] },
  { sku: 'AP002-B', quantity: 1, orders: ['S3'] },
] }
const lazada = { name: 'l.pdf', platform: 'lazada', rows: [
  { sku: 'kb8a-vab', quantity: 1, orders: ['L1'] },
  { sku: 'GL-101I', quantity: 2, orders: ['L2'] },
] }

describe('planPdfIssue', () => {
  it('รวมจำนวนต่อสินค้าข้ามไฟล์ จับคู่ SKU ไม่สนตัวพิมพ์ แจ้งรหัสที่ไม่ตรง', () => {
    const plan = planPdfIssue([shopee, lazada], products)
    expect(plan.lines.map((l) => [l.productId, l.quantity, l.sources.length, l.partial])).toEqual([
      ['b', 5, 2, false],
      ['a', 1, 1, false],
    ])
    expect(plan.unmatched).toEqual([{ platform: 'shopee', sku: 'AP002-B', quantity: 1, orders: ['S3'], reason: UNMATCHED_REASON.NO_PRODUCT }])
    expect(plan.orders).toEqual([
      { platform: 'shopee', order_no: 'S1', sku: 'GL-101I' },
      { platform: 'shopee', order_no: 'S2', sku: 'GL-101I' },
      { platform: 'lazada', order_no: 'L1', sku: 'kb8a-vab' },
      { platform: 'lazada', order_no: 'L2', sku: 'GL-101I' },
    ])
    expect(plan.skipped).toEqual([])
  })

  it('จับคู่จากรหัสเดิมได้ถ้ารหัสปัจจุบันไม่ตรง', () => {
    const file = { platform: 'tiktok', rows: [{ sku: 'GL-702 I', quantity: 1, orders: ['T1'] }] }
    expect(planPdfIssue([file], products).lines[0].productId).toBe('c')
  })

  it('คำสั่งซื้อที่เคยเบิกแล้ว ข้ามทั้งแถว', () => {
    const issued = new Set([orderKey('lazada', 'L1', 'KB8A-VAB')])
    const plan = planPdfIssue([lazada], products, issued)
    expect(plan.skipped.map((s) => s.sku)).toEqual(['kb8a-vab'])
    expect(plan.lines.map((l) => l.productId)).toEqual(['b'])
    expect(plan.orders.map((o) => o.order_no)).toEqual(['L2'])
  })

  it('เลือกไฟล์เดียวกันซ้ำ 2 ครั้ง ไฟล์ที่ 2 ถูกข้ามทั้งหมด', () => {
    const plan = planPdfIssue([lazada, lazada], products)
    expect(plan.lines.map((l) => [l.productId, l.quantity])).toEqual([['b', 2], ['a', 1]])
    expect(plan.skipped).toHaveLength(2)
  })

  it('Shopee บางคำสั่งซื้อเคยเบิกแล้ว: ยังเบิก แต่ติดธง partial และบันทึกเฉพาะคำสั่งซื้อใหม่', () => {
    const issued = new Set([orderKey('shopee', 'S1', 'GL-101I')])
    const plan = planPdfIssue([shopee], products, issued)
    expect(plan.lines[0]).toMatchObject({ productId: 'b', quantity: 3, partial: true })
    expect(plan.lines[0].sources[0].orders).toEqual(['S2'])
    expect(plan.orders).toEqual([{ platform: 'shopee', order_no: 'S2', sku: 'GL-101I' }])
  })

  it('เลขคำสั่งซื้อเดียวกันต่างแพลตฟอร์ม ไม่ถือว่าซ้ำ', () => {
    const issued = new Set([orderKey('shopee', 'L1', 'KB8A-VAB')])
    expect(planPdfIssue([lazada], products, issued).skipped).toEqual([])
  })
})

describe('checkPdfIssue', () => {
  const lines = [{ productId: 'a', quantity: 1, sources: [] }, { productId: 'b', quantity: 9, sources: [] }]

  it('ใช้จำนวนจากไฟล์ หมายเหตุ ออนไลน์ เกินคงเหลือแจ้งเฉพาะรายการนั้น', () => {
    const { moves, errors } = checkPdfIssue(lines, {}, products, 'store_qc', '2026-11-20')
    expect(moves).toEqual([{ productId: 'a', type: 'out', quantity: '1', note: PDF_ISSUE_NOTE }])
    expect(errors.b.quantity).toContain('คงเหลือไม่พอ')
  })

  it('แก้จำนวนในหน้าต่างได้', () => {
    const { moves, errors } = checkPdfIssue(lines, { b: '4' }, products, 'admin', '2026-11-20')
    expect(errors).toEqual({})
    expect(moves.map((m) => m.quantity)).toEqual(['1', '4'])
  })
})

describe('ชุดสินค้า (Bundle)', () => {
  const parts = [
    { id: 'gl', sku: 'GL-203R', legacySku: '', onHand: 10 },
    { id: 'vlp', sku: 'VLP-889A', legacySku: '', onHand: 10 },
    { id: 'lgt', sku: 'LGT001-P1', legacySku: '', onHand: 10 },
    { id: 'kb', sku: 'KB5A02-VAB', legacySku: '', onHand: 10 },
    { id: 'kbp1', sku: 'KB5A02-VAB-P1', legacySku: '', onHand: 3 },
  ]
  const bundles = [
    { sku: 'GL-203R-P1', items: [{ productId: 'gl', quantity: 1 }, { productId: 'vlp', quantity: 1 }, { productId: 'lgt', quantity: 1 }] },
    { sku: 'KB5A02-VAB-P1', items: [{ productId: 'kb', quantity: 1 }, { productId: 'lgt', quantity: 1 }] },
  ]

  it('แตกชุดเป็นชิ้นส่วน คูณจำนวนชุด รวมกับสินค้าเดียวกันที่สั่งแยก', () => {
    const file = { platform: 'shopee', rows: [
      { sku: 'gl-203r-p1', quantity: 2, orders: ['S1', 'S2'] },
      { sku: 'LGT001-P1', quantity: 1, orders: ['S3'] },
    ] }
    const plan = planPdfIssue([file], parts, new Set(), bundles)
    expect(plan.lines.map((l) => [l.productId, l.quantity])).toEqual([['gl', 2], ['lgt', 3], ['vlp', 2]])
    expect(plan.lines.find((l) => l.productId === 'vlp').sources[0]).toMatchObject({ bundle: 'GL-203R-P1', bundleQty: 2, quantity: 2 })
    // บันทึกคำสั่งซื้อครั้งเดียวต่อแถว ไม่ซ้ำตามจำนวนชิ้นส่วน
    expect(plan.orders.map((o) => o.order_no)).toEqual(['S1', 'S2', 'S3'])
    expect(ordersOfLines(plan.lines).map((o) => o.order_no).toSorted()).toEqual(['S1', 'S2', 'S3'])
  })

  it('รหัสที่เป็นทั้งสินค้าและชุด ถือว่าเป็นชุด', () => {
    const file = { platform: 'shopee', rows: [{ sku: 'KB5A02-VAB-P1', quantity: 1, orders: ['S1'] }] }
    const plan = planPdfIssue([file], parts, new Set(), bundles)
    expect(plan.lines.map((l) => l.productId).toSorted()).toEqual(['kb', 'lgt'])
  })

  it('รหัส -P1 ที่ยังไม่ได้ตั้งเป็นชุด แจ้งเหตุผลต่างจากรหัสไม่ตรง', () => {
    const file = { platform: 'lazada', rows: [{ sku: 'GL-999-P1', quantity: 1, orders: ['L1'] }, { sku: 'XX-1', quantity: 1, orders: ['L2'] }] }
    const plan = planPdfIssue([file], parts, new Set(), bundles)
    expect(plan.unmatched.map((u) => u.reason)).toEqual([UNMATCHED_REASON.BUNDLE_NOT_SET, UNMATCHED_REASON.NO_PRODUCT])
    expect(plan.orders).toEqual([])
  })

  it('ชุดที่มีชิ้นส่วนถูกปิดใช้งาน เบิกไม่ได้ทั้งชุด', () => {
    const file = { platform: 'tiktok', rows: [{ sku: 'GL-203R-P1', quantity: 1, orders: ['T1'] }] }
    const plan = planPdfIssue([file], parts.filter((p) => p.id !== 'vlp'), new Set(), bundles)
    expect(plan.lines).toEqual([])
    expect(plan.unmatched[0].reason).toBe(UNMATCHED_REASON.BUNDLE_INACTIVE)
  })

  it('คำสั่งซื้อชุดที่เคยเบิกแล้ว ข้ามทั้งชุด', () => {
    const file = { platform: 'shopee', rows: [{ sku: 'GL-203R-P1', quantity: 1, orders: ['S1'] }] }
    const plan = planPdfIssue([file], parts, new Set([orderKey('shopee', 'S1', 'GL-203R-P1')]), bundles)
    expect(plan.lines).toEqual([])
    expect(plan.skipped).toHaveLength(1)
  })

  it('หมายเหตุบอกชุดที่มา', () => {
    expect(lineNote({ sources: [{ bundle: null }] })).toBe(PDF_ISSUE_NOTE)
    expect(lineNote({ sources: [{ bundle: 'GL-203R-P1' }, { bundle: 'GL-101I-P1' }, { bundle: 'GL-203R-P1' }] })).toBe('ออนไลน์ (ชุด GL-203R-P1, GL-101I-P1)')
    const many = { sources: Array.from({ length: 40 }, (_, i) => ({ bundle: `GL-${i}-ABCDEF-P1` })) }
    expect(lineNote(many).length).toBeLessThanOrEqual(200)
  })

  it('looksLikeBundle', () => {
    for (const sku of ['GL-203R-P1', 'KB5A02-VAB-P2-LCH001', 'vlp-889a-p1']) expect(looksLikeBundle(sku)).toBe(true)
    for (const sku of ['LGT001-P1X', 'GL-203R', 'AP-901']) expect(looksLikeBundle(sku)).toBe(false)
  })
})
