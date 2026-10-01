import { useEffect, useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { MONTH_LABELS, buildSalesRows, salesYears, sortSalesRows, toBuddhistYear } from '../lib/monthlySales.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { monthlySalesSheet } from '../lib/spreadsheet.js'
import { searchProducts } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'
import ProductThumb from './ProductThumb.jsx'
import RefreshIcon from './RefreshIcon.jsx'

// คลิกหัวคอลัมน์เพื่อเรียง: ตัวเลขเริ่มจากมาก → น้อย รหัสเริ่มจาก ก → ฮ
const firstDir = (key) => (key === 'sku' ? 'asc' : 'desc')

// หัวคอลัมน์ที่กดเรียงได้
function SortHead({ sortKey, sort, onSort, children, className }) {
  const active = sort.key === sortKey
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="sort-head" onClick={() => onSort(sortKey)}>
        {children}
        <span aria-hidden="true">{active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  )
}

// หน้ายอดขายรายเดือน: ตาราง สินค้า × 12 เดือน ค่าจากไฟล์สต็อกของร้าน (นำเข้าในหน้าจัดการสินค้า)
export default function MonthlySalesPage({ allProducts, imageUrls, loadState, repository }) {
  const [sales, setSales] = useState([])
  // 'loading' | 'ready' | 'error'
  const [salesState, setSalesState] = useState('loading')
  const [salesError, setSalesError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [year, setYear] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' })

  useEffect(() => {
    let active = true
    repository.listMonthlySales().then(({ sales: loaded, error }) => {
      if (!active) return
      if (error) {
        setSalesError(error)
        setSalesState('error')
      } else {
        setSales(loaded)
        setSalesState('ready')
      }
    })
    return () => {
      active = false
    }
  }, [repository, attempt])

  const years = salesYears(sales)
  const shownYear = years.includes(year) ? year : (years[0] ?? null)
  // ตารางนี้แสดงสินค้าที่ปิดใช้งานด้วย (ยอดขายในอดีตยังมีความหมาย)
  const rows = shownYear === null ? [] : buildSalesRows(searchProducts(allProducts, query), sales, shownYear)
  const visible = sortSalesRows(rows, sort.key, sort.dir)
  const ready = salesState === 'ready' && loadState === 'ready'

  const sortBy = (key) =>
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir(key) },
    )

  return (
    <>
      <PageHead
        page={PAGE.SALES}
        actions={
          <div className="head-actions">
            <ExportButton
              fileName={`inventory-sales-${shownYear ? toBuddhistYear(shownYear) : ''}-${toIsoDate(new Date())}.xlsx`}
              sheetName={`ยอดขาย ${shownYear ? toBuddhistYear(shownYear) : ''}`}
              buildSheet={() => ({ sheetData: monthlySalesSheet(visible) })}
              disabled={!ready || visible.length === 0}
            />
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => {
                setSalesState('loading')
                setAttempt((n) => n + 1)
              }}
              disabled={salesState === 'loading'}
            >
              <RefreshIcon />
              รีเฟรช
            </button>
          </div>
        }
      />

      <div className="panel">
        <div className="toolbar">
          <input
            type="search"
            className="grow"
            placeholder="ค้นหาชื่อ / รหัส"
            aria-label="ค้นหาสินค้า"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="เลือกปี"
            value={shownYear ?? ''}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={years.length === 0}
          >
            {years.length === 0 && <option value="">ไม่มีข้อมูล</option>}
            {years.map((y) => (
              <option key={y} value={y}>
                ปี {toBuddhistYear(y)}
              </option>
            ))}
          </select>
        </div>

        {(salesState === 'loading' || loadState === 'loading') && (
          <p className="empty" role="status">
            กำลังโหลดยอดขาย…
          </p>
        )}
        {salesState === 'error' && (
          <p className="empty alert" role="alert">
            โหลดยอดขายไม่สำเร็จ: {salesError}
          </p>
        )}
        {ready && years.length === 0 && (
          <p className="empty dim">ยังไม่มียอดขาย นำเข้าไฟล์สต็อกได้ที่หน้าจัดการสินค้า (ปุ่ม "นำเข้าไฟล์สต็อก")</p>
        )}
        {ready && years.length > 0 && visible.length === 0 && <p className="empty dim">ไม่พบสินค้า</p>}

        {ready && visible.length > 0 && (
          <div className="table-wrap sales-wrap">
            <table className="sales-table">
              <thead>
                <tr>
                  <th className="thumb-col">รูป</th>
                  <SortHead sortKey="sku" sort={sort} onSort={sortBy}>รหัส</SortHead>
                  {MONTH_LABELS.map((label, i) => (
                    <SortHead key={label} sortKey={`m${i + 1}`} sort={sort} onSort={sortBy} className="num">
                      {label}
                    </SortHead>
                  ))}
                  <SortHead sortKey="total" sort={sort} onSort={sortBy} className="num">
                    รวม
                  </SortHead>
                  <SortHead sortKey="average" sort={sort} onSort={sortBy} className="num">
                    เฉลี่ย/เดือน
                  </SortHead>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.product.id}>
                    <td className="thumb-col">
                      <ProductThumb url={imageUrls[r.product.imagePath]} name={r.product.name} size="row" />
                    </td>
                    <td>
                      {/* --len: CSS ลดขนาดอักษรเฉพาะรหัสที่ยาวเกินช่อง */}
                      <span className="mono sku-fit" style={{ '--len': r.product.sku.length }}>
                        {r.product.sku}
                      </span>
                      {r.product.name !== r.product.sku && <div className="sub">{r.product.name}</div>}
                    </td>
                    {r.months.map((q, i) => (
                      <td key={i} className="num">
                        {q === null ? <span className="dim">–</span> : formatQuantity(q)}
                      </td>
                    ))}
                    <td className="num">
                      <b>{formatQuantity(r.total)}</b>
                    </td>
                    <td className="num">{formatQuantity(r.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-foot">
              {visible.length} รายการ · ปี {toBuddhistYear(shownYear)} · เฉลี่ย/เดือน = รวม ÷ 12 ตามไฟล์ของร้าน
            </div>
          </div>
        )}
      </div>
    </>
  )
}
