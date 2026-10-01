import { useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import {
  STOCK_STATUS,
  countByStockStatus,
  filterByCategory,
  listCategories,
  searchProducts,
  sortByStockStatus,
} from '../lib/stockRules.js'
import { exportFileName, productSheet } from '../lib/spreadsheet.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'
import ProductTable from './ProductTable.jsx'
import RefreshIcon from './RefreshIcon.jsx'

// หน้าสินค้าคงคลัง: กล่องสรุป, ค้นหา, กรองหมวดหมู่, ตาราง (design.md ข้อ 7)
export default function ProductsPage({ products, imageUrls, loadState, loadError, onRetry, onMove }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const counts = countByStockStatus(products)
  const visible = sortByStockStatus(filterByCategory(searchProducts(products, query), category))
  const filtered = query.trim() !== '' || category !== ''

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

      <div className="stats">
        <div className="panel stat">
          <span>สินค้าทั้งหมด</span>
          <b>{counts.total}</b>
        </div>
        <div className="panel stat low">
          <span>ใกล้หมด</span>
          <b>{counts[STOCK_STATUS.LOW]}</b>
        </div>
        <div className="panel stat out">
          <span>หมด</span>
          <b>{counts[STOCK_STATUS.OUT]}</b>
        </div>
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
          <select aria-label="กรองหมวดหมู่" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {listCategories(products).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        {loadState === 'ready' && visible.length > 0 && <ProductTable products={visible} imageUrls={imageUrls} onMove={onMove} />}

        {loadState === 'ready' && (
          <div className="table-foot">
            แสดง {visible.length} จาก {products.length} รายการ เรียงตาม หมด → ใกล้หมด → ปกติ
          </div>
        )}
      </div>
    </>
  )
}
