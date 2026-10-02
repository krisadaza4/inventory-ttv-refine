import { describe, expect, it } from 'vitest'
import { ROLE } from './roles.js'
import {
  MOVEMENT_LABEL,
  MOVEMENT_TYPE,
  allowedMovementTypes,
  movementEffect,
  stockAfter,
  STOCK_STATUS,
  getStockStatus,
  countByStockStatus,
  filterByCategory,
  filterProducts,
  listCategories,
  listLocations,
  listUnits,
  NO_LOCATION,
  quantityAfter,
  sortProducts,
  searchProducts,
  signedQuantity,
  sortByStockStatus,
  validateMovement,
  validateProduct,
} from './stockRules.js'

describe('signedQuantity', () => {
  it('รับเข้า เป็นบวก', () => {
    expect(signedQuantity(MOVEMENT_TYPE.IN, 5)).toBe(5)
  })

  it('เบิกออก เป็นลบ', () => {
    expect(signedQuantity(MOVEMENT_TYPE.OUT, 5)).toBe(-5)
  })

  it('ปรับยอด ใช้ค่าตามที่กรอก (บวก/ลบ)', () => {
    expect(signedQuantity(MOVEMENT_TYPE.ADJUST, 3)).toBe(3)
    expect(signedQuantity(MOVEMENT_TYPE.ADJUST, -3)).toBe(-3)
  })

  it('รับค่าที่เป็นข้อความตัวเลข (numeric จาก Supabase)', () => {
    expect(signedQuantity(MOVEMENT_TYPE.OUT, '1.25')).toBe(-1.25)
  })

  it('ประเภทไม่รู้จัก ให้ error', () => {
    expect(() => signedQuantity('transfer', 1)).toThrow()
  })
})

describe('getStockStatus', () => {
  it('คงเหลือ 0 = หมด', () => {
    expect(getStockStatus(0, 5)).toBe(STOCK_STATUS.OUT)
  })

  it('คงเหลือ 0 และจุดสั่งซื้อ 0 = หมด', () => {
    expect(getStockStatus(0, 0)).toBe(STOCK_STATUS.OUT)
  })

  it('เท่ากับจุดสั่งซื้อ = ใกล้หมด', () => {
    expect(getStockStatus(5, 5)).toBe(STOCK_STATUS.LOW)
  })

  it('มากกว่า 0 แต่น้อยกว่าจุดสั่งซื้อ = ใกล้หมด', () => {
    expect(getStockStatus(1, 5)).toBe(STOCK_STATUS.LOW)
  })

  it('มากกว่าจุดสั่งซื้อ = ปกติ', () => {
    expect(getStockStatus(6, 5)).toBe(STOCK_STATUS.OK)
  })

  it('จุดสั่งซื้อ 0 และมีของ = ปกติ', () => {
    expect(getStockStatus(0.01, 0)).toBe(STOCK_STATUS.OK)
  })

  it('ทศนิยม: 0.5 เท่ากับจุดสั่งซื้อ 0.5 = ใกล้หมด', () => {
    expect(getStockStatus(0.5, 0.5)).toBe(STOCK_STATUS.LOW)
  })

  it('ทศนิยม: ปัดเศษทศนิยม 2 ตำแหน่งก่อนเทียบ (0.1 + 0.2 = 0.3)', () => {
    expect(getStockStatus(0.1 + 0.2, 0.3)).toBe(STOCK_STATUS.LOW)
  })

  it('ทศนิยม: 0.51 มากกว่า 0.5 = ปกติ', () => {
    expect(getStockStatus(0.51, 0.5)).toBe(STOCK_STATUS.OK)
  })

  it('รับค่าที่เป็นข้อความตัวเลข', () => {
    expect(getStockStatus('0', '2')).toBe(STOCK_STATUS.OUT)
    expect(getStockStatus('2.00', '2')).toBe(STOCK_STATUS.LOW)
  })
})

describe('sortByStockStatus', () => {
  const products = [
    { name: 'น้ำดื่ม', onHand: 20, reorderPoint: 5 },
    { name: 'กาแฟ', onHand: 0, reorderPoint: 5 },
    { name: 'ขนมปัง', onHand: 3, reorderPoint: 5 },
    { name: 'ข้าวสาร', onHand: 50, reorderPoint: 10 },
    { name: 'กล่อง', onHand: 0, reorderPoint: 0 },
  ]

  it('เรียง หมด → ใกล้หมด → ปกติ แล้วตามชื่อ', () => {
    expect(sortByStockStatus(products).map((p) => p.name)).toEqual([
      'กล่อง',
      'กาแฟ',
      'ขนมปัง',
      'ข้าวสาร',
      'น้ำดื่ม',
    ])
  })

  it('ไม่แก้ array เดิม', () => {
    const before = products.map((p) => p.name)
    sortByStockStatus(products)
    expect(products.map((p) => p.name)).toEqual(before)
  })

  it('array ว่าง', () => {
    expect(sortByStockStatus([])).toEqual([])
  })
})

describe('validateProduct', () => {
  const valid = {
    sku: 'DR-001',
    barcode: '8851234567890',
    name: 'น้ำดื่ม',
    category: 'เครื่องดื่ม',
    unit: 'ขวด',
    reorderPoint: '5',
  }

  it('ข้อมูลครบ ไม่มี error', () => {
    expect(validateProduct(valid)).toEqual({})
  })

  it('ไม่มีบาร์โค้ด ได้ (ไม่บังคับ)', () => {
    expect(validateProduct({ ...valid, barcode: '' })).toEqual({})
    expect(validateProduct({ ...valid, barcode: null })).toEqual({})
  })

  it('ช่องบังคับว่างหรือมีแต่ช่องว่าง', () => {
    const errors = validateProduct({ ...valid, sku: '  ', name: '', category: undefined, unit: ' ' })
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'sku', 'unit'])
  })

  it('จุดสั่งซื้อ 0 ได้', () => {
    expect(validateProduct({ ...valid, reorderPoint: 0 })).toEqual({})
  })

  it('จุดสั่งซื้อว่าง ถือเป็น 0', () => {
    expect(validateProduct({ ...valid, reorderPoint: '' })).toEqual({})
  })

  it('จุดสั่งซื้อติดลบ ไม่ได้', () => {
    expect(validateProduct({ ...valid, reorderPoint: '-1' })).toHaveProperty('reorderPoint')
  })

  it('จุดสั่งซื้อทศนิยม 2 ตำแหน่ง ได้ แต่ 3 ตำแหน่ง ไม่ได้', () => {
    expect(validateProduct({ ...valid, reorderPoint: '2.5' })).toEqual({})
    expect(validateProduct({ ...valid, reorderPoint: '2.55' })).toEqual({})
    expect(validateProduct({ ...valid, reorderPoint: '2.555' })).toHaveProperty('reorderPoint')
  })

  it('จุดสั่งซื้อไม่ใช่ตัวเลข ไม่ได้', () => {
    expect(validateProduct({ ...valid, reorderPoint: 'abc' })).toHaveProperty('reorderPoint')
  })
})

describe('validateMovement', () => {
  const today = '2026-09-29'
  const base = { type: MOVEMENT_TYPE.IN, quantity: '5', movementDate: today, note: '' }

  it('รับเข้าปกติ ไม่มี error', () => {
    expect(validateMovement(base, 0, ROLE.STAFF, today)).toEqual({})
  })

  it('ประเภทไม่ถูกต้อง', () => {
    expect(validateMovement({ ...base, type: 'transfer' }, 0, ROLE.STAFF, today)).toHaveProperty('type')
  })

  it('จำนวนว่าง, 0, ติดลบ, ไม่ใช่ตัวเลข ไม่ได้ (รับเข้า/เบิกออก)', () => {
    for (const quantity of ['', '0', '-1', 'abc']) {
      expect(validateMovement({ ...base, quantity }, 10, ROLE.STAFF, today)).toHaveProperty('quantity')
      expect(validateMovement({ ...base, type: MOVEMENT_TYPE.OUT, quantity }, 10, ROLE.STAFF, today)).toHaveProperty(
        'quantity',
      )
    }
  })

  it('จำนวนทศนิยมเกิน 2 ตำแหน่ง ไม่ได้', () => {
    expect(validateMovement({ ...base, quantity: '1.25' }, 0, ROLE.STAFF, today)).toEqual({})
    expect(validateMovement({ ...base, quantity: '1.255' }, 0, ROLE.STAFF, today)).toHaveProperty('quantity')
  })

  it('เบิกออกเท่ากับคงเหลือ ได้ (เหลือ 0)', () => {
    expect(validateMovement({ ...base, type: MOVEMENT_TYPE.OUT, quantity: '10' }, 10, ROLE.STAFF, today)).toEqual({})
  })

  it('เบิกออกเกินคงเหลือ ไม่ได้', () => {
    expect(
      validateMovement({ ...base, type: MOVEMENT_TYPE.OUT, quantity: '10.01' }, 10, ROLE.STAFF, today),
    ).toHaveProperty('quantity')
  })

  it('เบิกออกทศนิยมพอดีคงเหลือ (0.1 + 0.2) ได้', () => {
    expect(validateMovement({ ...base, type: MOVEMENT_TYPE.OUT, quantity: '0.3' }, 0.1 + 0.2, ROLE.STAFF, today)).toEqual(
      {},
    )
  })

  it('ปรับยอด staff ทำไม่ได้', () => {
    const adjust = { ...base, type: MOVEMENT_TYPE.ADJUST, quantity: '2', note: 'นับใหม่' }
    expect(validateMovement(adjust, 5, ROLE.STAFF, today)).toHaveProperty('type')
  })

  it('ปรับยอด admin บวกหรือลบได้ ต้องมีหมายเหตุ', () => {
    const adjust = { ...base, type: MOVEMENT_TYPE.ADJUST, note: 'นับสต็อก' }
    expect(validateMovement({ ...adjust, quantity: '2' }, 5, ROLE.ADMIN, today)).toEqual({})
    expect(validateMovement({ ...adjust, quantity: '-5' }, 5, ROLE.ADMIN, today)).toEqual({})
    expect(validateMovement({ ...adjust, quantity: '2', note: '  ' }, 5, ROLE.ADMIN, today)).toHaveProperty('note')
  })

  it('ปรับยอดเป็น 0 ไม่ได้', () => {
    const adjust = { ...base, type: MOVEMENT_TYPE.ADJUST, quantity: '0', note: 'นับสต็อก' }
    expect(validateMovement(adjust, 5, ROLE.ADMIN, today)).toHaveProperty('quantity')
  })

  it('ปรับยอดลบจนติดลบ ไม่ได้', () => {
    const adjust = { ...base, type: MOVEMENT_TYPE.ADJUST, quantity: '-6', note: 'นับสต็อก' }
    expect(validateMovement(adjust, 5, ROLE.ADMIN, today)).toHaveProperty('quantity')
  })

  it('วันในอนาคต ไม่ได้ แต่วันนี้และวันก่อนได้', () => {
    expect(validateMovement({ ...base, movementDate: '2026-09-30' }, 0, ROLE.STAFF, today)).toHaveProperty('movementDate')
    expect(validateMovement({ ...base, movementDate: '2026-09-28' }, 0, ROLE.STAFF, today)).toEqual({})
  })

  it('วันที่ว่างหรือรูปแบบผิด ไม่ได้', () => {
    expect(validateMovement({ ...base, movementDate: '' }, 0, ROLE.STAFF, today)).toHaveProperty('movementDate')
    expect(validateMovement({ ...base, movementDate: '29/09/2026' }, 0, ROLE.STAFF, today)).toHaveProperty('movementDate')
  })
})

describe('searchProducts', () => {
  const products = [
    { sku: 'DR-001', barcode: '8851234567890', name: 'Coffee เย็น', category: 'เครื่องดื่ม' },
    { sku: 'FD-010', barcode: null, name: 'ขนมปัง', category: 'อาหาร' },
    { sku: 'dr-002', barcode: '8850000000001', name: 'น้ำดื่ม', category: 'เครื่องดื่ม' },
  ]
  const skus = (list) => list.map((p) => p.sku)

  it('คำค้นว่างหรือมีแต่ช่องว่าง คืนทั้งหมด', () => {
    expect(searchProducts(products, '')).toEqual(products)
    expect(searchProducts(products, '   ')).toEqual(products)
    expect(searchProducts(products, undefined)).toEqual(products)
  })

  it('ค้นจากชื่อ ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    expect(skus(searchProducts(products, 'COFFEE'))).toEqual(['DR-001'])
    expect(skus(searchProducts(products, 'ขนม'))).toEqual(['FD-010'])
  })

  it('ค้นจากรหัส ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    expect(skus(searchProducts(products, 'dr-'))).toEqual(['DR-001', 'dr-002'])
  })

  it('ค้นจากบาร์โค้ด (ตัดช่องว่างหัวท้ายจากเครื่องสแกน)', () => {
    expect(skus(searchProducts(products, ' 8850000000001 '))).toEqual(['dr-002'])
  })

  it('สินค้าไม่มีบาร์โค้ด ไม่ error', () => {
    expect(searchProducts(products, 'ไม่มีสินค้านี้')).toEqual([])
  })
})

describe('filterProducts', () => {
  const products = [
    { sku: 'A', name: 'A', category: 'X', unit: 'ชิ้น', location: 'C1', onHand: 0, reorderPoint: 0, repairQty: 2 },
    { sku: 'B', name: 'B', category: 'Y', unit: 'กล่อง', location: '', onHand: 3, reorderPoint: 5, repairQty: 0 },
    { sku: 'C', name: 'C', category: 'X', unit: 'ชิ้น', location: null, onHand: 10, reorderPoint: 5, repairQty: 0 },
  ]
  const skus = (list) => list.map((p) => p.sku)

  it('ไม่ใส่เงื่อนไข คืนทั้งหมด', () => {
    expect(filterProducts(products)).toEqual(products)
    expect(filterProducts(products, { category: '', status: '', location: '', unit: '', repairOnly: false })).toEqual(
      products,
    )
  })

  it('กรองตามสถานะ', () => {
    expect(skus(filterProducts(products, { status: STOCK_STATUS.OUT }))).toEqual(['A'])
    expect(skus(filterProducts(products, { status: STOCK_STATUS.LOW }))).toEqual(['B'])
    expect(skus(filterProducts(products, { status: STOCK_STATUS.OK }))).toEqual(['C'])
  })

  it('กรองตามที่เก็บ และที่ยังไม่ระบุ', () => {
    expect(skus(filterProducts(products, { location: 'C1' }))).toEqual(['A'])
    expect(skus(filterProducts(products, { location: NO_LOCATION }))).toEqual(['B', 'C'])
  })

  it('กรองหน่วย และเฉพาะที่มีของรอซ่อม', () => {
    expect(skus(filterProducts(products, { unit: 'ชิ้น' }))).toEqual(['A', 'C'])
    expect(skus(filterProducts(products, { repairOnly: true }))).toEqual(['A'])
  })

  it('หลายเงื่อนไขพร้อมกัน', () => {
    expect(skus(filterProducts(products, { category: 'X', status: STOCK_STATUS.OK }))).toEqual(['C'])
  })

  it('listLocations ไม่รวมค่าว่าง และ listUnits ไม่ซ้ำ', () => {
    expect(listLocations(products)).toEqual(['C1'])
    expect(listUnits(products)).toEqual(['กล่อง', 'ชิ้น'])
  })
})

describe('sortProducts', () => {
  const products = [
    { sku: 'B', name: 'ข', onHand: 10, reorderPoint: 5, avgMonthlySales: null },
    { sku: 'A', name: 'ก', onHand: 0, reorderPoint: 0, avgMonthlySales: 4 },
    { sku: 'C', name: 'ค', onHand: 3, reorderPoint: 5, avgMonthlySales: 9 },
  ]
  const skus = (list) => list.map((p) => p.sku)

  it('สถานะ: หมด → ใกล้หมด → ปกติ และกลับด้านได้', () => {
    expect(skus(sortProducts(products, 'status', 'asc'))).toEqual(['A', 'C', 'B'])
    expect(skus(sortProducts(products, 'status', 'desc'))).toEqual(['B', 'C', 'A'])
  })

  it('ตัวเลขและข้อความ', () => {
    expect(skus(sortProducts(products, 'onHand', 'desc'))).toEqual(['B', 'C', 'A'])
    expect(skus(sortProducts(products, 'sku', 'asc'))).toEqual(['A', 'B', 'C'])
  })

  it('ค่าว่างอยู่ท้ายเสมอ', () => {
    expect(skus(sortProducts(products, 'avgMonthlySales', 'desc'))).toEqual(['C', 'A', 'B'])
    expect(skus(sortProducts(products, 'avgMonthlySales', 'asc'))).toEqual(['A', 'C', 'B'])
  })

  it('ไม่แก้ array เดิม', () => {
    const before = skus(products)
    sortProducts(products, 'sku', 'asc')
    expect(skus(products)).toEqual(before)
  })
})

describe('filterByCategory', () => {
  const products = [
    { sku: 'A', category: 'เครื่องดื่ม' },
    { sku: 'B', category: 'อาหาร' },
    { sku: 'C', category: 'เครื่องดื่ม' },
  ]

  it('ไม่เลือกหมวดหมู่ คืนทั้งหมด', () => {
    expect(filterByCategory(products, '')).toEqual(products)
    expect(filterByCategory(products, null)).toEqual(products)
  })

  it('กรองตามหมวดหมู่ที่ตรงกัน', () => {
    expect(filterByCategory(products, 'เครื่องดื่ม').map((p) => p.sku)).toEqual(['A', 'C'])
  })

  it('หมวดหมู่ที่ไม่มี คืน array ว่าง', () => {
    expect(filterByCategory(products, 'ของใช้')).toEqual([])
  })
})

describe('countByStockStatus', () => {
  it('นับทั้งหมดและแยกตามสถานะ', () => {
    const products = [
      { onHand: 0, reorderPoint: 5 },
      { onHand: 3, reorderPoint: 5 },
      { onHand: 5, reorderPoint: 5 },
      { onHand: 9, reorderPoint: 5 },
    ]
    expect(countByStockStatus(products)).toEqual({ total: 4, out: 1, low: 2, ok: 1 })
  })

  it('ไม่มีสินค้า', () => {
    expect(countByStockStatus([])).toEqual({ total: 0, out: 0, low: 0, ok: 0 })
  })
})

describe('listCategories', () => {
  it('หมวดหมู่ไม่ซ้ำ เรียงตามภาษาไทย', () => {
    const products = [{ category: 'อาหาร' }, { category: 'เครื่องดื่ม' }, { category: 'อาหาร' }, { category: 'ของใช้' }]
    expect(listCategories(products)).toEqual(['ของใช้', 'เครื่องดื่ม', 'อาหาร'])
  })

  it('ไม่มีสินค้า', () => {
    expect(listCategories([])).toEqual([])
  })
})

describe('quantityAfter', () => {
  it('คำนวณคงเหลือหลังบันทึกตามประเภท', () => {
    expect(quantityAfter(4, MOVEMENT_TYPE.IN, '3')).toBe(7)
    expect(quantityAfter(4, MOVEMENT_TYPE.OUT, '3')).toBe(1)
    expect(quantityAfter(4, MOVEMENT_TYPE.ADJUST, '-1.5')).toBe(2.5)
  })

  it('ปัดทศนิยม 2 ตำแหน่ง (0.3 - 0.1 - 0.2 = 0)', () => {
    expect(quantityAfter(0.3, MOVEMENT_TYPE.OUT, '0.3')).toBe(0)
    expect(quantityAfter(0.1 + 0.2, MOVEMENT_TYPE.OUT, '0.3')).toBe(0)
  })

  it('ติดลบได้ (ให้หน้าจอเตือน)', () => {
    expect(quantityAfter(1, MOVEMENT_TYPE.OUT, '2')).toBe(-1)
  })

  it('จำนวนยังไม่ถูกต้อง คืน null', () => {
    expect(quantityAfter(4, MOVEMENT_TYPE.IN, '')).toBeNull()
    expect(quantityAfter(4, MOVEMENT_TYPE.IN, 'abc')).toBeNull()
    expect(quantityAfter(4, MOVEMENT_TYPE.IN, '1.255')).toBeNull()
    expect(quantityAfter(4, 'transfer', '1')).toBeNull()
  })
})

describe('สินค้ารอซ่อม', () => {
  const today = '2026-10-01'
  const stock = { onHand: 10, repairQty: 4 }
  const move = (type, quantity, note = 'สปาร์คเสีย') => ({ type, quantity, movementDate: today, note })

  it('ทุกประเภทมีป้ายภาษาไทย', () => {
    expect(Object.values(MOVEMENT_TYPE).every((t) => MOVEMENT_LABEL[t])).toBe(true)
  })

  it('movementEffect: ส่งซ่อม ของดี → รอซ่อม, ซ่อมเสร็จ กลับ, ตัดจำหน่าย ลดรอซ่อม', () => {
    expect(movementEffect(MOVEMENT_TYPE.TO_REPAIR, 3)).toEqual({ good: -3, repair: 3 })
    expect(movementEffect(MOVEMENT_TYPE.REPAIRED, 2)).toEqual({ good: 2, repair: -2 })
    expect(movementEffect(MOVEMENT_TYPE.WRITE_OFF, 1)).toEqual({ good: 0, repair: -1 })
    expect(movementEffect(MOVEMENT_TYPE.OUT, 1)).toEqual({ good: -1, repair: 0 })
  })

  it('signedQuantity: ผลต่อของดี ยกเว้นตัดจำหน่ายเป็นลบ', () => {
    expect(signedQuantity(MOVEMENT_TYPE.TO_REPAIR, 3)).toBe(-3)
    expect(signedQuantity(MOVEMENT_TYPE.REPAIRED, 3)).toBe(3)
    expect(signedQuantity(MOVEMENT_TYPE.WRITE_OFF, 3)).toBe(-3)
  })

  it('allowedMovementTypes: staff ไม่มีปรับยอดและตัดจำหน่าย', () => {
    expect(allowedMovementTypes(ROLE.ADMIN)).toEqual(Object.values(MOVEMENT_TYPE))
    expect(allowedMovementTypes(ROLE.STAFF)).toEqual(['in', 'out', 'to_repair', 'repaired'])
  })

  it('ส่งซ่อม/ซ่อมเสร็จ/ตัดจำหน่าย ต้องมีเหตุผล', () => {
    for (const type of [MOVEMENT_TYPE.TO_REPAIR, MOVEMENT_TYPE.REPAIRED, MOVEMENT_TYPE.WRITE_OFF]) {
      expect(validateMovement(move(type, '1', ' '), stock, ROLE.ADMIN, today).note).toBe('กรุณาระบุเหตุผล')
      expect(validateMovement(move(type, '1'), stock, ROLE.ADMIN, today)).toEqual({})
    }
  })

  it('ส่งซ่อมเกินของดี / ซ่อมเสร็จหรือตัดจำหน่ายเกินรอซ่อม ไม่ได้', () => {
    expect(validateMovement(move(MOVEMENT_TYPE.TO_REPAIR, '11'), stock, ROLE.STAFF, today).quantity).toBe(
      'คงเหลือไม่พอ (คงเหลือ 10)',
    )
    expect(validateMovement(move(MOVEMENT_TYPE.REPAIRED, '5'), stock, ROLE.STAFF, today).quantity).toBe(
      'ยอดรอซ่อมไม่พอ (รอซ่อม 4)',
    )
    expect(validateMovement(move(MOVEMENT_TYPE.WRITE_OFF, '5'), stock, ROLE.ADMIN, today)).toHaveProperty('quantity')
  })

  it('เบิกออกใช้ได้เฉพาะของดี ไม่นับรอซ่อม', () => {
    expect(validateMovement(move(MOVEMENT_TYPE.OUT, '11'), stock, ROLE.STAFF, today)).toHaveProperty('quantity')
  })

  it('staff ตัดจำหน่ายไม่ได้', () => {
    expect(validateMovement(move(MOVEMENT_TYPE.WRITE_OFF, '1'), stock, ROLE.STAFF, today).type).toBe(
      'ตัดจำหน่ายได้เฉพาะเจ้าของร้าน',
    )
  })

  it('stockAfter คืนทั้งของดีและรอซ่อม', () => {
    expect(stockAfter(stock, MOVEMENT_TYPE.TO_REPAIR, '3')).toEqual({ onHand: 7, repairQty: 7 })
    expect(stockAfter(stock, MOVEMENT_TYPE.WRITE_OFF, '4')).toEqual({ onHand: 10, repairQty: 0 })
    expect(stockAfter(10, MOVEMENT_TYPE.IN, '1')).toEqual({ onHand: 11, repairQty: 0 })
    expect(stockAfter(stock, MOVEMENT_TYPE.IN, '')).toBeNull()
  })
})
