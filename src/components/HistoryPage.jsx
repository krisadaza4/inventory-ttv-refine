import { useEffect, useState } from 'react'
import { formatThaiDate, toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { PAGE_SIZE } from '../lib/repositories.js'
import { exportFileName, movementSheet } from '../lib/spreadsheet.js'
import { MOVEMENT_LABEL, MOVEMENT_TYPE, REPAIR_FILTER, TRANSFER_TYPES, signedQuantity } from '../lib/stockRules.js'
import { CENTRAL } from '../lib/warehouses.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'
import RefreshIcon from './RefreshIcon.jsx'

const TYPE_LABEL = MOVEMENT_LABEL

// ข้อความช่องคลัง: โอนแสดงทิศทาง, ขายผ่านคลังย่อยที่ตัดคลังใหญ่ด้วยแสดงส่วนที่ตัดแต่ละคลัง
function warehouseText(m) {
  const name = m.warehouseName || 'คลังย่อย'
  if (m.type === MOVEMENT_TYPE.TRANSFER_IN) return { main: `คลังใหญ่ → ${name}` }
  if (m.type === MOVEMENT_TYPE.TRANSFER_OUT) return { main: `${name} → คลังใหญ่` }
  if (!m.warehouseId) return { main: 'คลังใหญ่' }
  const fromCentral = Math.round((m.quantity - (m.warehouseQty ?? 0)) * 100) / 100
  return {
    main: name,
    detail:
      fromCentral > 0
        ? `ตัดคลังนี้ ${formatQuantity(m.warehouseQty ?? 0)} · คลังใหญ่ ${formatQuantity(fromCentral)}`
        : null,
  }
}

// หน้าประวัติการเคลื่อนไหว: ล่าสุดก่อน โหลดทีละ PAGE_SIZE กรองสินค้า/ประเภท/คลัง (design.md ข้อ 7)
// allProducts รวมที่ปิดใช้งาน เพื่อดูประวัติของสินค้าที่เลิกใช้แล้วได้ warehouses รวมคลังที่ปิดใช้งาน
export default function HistoryPage({ allProducts, warehouses = [], repository }) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('')
  // '' = ทุกคลัง, CENTRAL = คลังใหญ่, id = คลังย่อย
  const [warehouse, setWarehouse] = useState('')
  const [page, setPage] = useState(0)
  const [movements, setMovements] = useState([])
  const [hasMore, setHasMore] = useState(false)
  // 'loading' | 'ready' | 'error'
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // เปลี่ยนตัวกรองหรือหน้า: โหลดใหม่ ไม่ใช้ผลที่มาช้าหลังเปลี่ยนตัวกรองไปแล้ว
  useEffect(() => {
    let active = true
    repository.listMovements({ productId, type, warehouse, page }).then((result) => {
      if (!active) return
      if (result.error) {
        setLoadError(result.error)
        setLoadState('error')
        return
      }
      setMovements((current) => (page === 0 ? result.movements : [...current, ...result.movements]))
      setHasMore(result.hasMore)
      setLoadState('ready')
    })
    return () => {
      active = false
    }
  }, [repository, productId, type, warehouse, page, attempt])

  const changeFilter = (setter) => (e) => {
    setter(e.target.value)
    setPage(0)
    setMovements([])
    setLoadState('loading')
  }

  const loadMore = () => {
    setLoadState('loading')
    setPage((n) => n + 1)
  }

  const retry = () => {
    setLoadState('loading')
    setAttempt((n) => n + 1)
  }

  const refresh = () => {
    setPage(0)
    setMovements([])
    retry()
  }

  const products = allProducts.toSorted((a, b) => a.name.localeCompare(b.name, 'th'))

  return (
    <>
      <PageHead
        page={PAGE.HISTORY}
        actions={
          <div className="head-actions">
            <ExportButton
              fileName={exportFileName('movements', toIsoDate(new Date()))}
              sheetName="ประวัติการเคลื่อนไหว"
              buildSheet={async () => {
                const { movements: all, error } = await repository.listAllMovements({ productId, type, warehouse })
                return error ? { error } : { sheetData: movementSheet(all) }
              }}
              disabled={movements.length === 0}
            />
            <button type="button" className="btn btn-icon" onClick={refresh} disabled={loadState === 'loading'}>
              <RefreshIcon />
              รีเฟรช
            </button>
          </div>
        }
      />

      <div className="panel">
        <div className="toolbar">
          <select className="grow" aria-label="กรองสินค้า" value={productId} onChange={changeFilter(setProductId)}>
            <option value="">ทุกสินค้า</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
                {p.active ? '' : ' (ปิดใช้งาน)'}
              </option>
            ))}
          </select>
          <select aria-label="กรองประเภท" value={type} onChange={changeFilter(setType)}>
            <option value="">ทุกประเภท</option>
            <option value={REPAIR_FILTER}>รายการซ่อมทั้งหมด</option>
            {Object.values(MOVEMENT_TYPE).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          {warehouses.length > 0 && (
            <select aria-label="กรองคลัง" value={warehouse} onChange={changeFilter(setWarehouse)}>
              <option value="">ทุกคลัง</option>
              <option value={CENTRAL}>คลังใหญ่</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.active ? '' : ' (ปิดใช้งาน)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {movements.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>สินค้า</th>
                  <th className="hide-sm">ประเภท</th>
                  <th className="hide-sm">คลัง</th>
                  <th className="num">จำนวน</th>
                  <th className="hide-sm">ผู้บันทึก</th>
                  <th className="hide-sm">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const amount = signedQuantity(m.type, m.quantity)
                  // โอนระหว่างคลังไม่เปลี่ยนยอดรวม: แสดงจำนวนไม่มีเครื่องหมาย
                  const transfer = TRANSFER_TYPES.includes(m.type)
                  const where = warehouseText(m)
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">{formatThaiDate(m.movementDate)}</td>
                      <td>
                        {m.productName}
                        <div className="sub mono">{m.productSku}</div>
                        <div className="sub show-sm">
                          {TYPE_LABEL[m.type]} · {where.main} · {m.recordedByName}
                        </div>
                      </td>
                      <td className="hide-sm">{TYPE_LABEL[m.type]}</td>
                      <td className="hide-sm">
                        {where.main}
                        {where.detail && <div className="sub">{where.detail}</div>}
                      </td>
                      <td className={`num nowrap ${transfer ? '' : amount < 0 ? 'minus' : 'plus'}`}>
                        {transfer ? `⇄ ${formatQuantity(amount)}` : formatQuantity(amount, { signed: true })} {m.unit}
                      </td>
                      <td className="hide-sm">{m.recordedByName}</td>
                      <td className="hide-sm dim">{m.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {loadState === 'loading' && (
          <p className="empty" role="status">
            กำลังโหลดประวัติ…
          </p>
        )}
        {loadState === 'error' && (
          <div className="empty">
            <p className="alert" role="alert">
              โหลดประวัติไม่สำเร็จ: {loadError}
            </p>
            <button type="button" className="btn primary" onClick={retry}>
              ลองใหม่
            </button>
          </div>
        )}
        {loadState === 'ready' && movements.length === 0 && (
          <p className="empty dim">{productId || type || warehouse ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการเคลื่อนไหว'}</p>
        )}

        {movements.length > 0 && (
          <div className="table-foot spread">
            <span>
              แสดงล่าสุด {movements.length} รายการ (ทีละ {PAGE_SIZE})
            </span>
            {hasMore && loadState === 'ready' && (
              <button type="button" className="btn sm" onClick={loadMore}>
                โหลดเพิ่ม
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
