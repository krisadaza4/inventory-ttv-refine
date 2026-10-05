import { useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import {
  MOVEMENT_TYPE,
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
import { exportFileName, productSheet, warehouseSheet } from '../lib/spreadsheet.js'
import { productsInWarehouse } from '../lib/warehouses.js'
import BulkTransferPanel from './BulkTransferPanel.jsx'
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
  // คลังย่อย: เฉพาะรายการที่มีของอยู่ในคลังนี้
  inWarehouseOnly: false,
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
// warehouse = null คือคลังใหญ่ (สินค้าทั้งหมด) หรือคลังย่อยที่เลือก (เฉพาะสินค้าในคลังนั้น)
// มือถือไม่มีเมนูคลังย่อย จึงมีแถบเลือกคลังด้านบน
export default function ProductsPage({
  warehouse = null,
  warehouses = [],
  onPickWarehouse,
  products: allActive,
  imageUrls,
  loadState,
  loadError,
  onRetry,
  onMove,
  role,
  today,
  repository,
}) {
  const [query, setQuery] = useState('')
  // แผงบันทึกหลายรายการ: คลังใหญ่ = รับเข้า, คลังย่อย = โอนเข้า
  const [bulkOpen, setBulkOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)

  // คลังย่อย: สถานะ/เรียง/กรองใช้ยอด "ขายได้" จึงใส่ไว้ที่ onHand ของแถว
  const products = warehouse
    ? productsInWarehouse(allActive, warehouse.id).map((p) => ({ ...p, onHand: p.sellable }))
    : allActive

  const counts = countByStockStatus(products)
  const locations = listLocations(products)
  const units = listUnits(products)
  // คลังย่อยแสดงสินค้าที่ผูกไว้ทั้งหมด (ขายได้จากคลังใหญ่) แต่กล่องแรกนับเฉพาะที่มีของอยู่ในคลังนี้จริง
  const inWarehouseCount = warehouse ? products.filter((p) => p.inWarehouse > 0).length : 0
  const visible = sortProducts(
    filterProducts(searchProducts(products, query), filters).filter((p) => !filters.inWarehouseOnly || p.inWarehouse > 0),
    sort.key,
    sort.dir,
  )
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
        title={warehouse ? `คลัง ${warehouse.name}` : undefined}
        actions={
          <div className="head-actions">
            {repository && (
              <button
                type="button"
                className="btn btn-in"
                onClick={() => {
                  setBulkOpen(true)
                  setNotice(null)
                }}
                disabled={bulkOpen || loadState !== 'ready'}
              >
                {warehouse ? (
                  <>
                    <span aria-hidden="true">⇢</span> โอนเข้าหลายรายการ
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">＋</span> รับเข้าหลายรายการ
                  </>
                )}
              </button>
            )}
            <ExportButton
              fileName={exportFileName(warehouse ? `warehouse-${warehouse.name}` : 'products', toIsoDate(new Date()))}
              sheetName={warehouse ? `คลัง ${warehouse.name}` : 'สินค้าคงคลัง'}
              buildSheet={() => ({ sheetData: warehouse ? warehouseSheet(visible) : productSheet(visible) })}
              disabled={loadState !== 'ready' || visible.length === 0}
            />
            <button type="button" className="btn btn-icon" onClick={onRetry} disabled={loadState === 'loading'}>
              <RefreshIcon />
              รีเฟรช
            </button>
          </div>
        }
      />

      {warehouses.length > 0 && (
        <div className="wh-tabs" role="group" aria-label="เลือกคลัง">
          <button type="button" className="btn sm" aria-pressed={!warehouse} onClick={() => onPickWarehouse('')}>
            คลังใหญ่
          </button>
          {warehouses.map((w) => (
            <button
              key={w.id}
              type="button"
              className="btn sm"
              aria-pressed={warehouse?.id === w.id}
              onClick={() => onPickWarehouse(w.id)}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {bulkOpen && (
        <BulkTransferPanel
          type={warehouse ? MOVEMENT_TYPE.TRANSFER_IN : MOVEMENT_TYPE.IN}
          warehouse={warehouse}
          products={allActive}
          imageUrls={imageUrls}
          role={role}
          today={today}
          repository={repository}
          onSaved={(message) => {
            // message = null คือบันทึกได้บางส่วน (ข้อความผิดพลาดแสดงในแผง) แผงยังเปิดอยู่
            if (message) {
              setNotice(message)
              setBulkOpen(false)
            }
            onRetry()
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {warehouse && (
        <p className="hint wh-hint">
          ขายได้ = ของในคลังนี้ + คลังใหญ่ · ขายแล้วตัดของในคลังนี้ก่อน ไม่พอจึงตัดคลังใหญ่ · ของในคลังนี้คลังอื่นขายไม่ได้
        </p>
      )}

      {/* กดกล่องเพื่อกรองตามสถานะ กดซ้ำหรือกด "สินค้าทั้งหมด" เพื่อดูทั้งหมด */}
      <div className="stats">
        {warehouse ? (
          <StatButton
            label="มีของในคลังนี้"
            count={inWarehouseCount}
            pressed={filters.inWarehouseOnly}
            onClick={() => setFilters((current) => ({ ...current, inWarehouseOnly: !current.inWarehouseOnly }))}
          />
        ) : (
          <StatButton label="สินค้าทั้งหมด" count={counts.total} pressed={filters.status === ''} onClick={() => showStatus('')} />
        )}
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
          <p className="empty dim">
            {filtered
              ? 'ไม่พบสินค้าที่ตรงกับเงื่อนไข'
              : warehouse
                ? 'ยังไม่มีสินค้าในคลังนี้ (กด "โอนเข้าหลายรายการ" ด้านบน หรือตั้ง "แสดงในคลัง" ที่หน้าจัดการสินค้า)'
                : 'ยังไม่มีสินค้า'}
          </p>
        )}
        {loadState === 'ready' && visible.length > 0 && (
          <ProductTable
            products={visible}
            imageUrls={imageUrls}
            onMove={onMove}
            sort={sort}
            onSort={sortBy}
            warehouse={warehouse}
          />
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
