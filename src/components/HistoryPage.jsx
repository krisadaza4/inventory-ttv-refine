import { useEffect, useState } from 'react'
import { formatThaiDate, toIsoDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { PAGE_SIZE } from '../lib/repositories.js'
import { exportFileName, movementSheet } from '../lib/spreadsheet.js'
import { MOVEMENT_LABEL, MOVEMENT_TYPE, signedQuantity } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'

const TYPE_LABEL = MOVEMENT_LABEL

// หน้าประวัติการเคลื่อนไหว: ล่าสุดก่อน โหลดทีละ PAGE_SIZE กรองสินค้า/ประเภท (design.md ข้อ 7)
// allProducts รวมที่ปิดใช้งาน เพื่อดูประวัติของสินค้าที่เลิกใช้แล้วได้
export default function HistoryPage({ allProducts, repository }) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('')
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
    repository.listMovements({ productId, type, page }).then((result) => {
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
  }, [repository, productId, type, page, attempt])

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
                const { movements: all, error } = await repository.listAllMovements({ productId, type })
                return error ? { error } : { sheetData: movementSheet(all) }
              }}
              disabled={movements.length === 0}
            />
            <button type="button" className="btn" onClick={refresh} disabled={loadState === 'loading'}>
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
            {Object.values(MOVEMENT_TYPE).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        {movements.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>สินค้า</th>
                  <th className="hide-sm">ประเภท</th>
                  <th className="num">จำนวน</th>
                  <th className="hide-sm">ผู้บันทึก</th>
                  <th className="hide-sm">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const amount = signedQuantity(m.type, m.quantity)
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">{formatThaiDate(m.movementDate)}</td>
                      <td>
                        {m.productName}
                        <div className="sub mono">{m.productSku}</div>
                        <div className="sub show-sm">
                          {TYPE_LABEL[m.type]} · {m.recordedByName}
                        </div>
                      </td>
                      <td className="hide-sm">{TYPE_LABEL[m.type]}</td>
                      <td className={`num nowrap ${amount < 0 ? 'minus' : 'plus'}`}>
                        {formatQuantity(amount, { signed: true })} {m.unit}
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
          <p className="empty dim">{productId || type ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการเคลื่อนไหว'}</p>
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
