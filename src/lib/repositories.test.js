import { describe, expect, it } from 'vitest'
import { MOVEMENT_COLUMNS, PRODUCT_COLUMNS, PROFILE_COLUMNS } from './mappers.js'
import { EXPORT_PAGE_SIZE, IMPORT_BATCH_SIZE, PAGE_SIZE, UPDATE_BATCH_SIZE, createRepository } from './repositories.js'
import { REPAIR_FILTER } from './stockRules.js'
import { ERROR_MESSAGE } from './supabaseErrors.js'

// supabase client จำลอง: บันทึกทุกการเรียกในโซ่คำสั่ง แล้วคืนผลที่กำหนด
const fakeClient = (result) => {
  const calls = []
  const builder = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'in', 'is', 'order', 'range', 'single', 'maybeSingle']) {
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
      'addProductsToWarehouse',
      'getLogoUrl',
      'getMyProfile',
      'insertProducts',
      'listAllMovements',
      'listMonthlySales',
      'listMovements',
      'listProductWarehouses',
      'listProducts',
      'listWarehouseStock',
      'listWarehouses',
      'recordMovement',
      'removeProductImage',
      'removeProductsFromWarehouse',
      'saveProduct',
      'saveWarehouse',
      'setProductActive',
      'setProductsCategory',
      'setReorderPoints',
      'signImageUrls',
      'uploadLogo',
      'uploadProductImage',
      'upsertMonthlySales',
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
      ['order', 'id', { ascending: true }],
      ['range', 0, EXPORT_PAGE_SIZE - 1],
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
      ['insert', { sku: 'DR-002', barcode: null, name: 'โซดา', category: 'เครื่องดื่ม', unit: 'ขวด', reorder_point: 2, location: null }],
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

describe('setProductsCategory', () => {
  it('update หมวดหมู่ (ตัดช่องว่าง) ตาม id หลายรายการ', async () => {
    const client = fakeClient({ data: [{ id: 'p1' }, { id: 'p2' }], error: null })
    expect(await createRepository(client).setProductsCategory(['p1', 'p2'], ' เครื่องปั่น ')).toEqual({
      updated: 2,
      error: null,
    })
    expect(client.calls).toEqual([
      ['from', 'products'],
      ['update', { category: 'เครื่องปั่น' }],
      ['in', 'id', ['p1', 'p2']],
      ['select', 'id'],
    ])
  })

  it('แบ่งส่งทีละชุด', async () => {
    const ids = Array.from({ length: UPDATE_BATCH_SIZE + 1 }, (_, i) => `p${i}`)
    const client = fakeClient({ data: [], error: null })
    await createRepository(client).setProductsCategory(ids, 'x')
    // ชุดแรกได้ 0 แถว (ไม่ครบ) จึงหยุดทันที
    expect(client.calls.filter((c) => c[0] === 'in')).toHaveLength(1)
    expect(client.calls.find((c) => c[0] === 'in')[2]).toHaveLength(UPDATE_BATCH_SIZE)
  })

  it('บันทึกได้ไม่ครบ (RLS กรองแถวออก) คืนข้อความไม่มีสิทธิ์', async () => {
    const client = fakeClient({ data: [{ id: 'p1' }], error: null })
    expect(await createRepository(client).setProductsCategory(['p1', 'p2'], 'x')).toEqual({
      updated: 1,
      error: ERROR_MESSAGE.NOT_FOUND,
    })
  })
})

describe('setReorderPoints', () => {
  it('บันทึกครั้งเดียวต่อค่า', async () => {
    const client = fakeClient({ data: [{ id: 'x' }], error: null })
    const changes = [
      { id: 'a', reorderPoint: 3 },
      { id: 'b', reorderPoint: 8 },
    ]
    expect(await createRepository(client).setReorderPoints(changes)).toEqual({ updated: 2, error: null })
    expect(client.calls.filter((c) => c[0] === 'update')).toEqual([
      ['update', { reorder_point: 3 }],
      ['update', { reorder_point: 8 }],
    ])
  })

  it('ผิดพลาดหยุดทันที', async () => {
    const client = fakeClient({ data: null, error: { code: '42501' } })
    const { updated, error } = await createRepository(client).setReorderPoints([{ id: 'a', reorderPoint: 3 }])
    expect(updated).toBe(0)
    expect(error).toBeTruthy()
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
      {
        p_product_id: 'p1',
        p_type: 'in',
        p_quantity: 3,
        p_movement_date: '2026-09-29',
        p_note: null,
        p_warehouse_id: null,
      },
    ])
  })

  it('ส่งคลังย่อยเมื่อเลือก', async () => {
    const client = fakeClient({ data: movementRow, error: null })
    await createRepository(client).recordMovement({ ...outMovement, warehouseId: 'w1' })
    expect(client.calls[0][2]).toMatchObject({ p_warehouse_id: 'w1' })
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

describe('insertProducts', () => {
  const products = Array.from({ length: IMPORT_BATCH_SIZE + 1 }, (_, i) => ({ ...newProduct, sku: `SKU-${i}` }))

  it('insert เป็นชุดละ IMPORT_BATCH_SIZE เฉพาะคอลัมน์ที่ grant', async () => {
    const client = fakeClient({ data: null, error: null })
    expect(await createRepository(client).insertProducts(products)).toEqual({ inserted: IMPORT_BATCH_SIZE + 1, error: null })
    const inserts = client.calls.filter(([m]) => m === 'insert')
    expect(inserts.map(([, rows]) => rows.length)).toEqual([IMPORT_BATCH_SIZE, 1])
    expect(Object.keys(inserts[0][1][0]).sort()).toEqual(['barcode', 'category', 'location', 'name', 'reorder_point', 'sku', 'unit'])
    expect(client.calls.filter(([m]) => m === 'from').every(([, t]) => t === 'products')).toBe(true)
  })

  it('ชุดไหนผิดพลาด หยุดทันที และบอกว่าบันทึกไปแล้วกี่รายการ', async () => {
    let call = 0
    const client = fakeClient(null)
    const builder = client.from('products')
    client.calls.length = 0
    builder.then = (resolve, reject) => {
      const result = call === 0 ? { data: null, error: null } : { data: null, error: { code: '42501' } }
      call += 1
      return Promise.resolve(result).then(resolve, reject)
    }
    expect(await createRepository(client).insertProducts(products)).toEqual({
      inserted: IMPORT_BATCH_SIZE,
      error: ERROR_MESSAGE.FORBIDDEN,
    })
  })

  it('ไม่มีรายการ ไม่เรียกฐานข้อมูล', async () => {
    const client = fakeClient({ data: null, error: null })
    expect(await createRepository(client).insertProducts([])).toEqual({ inserted: 0, error: null })
    expect(client.calls).toEqual([])
  })
})

describe('listProducts หลายหน้า', () => {
  it('สินค้าเกิน 1000 รายการ (ขีดจำกัดต่อครั้งของ Supabase) ดึงต่อจนครบ', async () => {
    const full = Array.from({ length: EXPORT_PAGE_SIZE }, (_, i) => ({ ...productRow, id: `p${i}` }))
    let call = 0
    const client = fakeClient(null)
    const builder = client.from('product_stock')
    client.calls.length = 0
    builder.then = (resolve, reject) => {
      const result = call === 0 ? { data: full, error: null } : { data: [productRow], error: null }
      call += 1
      return Promise.resolve(result).then(resolve, reject)
    }
    const { products, error } = await createRepository(client).listProducts({ includeInactive: true })
    expect(error).toBeNull()
    expect(products).toHaveLength(EXPORT_PAGE_SIZE + 1)
    expect(client.calls.filter(([m]) => m === 'range')).toEqual([
      ['range', 0, EXPORT_PAGE_SIZE - 1],
      ['range', EXPORT_PAGE_SIZE, 2 * EXPORT_PAGE_SIZE - 1],
    ])
  })
})

// storage จำลอง: บันทึกการเรียก และคืนผลตามชื่อฟังก์ชัน
const withStorage = (client, results = {}) => {
  client.storage = {
    from: (bucket) => {
      const call = (name) => async (...args) => {
        client.calls.push(['storage', bucket, name, ...args])
        return results[name] ?? { data: null, error: null }
      }
      return {
        upload: call('upload'),
        remove: call('remove'),
        createSignedUrls: call('createSignedUrls'),
        createSignedUrl: call('createSignedUrl'),
      }
    },
  }
  return client
}

const storageCalls = (client) => client.calls.filter(([kind]) => kind === 'storage')

describe('โลโก้ร้าน', () => {
  it('ขอลิงก์โลโก้ ไม่มีไฟล์คืน null', async () => {
    const client = withStorage(fakeClient(), { createSignedUrl: { data: null, error: { message: 'Object not found' } } })
    expect(await createRepository(client).getLogoUrl()).toEqual({ url: null })
  })

  it('ขอลิงก์โลโก้สำเร็จ', async () => {
    const client = withStorage(fakeClient(), { createSignedUrl: { data: { signedUrl: 'https://x/logo' }, error: null } })
    expect(await createRepository(client).getLogoUrl()).toEqual({ url: 'https://x/logo' })
    expect(storageCalls(client)[0]).toEqual(['storage', 'product-images', 'createSignedUrl', 'branding/logo.jpg', 3600])
  })

  it('อัปโหลดโลโก้เขียนทับไฟล์เดิม', async () => {
    const client = withStorage(fakeClient())
    const blob = { size: 10, type: 'image/jpeg' }
    expect(await createRepository(client).uploadLogo(blob)).toEqual({ error: null })
    expect(storageCalls(client)[0]).toEqual([
      'storage',
      'product-images',
      'upload',
      'branding/logo.jpg',
      blob,
      { contentType: 'image/jpeg', upsert: true, cacheControl: '60' },
    ])
  })
})

describe('uploadProductImage', () => {
  const blob = { size: 1000, type: 'image/jpeg' }

  it('อัปโหลดไฟล์ใหม่ แล้วบันทึก image_path และลบรูปเก่า', async () => {
    const client = withStorage(fakeClient({ data: { id: 'p1' }, error: null }))
    const { imagePath, error } = await createRepository(client).uploadProductImage({ id: 'p1', imagePath: 'p1/old.jpg' }, blob)
    expect(error).toBeNull()
    expect(imagePath).toMatch(/^p1\/\d+\.jpg$/)
    const [upload, remove] = storageCalls(client)
    expect(upload).toEqual(['storage', 'product-images', 'upload', imagePath, blob, { contentType: 'image/jpeg', upsert: false }])
    expect(remove).toEqual(['storage', 'product-images', 'remove', ['p1/old.jpg']])
    expect(client.calls).toContainEqual(['update', { image_path: imagePath }])
    expect(client.calls).toContainEqual(['eq', 'id', 'p1'])
  })

  it('ไม่มีรูปเก่า ไม่เรียกลบ', async () => {
    const client = withStorage(fakeClient({ data: { id: 'p1' }, error: null }))
    await createRepository(client).uploadProductImage({ id: 'p1', imagePath: null }, blob)
    expect(storageCalls(client).map((c) => c[2])).toEqual(['upload'])
  })

  it('อัปโหลดไม่สำเร็จ ไม่แก้ตารางสินค้า', async () => {
    const client = withStorage(fakeClient({ data: { id: 'p1' }, error: null }), {
      upload: { data: null, error: { statusCode: '403', message: 'new row violates row-level security policy' } },
    })
    const result = await createRepository(client).uploadProductImage({ id: 'p1', imagePath: null }, blob)
    expect(result.imagePath).toBeNull()
    expect(result.error).toBeTruthy()
    expect(client.calls.map(([m]) => m)).not.toContain('update')
  })

  it('บันทึก image_path ไม่สำเร็จ ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง และไม่ลบรูปเก่า', async () => {
    const client = withStorage(fakeClient({ data: null, error: { code: '42501' } }))
    const result = await createRepository(client).uploadProductImage({ id: 'p1', imagePath: 'p1/old.jpg' }, blob)
    expect(result).toEqual({ imagePath: null, error: ERROR_MESSAGE.FORBIDDEN })
    const removes = storageCalls(client).filter((c) => c[2] === 'remove')
    expect(removes).toHaveLength(1)
    expect(removes[0][3][0]).not.toBe('p1/old.jpg')
  })
})

describe('removeProductImage', () => {
  it('ล้าง image_path แล้วลบไฟล์', async () => {
    const client = withStorage(fakeClient({ data: { id: 'p1' }, error: null }))
    expect(await createRepository(client).removeProductImage({ id: 'p1', imagePath: 'p1/a.jpg' })).toEqual({ error: null })
    expect(client.calls).toContainEqual(['update', { image_path: null }])
    expect(storageCalls(client)).toEqual([['storage', 'product-images', 'remove', ['p1/a.jpg']]])
  })

  it('ล้างไม่สำเร็จ ไม่ลบไฟล์', async () => {
    const client = withStorage(fakeClient({ data: null, error: { code: '42501' } }))
    expect(await createRepository(client).removeProductImage({ id: 'p1', imagePath: 'p1/a.jpg' })).toEqual({
      error: ERROR_MESSAGE.FORBIDDEN,
    })
    expect(storageCalls(client)).toEqual([])
  })
})

describe('signImageUrls', () => {
  it('ขอ signed URL ทีเดียวหลายรูป คืนเป็น { path: url }', async () => {
    const client = withStorage(fakeClient(null), {
      createSignedUrls: {
        data: [
          { path: 'p1/a.jpg', signedUrl: 'https://x/a', error: null },
          { path: 'p2/b.jpg', signedUrl: null, error: 'not found' },
        ],
        error: null,
      },
    })
    expect(await createRepository(client).signImageUrls(['p1/a.jpg', 'p2/b.jpg'])).toEqual({
      urls: { 'p1/a.jpg': 'https://x/a' },
      error: null,
    })
    expect(storageCalls(client)[0]).toEqual(['storage', 'product-images', 'createSignedUrls', ['p1/a.jpg', 'p2/b.jpg'], 3600])
  })

  it('ไม่มีรูป ไม่เรียก storage', async () => {
    const client = withStorage(fakeClient(null))
    expect(await createRepository(client).signImageUrls([])).toEqual({ urls: {}, error: null })
    expect(storageCalls(client)).toEqual([])
  })
})

describe('ยอดขายรายเดือน', () => {
  it('listMonthlySales แปลงแถวเป็นตัวเลข', async () => {
    const client = fakeClient({ data: [{ product_id: 'p1', year: 2026, month: '1', quantity: '205.00' }], error: null })
    expect(await createRepository(client).listMonthlySales()).toEqual({
      sales: [{ productId: 'p1', year: 2026, month: 1, quantity: 205 }],
      error: null,
    })
    expect(client.calls[0]).toEqual(['from', 'product_monthly_sales'])
  })

  it('upsertMonthlySales ทีละชุด แก้ทับตาม product_id, year, month', async () => {
    const client = fakeClient({ data: null, error: null })
    const sales = Array.from({ length: IMPORT_BATCH_SIZE + 1 }, (_, i) => ({ productId: `p${i}`, year: 2026, month: 1, quantity: 1 }))
    expect(await createRepository(client).upsertMonthlySales(sales)).toEqual({ saved: IMPORT_BATCH_SIZE + 1, error: null })
    const upserts = client.calls.filter(([m]) => m === 'upsert')
    expect(upserts.map(([, rows]) => rows.length)).toEqual([IMPORT_BATCH_SIZE, 1])
    expect(upserts[0][2]).toEqual({ onConflict: 'product_id,year,month' })
    expect(Object.keys(upserts[0][1][0]).sort()).toEqual(['month', 'product_id', 'quantity', 'updated_at', 'year'])
  })

  it('ผิดพลาด คืนข้อความไทยและจำนวนที่บันทึกแล้ว', async () => {
    const client = fakeClient({ data: null, error: { code: '42501' } })
    const { saved, error } = await createRepository(client).upsertMonthlySales([{ productId: 'p', year: 2026, month: 1, quantity: 1 }])
    expect(saved).toBe(0)
    expect(error).toBe(ERROR_MESSAGE.FORBIDDEN)
  })
})

describe('ตัวกรองรายการซ่อมทั้งหมด', () => {
  it('listMovements ใช้ in กับ 3 ประเภทการซ่อม', async () => {
    const client = fakeClient({ data: [], error: null })
    await createRepository(client).listMovements({ type: REPAIR_FILTER })
    expect(client.calls).toContainEqual(['in', 'type', ['to_repair', 'repaired', 'write_off']])
    expect(client.calls.some(([m, col]) => m === 'eq' && col === 'type')).toBe(false)
  })

  it('listAllMovements (ส่งออก) ใช้ตัวกรองเดียวกัน', async () => {
    const client = fakeClient({ data: [], error: null })
    await createRepository(client).listAllMovements({ type: REPAIR_FILTER })
    expect(client.calls).toContainEqual(['in', 'type', ['to_repair', 'repaired', 'write_off']])
  })
})

describe('คลังย่อย', () => {
  it('listWarehouses เรียงตามลำดับแล้วชื่อ', async () => {
    const client = fakeClient({ data: [{ id: 'w1', name: 'Online', sort_order: 1, active: true }], error: null })
    const { warehouses, error } = await createRepository(client).listWarehouses()
    expect(error).toBeNull()
    expect(warehouses).toEqual([{ id: 'w1', name: 'Online', sortOrder: 1, active: true }])
    expect(client.calls).toEqual([
      ['from', 'warehouses'],
      ['select', 'id, name, sort_order, active'],
      ['order', 'sort_order', { ascending: true }],
      ['order', 'name', { ascending: true }],
    ])
  })

  it('saveWarehouse: ไม่มี id เพิ่มใหม่, มี id แก้ไข', async () => {
    const client = fakeClient({ data: { id: 'w9' }, error: null })
    const repo = createRepository(client)
    expect(await repo.saveWarehouse({ name: ' หน้าร้าน ', sortOrder: 4 })).toEqual({ id: 'w9', error: null })
    expect(client.calls[1]).toEqual(['insert', { name: 'หน้าร้าน', sort_order: 4, active: true }])
    await repo.saveWarehouse({ id: 'w1', name: 'Online', sortOrder: 1, active: false })
    expect(client.calls).toContainEqual(['eq', 'id', 'w1'])
  })

  it('ชื่อคลังซ้ำ คืนข้อความไทย', async () => {
    const client = fakeClient({ data: null, error: { code: '23505', message: 'warehouses_name_unique' } })
    expect((await createRepository(client).saveWarehouse({ name: 'Online' })).error).toBe(
      ERROR_MESSAGE.DUPLICATE_WAREHOUSE,
    )
  })

  it('listProductWarehouses / listWarehouseStock แปลงเป็น camelCase', async () => {
    const links = fakeClient({ data: [{ product_id: 'p1', warehouse_id: 'w1' }], error: null })
    expect((await createRepository(links).listProductWarehouses()).links).toEqual([{ productId: 'p1', warehouseId: 'w1' }])
    const stock = fakeClient({ data: [{ warehouse_id: 'w1', product_id: 'p1', quantity: '2.00' }], error: null })
    expect((await createRepository(stock).listWarehouseStock()).stock).toEqual([
      { warehouseId: 'w1', productId: 'p1', quantity: 2 },
    ])
    expect(stock.calls[0]).toEqual(['from', 'warehouse_stock'])
  })

  it('addProductsToWarehouse ใช้ upsert ข้ามที่มีอยู่แล้ว', async () => {
    const client = fakeClient({ data: null, error: null })
    expect(await createRepository(client).addProductsToWarehouse(['p1', 'p2'], 'w1')).toEqual({ saved: 2, error: null })
    expect(client.calls[1]).toEqual([
      'upsert',
      [
        { product_id: 'p1', warehouse_id: 'w1' },
        { product_id: 'p2', warehouse_id: 'w1' },
      ],
      { onConflict: 'product_id,warehouse_id', ignoreDuplicates: true },
    ])
  })

  it('removeProductsFromWarehouse ลบเฉพาะคลังนั้น นับแถวที่ลบจริง', async () => {
    const client = fakeClient({ data: [{ product_id: 'p1' }], error: null })
    expect(await createRepository(client).removeProductsFromWarehouse(['p1', 'p2'], 'w1')).toEqual({
      removed: 1,
      error: null,
    })
    expect(client.calls).toEqual([
      ['from', 'product_warehouses'],
      ['delete'],
      ['eq', 'warehouse_id', 'w1'],
      ['in', 'product_id', ['p1', 'p2']],
      ['select', 'product_id'],
    ])
  })

  it('listMovements กรองคลังใหญ่ (warehouse_id is null) หรือคลังย่อย', async () => {
    const central = fakeClient({ data: [], error: null })
    await createRepository(central).listMovements({ warehouse: 'central' })
    expect(central.calls).toContainEqual(['is', 'warehouse_id', null])
    const online = fakeClient({ data: [], error: null })
    await createRepository(online).listAllMovements({ warehouse: 'w1' })
    expect(online.calls).toContainEqual(['eq', 'warehouse_id', 'w1'])
  })
})
