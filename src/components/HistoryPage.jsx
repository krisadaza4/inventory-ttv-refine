import { useEffect, useState } from 'react'
import { bangkokParts, formatThaiDate, formatThaiDateTime, toIsoDate } from '../lib/dateFormat.js'
import { DATE_PRESETS, matchPreset, normalizeRange, presetRange, rangeFileSuffix } from '../lib/dateRange.js'
import { PERIOD_FILTERS, PERIOD_LABEL, filterByPeriod, periodOf } from '../lib/dayPeriod.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { PAGE_SIZE } from '../lib/repositories.js'
import { exportFileName, movementSheet } from '../lib/spreadsheet.js'
import { LEGACY_TRANSFER_TYPES, MOVEMENT_LABEL, MOVEMENT_TYPE, REPAIR_FILTER, signedQuantity } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'
import IssueSummary from './IssueSummary.jsx'
import PageHead from './PageHead.jsx'
import RefreshIcon from './RefreshIcon.jsx'
import ThaiDateInput from './ThaiDateInput.jsx'

const TYPE_LABEL = MOVEMENT_LABEL

const VIEW = { LIST: 'list', SUMMARY: 'summary' }

// หน้าประวัติการเคลื่อนไหว: ล่าสุดก่อน โหลดทีละ PAGE_SIZE กรองสินค้า/ประเภท/ช่วงวันที่ (design.md ข้อ 7)
// ส่งออก Excel ใช้ตัวกรองเดียวกันทั้งหมด
// ช่วงเช้า/บ่าย (เวลาที่กดบันทึก) กรองฝั่งแอป เพราะฐานข้อมูลกรองตามเวลาในวันไม่ได้: เลือกช่วงแล้วโหลดทั้งหมดตามตัวกรอง
// แท็บ "สรุปการเบิก": รวมเบิกออกต่อสินค้า เช้า / บ่าย (IssueSummary) ใช้สินค้าและช่วงวันที่เดียวกัน
// allProducts รวมที่ปิดใช้งาน เพื่อดูประวัติของสินค้าที่เลิกใช้แล้วได้
export default function HistoryPage({ allProducts, repository }) {
  const [productId, setProductId] = useState('')
  const [type, setType] = useState('')
  // ช่วงวันที่ของรายการ ('YYYY-MM-DD' ว่าง = ไม่จำกัด)
  const [range, setRange] = useState({ from: '', to: '' })
  // '' = ทั้งวัน | 'morning' | 'afternoon'
  const [period, setPeriod] = useState('')
  const [view, setView] = useState(VIEW.LIST)
  const [page, setPage] = useState(0)
  const [movements, setMovements] = useState([])
  const [hasMore, setHasMore] = useState(false)
  // 'loading' | 'ready' | 'error'
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // เปลี่ยนตัวกรองหรือหน้า: โหลดใหม่ ไม่ใช้ผลที่มาช้าหลังเปลี่ยนตัวกรองไปแล้ว
  useEffect(() => {
    if (view !== VIEW.LIST) return undefined
    let active = true
    const filters = { productId, type, dateFrom: range.from, dateTo: range.to }
    const load = period
      ? repository
          .listAllMovements(filters)
          .then((r) => ({ ...r, movements: filterByPeriod(r.movements, period), hasMore: false }))
      : repository.listMovements({ ...filters, page })
    load.then((result) => {
      if (!active) return
      if (result.error) {
        setLoadError(result.error)
        setLoadState('error')
        return
      }
      setMovements((current) => (page === 0 || period ? result.movements : [...current, ...result.movements]))
      setHasMore(result.hasMore)
      setLoadState('ready')
    })
    return () => {
      active = false
    }
  }, [repository, productId, type, range, period, view, page, attempt])

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
  const filtered = Boolean(productId || type || range.from || range.to || period)

  const changePeriod = (next) => {
    if (next === period) return
    setPeriod(next)
    resetList()
  }

  const changeView = (next) => {
    if (next === view) return
    setView(next)
    if (next === VIEW.LIST) resetList()
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
            {view === VIEW.LIST && (
              <ExportButton
                fileName={exportFileName(
                  `movements${rangeFileSuffix(range)}${period ? `_${period}` : ''}`,
                  today,
                )}
                sheetName="ประวัติการเคลื่อนไหว"
                buildSheet={async () => {
                  const { movements: all, error } = await repository.listAllMovements({
                    productId,
                    type,
                    dateFrom: range.from,
                    dateTo: range.to,
                  })
                  return error ? { error } : { sheetData: movementSheet(filterByPeriod(all, period)) }
                }}
                disabled={movements.length === 0}
              />
            )}
            <button
              type="button"
              className="btn btn-icon"
              onClick={refresh}
              disabled={view === VIEW.LIST && loadState === 'loading'}
            >
              <RefreshIcon />
              รีเฟรช
            </button>
          </div>
        }
      />

      <div className="panel">
        <div className="toolbar">
          <div className="view-tabs" role="group" aria-label="มุมมอง">
            <button
              type="button"
              className="btn sm"
              aria-pressed={view === VIEW.LIST}
              onClick={() => changeView(VIEW.LIST)}
            >
              รายการเคลื่อนไหว
            </button>
            <button
              type="button"
              className="btn sm"
              aria-pressed={view === VIEW.SUMMARY}
              onClick={() => changeView(VIEW.SUMMARY)}
            >
              สรุปการเบิก เช้า-บ่าย
            </button>
          </div>
        </div>
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
          {view === VIEW.LIST && (
            <select aria-label="กรองประเภท" value={type} onChange={changeFilter(setType)}>
              <option value="">ทุกประเภท</option>
              <option value={REPAIR_FILTER}>รายการซ่อมทั้งหมด</option>
              {Object.values(MOVEMENT_TYPE).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="toolbar date-range" role="group" aria-label="ช่วงวันที่">
          <div className="date-field">
            <span>ตั้งแต่</span>
            <ThaiDateInput
              ariaLabel="ตั้งแต่วันที่"
              placeholder="ไม่จำกัด"
              clearable
              value={range.from}
              max={range.to || undefined}
              onChange={(from) => changeRange({ ...range, from })}
            />
          </div>
          <div className="date-field">
            <span>ถึง</span>
            <ThaiDateInput
              ariaLabel="ถึงวันที่"
              placeholder="ไม่จำกัด"
              clearable
              value={range.to}
              min={range.from || undefined}
              onChange={(to) => changeRange({ ...range, to })}
            />
          </div>
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
              ไม่กรองวันที่
            </button>
          </div>
          {view === VIEW.LIST && (
            <div className="view-tabs" role="group" aria-label="ช่วงเวลา">
              {PERIOD_FILTERS.map((p) => (
                <button
                  key={p.value || 'all'}
                  type="button"
                  className="btn sm"
                  aria-pressed={period === p.value}
                  onClick={() => changePeriod(p.value)}
                  title={p.value ? 'ตามเวลาที่กดบันทึก: เช้า = ก่อน 12:00 บ่าย = ตั้งแต่ 12:00' : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {view === VIEW.SUMMARY && (
          <IssueSummary repository={repository} productId={productId} range={range} attempt={attempt} />
        )}

        {view === VIEW.LIST && movements.length > 0 && (
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
                  const periodLabel = PERIOD_LABEL[periodOf(m.createdAt)]
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">
                        {formatThaiDate(m.movementDate)}
                        {recorded && (
                          <div className="sub">
                            {recorded.date === m.movementDate
                              ? `${recorded.time} น.`
                              : `บันทึก ${formatThaiDateTime(m.createdAt)} น.`}
                            {periodLabel && ` · ${periodLabel}`}
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

        {view === VIEW.LIST && loadState === 'loading' && (
          <p className="empty" role="status">
            กำลังโหลดประวัติ…
          </p>
        )}
        {view === VIEW.LIST && loadState === 'error' && (
          <div className="empty">
            <p className="alert" role="alert">
              โหลดประวัติไม่สำเร็จ: {loadError}
            </p>
            <button type="button" className="btn primary" onClick={retry}>
              ลองใหม่
            </button>
          </div>
        )}
        {view === VIEW.LIST && loadState === 'ready' && movements.length === 0 && (
          <p className="empty dim">{filtered ? 'ไม่พบรายการที่ตรงกับเงื่อนไข' : 'ยังไม่มีรายการเคลื่อนไหว'}</p>
        )}

        {view === VIEW.LIST && movements.length > 0 && (
          <div className="table-foot spread">
            <span>
              {period
                ? `แสดง ${movements.length} รายการ (ช่วง${PERIOD_LABEL[period]})`
                : `แสดงล่าสุด ${movements.length} รายการ (ทีละ ${PAGE_SIZE})`}
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
