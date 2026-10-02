import { useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import {
  NO_LOCATION,
  STOCK_STATUS,
  countByStockStatus,
  filterProducts,
  listCategories,
  listLocations,
  listUnits,
  searchProducts,
  sortProducts,
} from '../lib/stockRules.js'
import { exportFileName, productSheet } from '../lib/spreadsheet.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'
import ProductTable from './ProductTable.jsx'
import RefreshIcon from './RefreshIcon.jsx'

const NO_FILTERS = {
  category: '',
  status: '',
  location: '',
  unit: '',
  repairOnly: false,
}
const DEFAULT_SORT = { key: 'status', dir: 'asc' }

// กดหัวคอลัมน์ครั้งแรก: ข้อความและสถานะเรียง ก → ฮ / หมด → ปกติ ตัวเลขเริ่มจากมาก → น้อย
const TEXT_KEYS = ['status', 'sku', 'name', 'category']
const firstDir = (key) => (TEXT_KEYS.includes(key) ? 'asc' : 'desc')

// กล่องสรุปที่กดเพื่อกรองได้
function StatButton({ label, count, tone, pressed, onClick }) {
  return (
    <button type="button" className={['panel stat stat-btn', tone].filter(Boolean).join(' ')} aria-pressed={pressed} onClick={onClick}>
      <span>{label}</span>
      <b>{count}</b>
    </button>
  )
}

// หน้าสินค้าคงคลัง: กล่องสรุป, ค้นหา, ตัวกรอง (หมวดหมู่ สถานะ ที่เก็บ หน่วย รอซ่อม), ตาราง (design.md ข้อ 7)
export default function ProductsPage({ products, imageUrls, loadState, loadError, onRetry, onMove }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const counts = countByStockStatus(products)
  const locations = listLocations(products)
  const units = listUnits(products)
  const visible = sortProducts(filterProducts(searchProducts(products, query), filters), sort.key, sort.dir)
  const filtered = query.trim() !== '' || Object.keys(NO_FILTERS).some((k) => filters[k] !== NO_FILTERS[k])

  // กดกล่องสถานะเดิมซ้ำ = กลับไปดูทั้งหมด
  const showStatus = (status) =>
    setFilters((current) => ({ ...current, status: current.status === status ? '' : status }))

  const setFilter = (key) => (e) => setFilters((current) => ({ ...current, [key]: e.target.value }))
  const sortBy = (key) =>
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir(key) },
    )

  return (
    <>
      <PageHead
        page={PAGE.PRODUCTS}
        actions={
          <div className="head-actions">
            <ExportButton
              fileName={exportFileName('products', toIsoDate(new Date()))}
              sheetName="สินค้าคงคลัง"
              buildSheet={() => ({ sheetData: productSheet(visible) })}
              disabled={loadState !== 'ready' || visible.length === 0}
            />
            <button type="button" className="btn btn-icon" onClick={onRetry} disabled={loadState === 'loading'}>
              <RefreshIcon />
              รีเฟรช
            </button>
          </div>
        }
      />

      {/* กดกล่องเพื่อกรองตามสถานะ กดซ้ำหรือกด "สินค้าทั้งหมด" เพื่อดูทั้งหมด */}
      <div className="stats">
        <StatButton label="สินค้าทั้งหมด" count={counts.total} pressed={filters.status === ''} onClick={() => showStatus('')} />
        <StatButton
          label="ใกล้หมด"
          count={counts[STOCK_STATUS.LOW]}
          tone="low"
          pressed={filters.status === STOCK_STATUS.LOW}
          onClick={() => showStatus(STOCK_STATUS.LOW)}
        />
        <StatButton
          label="หมด"
          count={counts[STOCK_STATUS.OUT]}
          tone="out"
          pressed={filters.status === STOCK_STATUS.OUT}
          onClick={() => showStatus(STOCK_STATUS.OUT)}
        />
      </div>

      <div className="panel">
        <div className="toolbar">
          <input
            type="search"
            className="grow"
            placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด"
            aria-label="ค้นหาสินค้า"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select aria-label="กรองหมวดหมู่" value={filters.category} onChange={setFilter('category')}>
            <option value="">ทุกหมวดหมู่</option>
            {listCategories(products).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select aria-label="กรองสถานะ" value={filters.status} onChange={setFilter('status')}>
            <option value="">ทุกสถานะ</option>
            <option value={STOCK_STATUS.OUT}>หมด</option>
            <option value={STOCK_STATUS.LOW}>ใกล้หมด</option>
            <option value={STOCK_STATUS.OK}>ปกติ</option>
          </select>
          {locations.length > 0 && (
            <select aria-label="กรองที่เก็บ" value={filters.location} onChange={setFilter('location')}>
              <option value="">ทุกที่เก็บ</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value={NO_LOCATION}>ยังไม่ระบุที่เก็บ</option>
            </select>
          )}
          {units.length > 1 && (
            <select aria-label="กรองหน่วย" value={filters.unit} onChange={setFilter('unit')}>
              <option value="">ทุกหน่วย</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="กรองสินค้ารอซ่อม"
            value={filters.repairOnly ? 'repair' : ''}
            onChange={(e) =>
              setFilters((current) => ({
                ...current,
                repairOnly: e.target.value === 'repair',
              }))
            }
          >
            <option value="">รอซ่อม: ทั้งหมด</option>
            <option value="repair">มีของรอซ่อม</option>
          </select>
          {filtered && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery('')
                setFilters(NO_FILTERS)
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {loadState === 'loading' && (
          <p className="empty" role="status">
            กำลังโหลดรายการสินค้า…
          </p>
        )}
        {loadState === 'error' && (
          <div className="empty">
            <p className="alert" role="alert">
              โหลดรายการสินค้าไม่สำเร็จ: {loadError}
            </p>
            <button type="button" className="btn primary" onClick={onRetry}>
              ลองใหม่
            </button>
          </div>
        )}
        {loadState === 'ready' && visible.length === 0 && (
          <p className="empty dim">{filtered ? 'ไม่พบสินค้าที่ตรงกับเงื่อนไข' : 'ยังไม่มีสินค้า'}</p>
        )}
        {loadState === 'ready' && visible.length > 0 && (
          <ProductTable products={visible} imageUrls={imageUrls} onMove={onMove} sort={sort} onSort={sortBy} />
        )}

        {loadState === 'ready' && (
          <div className="table-foot">
            แสดง {visible.length} จาก {products.length} รายการ · กดหัวคอลัมน์เพื่อเรียง
          </div>
        )}
      </div>
    </>
  )
}
