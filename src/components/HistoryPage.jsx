import { useEffect, useState } from 'react'
import { bangkokParts, formatThaiDate, formatThaiDateTime, toIsoDate } from '../lib/dateFormat.js'
import { DATE_PRESETS, matchPreset, normalizeRange, presetRange, rangeFileSuffix } from '../lib/dateRange.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { PAGE_SIZE } from '../lib/repositories.js'
import { exportFileName, movementSheet } from '../lib/spreadsheet.js'
import { LEGACY_TRANSFER_TYPES, MOVEMENT_LABEL, MOVEMENT_TYPE, REPAIR_FILTER, signedQuantity } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'
import PageHead from './PageHead.jsx'
import RefreshIcon from './RefreshIcon.jsx'

const TYPE_LABEL = MOVEMENT_LABEL

// หน้าประวัติการเคลื่อนไหว: ล่าสุดก่อน โหลดทีละ PAGE_SIZE กรองสินค้า/ประเภท/ช่วงวันที่ (design.md ข้อ 7)
// ส่งออก Excel ใช้ตัวกรองเดียวกันทั้งหมด
// allProducts รวมที่ปิดใช้งาน เพื่อดูประวัติของสินค้าที่เลิกใช้แล้วได้
export default function HistoryPage({ allProducts, repository }) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('')
  // ช่วงวันที่ของรายการ ('YYYY-MM-DD' ว่าง = ไม่จำกัด)
  const [range, setRange] = useState({ from: '', to: '' })
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
    repository.listMovements({ productId, type, dateFrom: range.from, dateTo: range.to, page }).then((result) => {
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
  }, [repository, productId, type, range, page, attempt])

  const resetList = () => {
    setPage(0)
    setMovements([])
    setLoadState('loading')
  }

  const changeFilter = (setter) => (e) => {
    setter(e.target.value)
    resetList()
  }

  const changeRange = (next) => {
    const normalized = normalizeRange(next)
    if (normalized.from === range.from && normalized.to === range.to) return
    setRange(normalized)
    resetList()
  }

  const today = toIsoDate(new Date())
  const activePreset = matchPreset(range, today)
  const filtered = Boolean(productId || type || range.from || range.to)

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
              fileName={exportFileName(`movements${rangeFileSuffix(range)}`, today)}
              sheetName="ประวัติการเคลื่อนไหว"
              buildSheet={async () => {
                const { movements: all, error } = await repository.listAllMovements({
                  productId,
                  type,
                  dateFrom: range.from,
                  dateTo: range.to,
                })
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
        </div>
        <div className="toolbar date-range" role="group" aria-label="ช่วงวันที่">
          <label className="date-field">
            <span>ตั้งแต่</span>
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => changeRange({ ...range, from: e.target.value })}
            />
          </label>
          <label className="date-field">
            <span>ถึง</span>
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => changeRange({ ...range, to: e.target.value })}
            />
          </label>
          <div className="view-tabs" role="group" aria-label="ช่วงวันที่ลัด">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn sm"
                aria-pressed={activePreset === p.id}
                onClick={() => changeRange(presetRange(p.id, today))}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="btn sm"
              aria-pressed={!range.from && !range.to}
              onClick={() => changeRange({ from: '', to: '' })}
            >
              ทุกวันที่
            </button>
          </div>
        </div>

        {movements.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วันที่ / เวลา</th>
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
                  // รายการโอนเก่า (คลังย่อยเลิกใช้) ไม่เปลี่ยนยอดรวม: แสดงจำนวนไม่มีเครื่องหมาย
                  const transfer = LEGACY_TRANSFER_TYPES.includes(m.type)
                  // เวลาที่กดบันทึกจริง (เวลาไทย) ถ้าบันทึกย้อนหลังคนละวัน แสดงวันเวลาที่บันทึกเต็ม
                  const recorded = bangkokParts(m.createdAt)
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">
                        {formatThaiDate(m.movementDate)}
                        {recorded && (
                          <div className="sub">
                            {recorded.date === m.movementDate
                              ? `${recorded.time} น.`
                              : `บันทึก ${formatThaiDateTime(m.createdAt)} น.`}
                          </div>
                        )}
                      </td>
                      <td>
                        {m.productName}
                        <div className="sub mono">{m.productSku}</div>
                        <div className="sub show-sm">
                          {TYPE_LABEL[m.type]} · {m.recordedByName}
                        </div>
                      </td>
                      <td className="hide-sm">{TYPE_LABEL[m.type]}</td>
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
          <p className="empty dim">{filtered ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการเคลื่อนไหว'}</p>
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
