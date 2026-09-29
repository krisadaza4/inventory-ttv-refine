import { describe, expect, it } from 'vitest'
import { MOVEMENT_COLUMNS, PRODUCT_COLUMNS, PROFILE_COLUMNS } from './mappers.js'
import { EXPORT_PAGE_SIZE, PAGE_SIZE, createRepository } from './repositories.js'
import { ERROR_MESSAGE } from './supabaseErrors.js'

// supabase client จำลอง: บันทึกทุกการเรียกในโซ่คำสั่ง แล้วคืนผลที่กำหนด
const fakeClient = (result) => {
  const calls = []
  const builder = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'single', 'maybeSingle']) {
    builder[method] = (...args) => {
      calls.push([method, ...args])
      return builder
    }
  }
  return {
    calls,
    from: (table) => {
      calls.push(['from', table])
      return builder
    },
    rpc: (name, params) => {
      calls.push(['rpc', name, params])
      return builder
    },
  }
}

const throwingClient = () => ({
  from: () => {
    throw new TypeError('Failed to fetch')
  },
  rpc: () => {
    throw new TypeError('Failed to fetch')
  },
})

const productRow = {
  id: 'p1',
  sku: 'DR-001',
  barcode: null,
  name: 'น้ำดื่ม',
  category: 'เครื่องดื่ม',
  unit: 'ขวด',
  reorder_point: '5.00',
  active: true,
  on_hand: '12.00',
}

const movementRow = {
  id: 'm1',
  product_id: 'p1',
  type: 'in',
  quantity: '3.00',
  movement_date: '2026-09-29',
  note: null,
  created_by: 'u1',
  created_at: '2026-09-29T03:00:00Z',
}

const newProduct = {
  sku: 'DR-002',
  barcode: '',
  name: 'โซดา',
  category: 'เครื่องดื่ม',
  unit: 'ขวด',
  reorderPoint: '2',
}

const outMovement = { productId: 'p1', type: 'out', quantity: '5', movementDate: '2026-09-29' }

describe('createRepository', () => {
  it('มีเฉพาะฟังก์ชันตามที่ออกแบบ ไม่มีฟังก์ชันลบ', () => {
    const repo = createRepository(fakeClient({ data: [], error: null }))
    expect(Object.keys(repo).sort()).toEqual([
      'getMyProfile',
      'listAllMovements',
      'listMovements',
      'listProducts',
      'recordMovement',
      'saveProduct',
      'setProductActive',
    ])
  })

  it('ไม่เคยเรียก delete และไม่เขียนตรงเข้า stock_movements', async () => {
    const client = fakeClient({ data: [], error: null })
    const repo = createRepository(client)
    await repo.listProducts()
    await repo.listMovements()
    await repo.recordMovement(outMovement)
    const methods = client.calls.map(([method]) => method)
    expect(methods).not.toContain('delete')
    expect(methods).not.toContain('insert')
    expect(methods).not.toContain('update')
  })
})

describe('listProducts', () => {
  it('อ่านจาก product_stock เฉพาะที่เปิดใช้งาน เรียงตามชื่อ', async () => {
    const client = fakeClient({ data: [productRow], error: null })
    const { products, error } = await createRepository(client).listProducts()
    expect(error).toBeNull()
    expect(products[0]).toMatchObject({ id: 'p1', onHand: 12, reorderPoint: 5 })
    expect(client.calls).toEqual([
      ['from', 'product_stock'],
      ['select', PRODUCT_COLUMNS],
      ['eq', 'active', true],
      ['order', 'name', { ascending: true }],
    ])
  })

  it('includeInactive ไม่กรอง active', async () => {
    const client = fakeClient({ data: [], error: null })
    await createRepository(client).listProducts({ includeInactive: true })
    expect(client.calls.map(([method]) => method)).not.toContain('eq')
  })

  it('ผิดพลาด คืนรายการว่างและข้อความไทย', async () => {
    const client = fakeClient({ data: null, error: { code: '42501' } })
    expect(await createRepository(client).listProducts()).toEqual({ products: [], error: ERROR_MESSAGE.FORBIDDEN })
  })

  it('เชื่อมต่อไม่ได้ (โยน error) ไม่ล้ม คืนข้อความไทย', async () => {
    expect(await createRepository(throwingClient()).listProducts()).toEqual({
      products: [],
      error: ERROR_MESSAGE.NETWORK,
    })
  })
})

describe('saveProduct', () => {
  it('ไม่มี id = insert เฉพาะคอลัมน์ที่ grant', async () => {
    const client = fakeClient({ data: { id: 'p2' }, error: null })
    expect(await createRepository(client).saveProduct(newProduct)).toEqual({ id: 'p2', error: null })
    expect(client.calls.slice(0, 2)).toEqual([
      ['from', 'products'],
      ['insert', { sku: 'DR-002', barcode: null, name: 'โซดา', category: 'เครื่องดื่ม', unit: 'ขวด', reorder_point: 2 }],
    ])
  })

  it('มี id = update ตาม id และไม่ส่ง id/active ใน payload', async () => {
    const client = fakeClient({ data: { id: 'p1' }, error: null })
    await createRepository(client).saveProduct({ ...newProduct, id: 'p1', onHand: 5, active: true })
    const [, payload] = client.calls.find(([method]) => method === 'update')
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('active')
    expect(client.calls).toContainEqual(['eq', 'id', 'p1'])
  })

  it('SKU ซ้ำ คืนข้อความไทย', async () => {
    const client = fakeClient({ data: null, error: { code: '23505', message: 'violates "products_sku_unique"' } })
    expect(await createRepository(client).saveProduct(newProduct)).toEqual({
      id: null,
      error: ERROR_MESSAGE.DUPLICATE_SKU,
    })
  })
})

describe('setProductActive', () => {
  it('update เฉพาะ active ตาม id', async () => {
    const client = fakeClient({ data: { id: 'p1' }, error: null })
    expect(await createRepository(client).setProductActive('p1', false)).toEqual({ error: null })
    expect(client.calls.slice(0, 3)).toEqual([
      ['from', 'products'],
      ['update', { active: false }],
      ['eq', 'id', 'p1'],
    ])
  })

  it('ไม่มีสิทธิ์ (RLS กรองแถวออก) คืนข้อความไทย', async () => {
    const client = fakeClient({ data: null, error: { code: 'PGRST116' } })
    expect(await createRepository(client).setProductActive('p1', false)).toEqual({ error: ERROR_MESSAGE.NOT_FOUND })
  })
})

describe('recordMovement', () => {
  it('เรียก record_movement แปลงจำนวนเป็นตัวเลข และหมายเหตุว่างเป็น null', async () => {
    const client = fakeClient({ data: movementRow, error: null })
    const { movement, error } = await createRepository(client).recordMovement({
      productId: 'p1',
      type: 'in',
      quantity: '3',
      movementDate: '2026-09-29',
      note: '  ',
    })
    expect(error).toBeNull()
    expect(movement).toMatchObject({ id: 'm1', quantity: 3 })
    expect(client.calls[0]).toEqual([
      'rpc',
      'record_movement',
      { p_product_id: 'p1', p_type: 'in', p_quantity: 3, p_movement_date: '2026-09-29', p_note: null },
    ])
  })

  it('ตัดช่องว่างหมายเหตุ และปรับยอดติดลบได้', async () => {
    const client = fakeClient({ data: movementRow, error: null })
    await createRepository(client).recordMovement({
      productId: 'p1',
      type: 'adjust',
      quantity: '-1',
      movementDate: '2026-09-29',
      note: ' นับใหม่ ',
    })
    expect(client.calls[0][2]).toMatchObject({ p_quantity: -1, p_note: 'นับใหม่' })
  })

  it('คงเหลือไม่พอ คืนข้อความไทยจากฐานข้อมูล', async () => {
    const error = { code: 'P0001', message: 'จำนวนคงเหลือไม่พอ (คงเหลือ 1.00)', hint: 'insufficient_stock' }
    const client = fakeClient({ data: null, error })
    expect(await createRepository(client).recordMovement(outMovement)).toEqual({
      movement: null,
      error: 'จำนวนคงเหลือไม่พอ (คงเหลือ 1.00)',
    })
  })
})

describe('listMovements', () => {
  it('PAGE_SIZE = 50', () => {
    expect(PAGE_SIZE).toBe(50)
  })

  it('ล่าสุดก่อน โหลดหน้าแรก', async () => {
    const client = fakeClient({ data: [movementRow], error: null })
    const { movements, hasMore, error } = await createRepository(client).listMovements()
    expect(error).toBeNull()
    expect(movements).toHaveLength(1)
    expect(hasMore).toBe(false)
    expect(client.calls).toEqual([
      ['from', 'stock_movements'],
      ['select', MOVEMENT_COLUMNS],
      ['order', 'movement_date', { ascending: false }],
      ['order', 'created_at', { ascending: false }],
      ['range', 0, PAGE_SIZE - 1],
    ])
  })

  it('กรองตามสินค้าและประเภท และหน้าถัดไป', async () => {
    const client = fakeClient({ data: [], error: null })
    await createRepository(client).listMovements({ productId: 'p1', type: 'out', page: 2 })
    expect(client.calls).toContainEqual(['eq', 'product_id', 'p1'])
    expect(client.calls).toContainEqual(['eq', 'type', 'out'])
    expect(client.calls).toContainEqual(['range', 2 * PAGE_SIZE, 3 * PAGE_SIZE - 1])
  })

  it('ได้ครบหน้า = อาจมีหน้าถัดไป', async () => {
    const client = fakeClient({ data: Array.from({ length: PAGE_SIZE }, () => movementRow), error: null })
    expect((await createRepository(client).listMovements()).hasMore).toBe(true)
  })

  it('ผิดพลาด คืนรายการว่าง', async () => {
    const client = fakeClient({ data: null, error: { code: 'PGRST301' } })
    expect(await createRepository(client).listMovements()).toEqual({
      movements: [],
      hasMore: false,
      error: ERROR_MESSAGE.SESSION_EXPIRED,
    })
  })
})

describe('getMyProfile', () => {
  it('อ่าน profile ของผู้ใช้ตาม id', async () => {
    const client = fakeClient({ data: { id: 'u1', display_name: 'สมชาย', role: 'staff' }, error: null })
    expect(await createRepository(client).getMyProfile('u1')).toEqual({
      profile: { id: 'u1', displayName: 'สมชาย', role: 'staff' },
      error: null,
    })
    expect(client.calls).toEqual([
      ['from', 'profiles'],
      ['select', PROFILE_COLUMNS],
      ['eq', 'id', 'u1'],
      ['maybeSingle'],
    ])
  })

  it('ไม่มี profile คืน null ไม่ใช่ error', async () => {
    const client = fakeClient({ data: null, error: null })
    expect(await createRepository(client).getMyProfile('u1')).toEqual({ profile: null, error: null })
  })
})

describe('listAllMovements', () => {
  // client ที่คืนผลต่างกันตามลำดับการเรียก (แต่ละ await ได้หน้าถัดไป)
  const pagedClient = (pages) => {
    const client = fakeClient(null)
    let call = 0
    const builder = client.from('stock_movements')
    client.calls.length = 0
    builder.then = (resolve, reject) => {
      const result = pages[Math.min(call, pages.length - 1)]
      call += 1
      return Promise.resolve(result).then(resolve, reject)
    }
    return client
  }

  it('ดึงทีละ EXPORT_PAGE_SIZE จนได้น้อยกว่าหนึ่งหน้า แล้วรวมกัน', async () => {
    const full = Array.from({ length: EXPORT_PAGE_SIZE }, () => movementRow)
    const client = pagedClient([
      { data: full, error: null },
      { data: [movementRow], error: null },
    ])
    const { movements, error } = await createRepository(client).listAllMovements({ productId: 'p1', type: 'out' })
    expect(error).toBeNull()
    expect(movements).toHaveLength(EXPORT_PAGE_SIZE + 1)
    const ranges = client.calls.filter(([m]) => m === 'range')
    expect(ranges).toEqual([
      ['range', 0, EXPORT_PAGE_SIZE - 1],
      ['range', EXPORT_PAGE_SIZE, 2 * EXPORT_PAGE_SIZE - 1],
    ])
    expect(client.calls).toContainEqual(['eq', 'product_id', 'p1'])
    expect(client.calls).toContainEqual(['eq', 'type', 'out'])
  })

  it('ผิดพลาดกลางทาง คืนรายการว่างและข้อความไทย', async () => {
    const full = Array.from({ length: EXPORT_PAGE_SIZE }, () => movementRow)
    const client = pagedClient([
      { data: full, error: null },
      { data: null, error: { code: 'PGRST301' } },
    ])
    expect(await createRepository(client).listAllMovements()).toEqual({
      movements: [],
      error: ERROR_MESSAGE.SESSION_EXPIRED,
    })
  })
})
