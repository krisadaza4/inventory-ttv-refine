import { useEffect, useState } from 'react'
import { formatThaiDate, toIsoDate } from '../lib/dateFormat.js'
import { rangeFileSuffix } from '../lib/dateRange.js'
import { AFTERNOON_FROM } from '../lib/dayPeriod.js'
import { summarizeIssues } from '../lib/issueSummary.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { exportFileName, issueSummarySheet } from '../lib/spreadsheet.js'
import { MOVEMENT_TYPE } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'

const BY_RECORDER_KEY = 'inventory-ttv:issue-summary-by-recorder'

const readByRecorder = () => {
  try {
    return localStorage.getItem(BY_RECORDER_KEY) === '1'
  } catch {
    return false
  }
}

function rangeText({ from, to }) {
  if (from && to) return from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`
  if (from) return `ตั้งแต่ ${formatThaiDate(from)}`
  if (to) return `ถึง ${formatThaiDate(to)}`
  return 'ทุกวันที่'
}

const qty = (n) => (n ? formatQuantity(n) : '—')

// สรุปการเบิกออกช่วงเช้า-บ่าย ตามช่วงวันที่และสินค้าที่เลือกในหน้าประวัติ
// เช้า = บันทึกก่อน 12:00, บ่าย = ตั้งแต่ 12:00 (เวลาที่กดบันทึก เวลาไทย)
// attempt เปลี่ยน = โหลดใหม่ (ปุ่มรีเฟรชของหน้า)
export default function IssueSummary({ repository, productId, range, attempt }) {
  // ผลโหลดล่าสุดผูกกับตัวกรองที่ใช้โหลด ตัวกรองเปลี่ยน = กำลังโหลด (ไม่ต้อง setState ใน effect)
  const [result, setResult] = useState({ key: null, movements: [], error: null })
  const [byRecorder, setByRecorder] = useState(readByRecorder)
  const key = JSON.stringify([productId, range.from, range.to, attempt])

  useEffect(() => {
    let active = true
    repository
      .listAllMovements({ productId, type: MOVEMENT_TYPE.OUT, dateFrom: range.from, dateTo: range.to })
      .then((r) => {
        if (active) setResult({ key, movements: r.error ? [] : r.movements, error: r.error })
      })
    return () => {
      active = false
    }
  }, [repository, productId, range.from, range.to, attempt, key])

  const loadState = result.key !== key ? 'loading' : result.error ? 'error' : 'ready'
  const { movements, error: loadError } = result

  const toggleByRecorder = (on) => {
    setByRecorder(on)
    try {
      localStorage.setItem(BY_RECORDER_KEY, on ? '1' : '0')
    } catch {
      // เก็บค่าไม่ได้ (โหมดส่วนตัว) ใช้ค่าในหน้านี้ต่อได้
    }
  }

  const summary = summarizeIssues(movements, { byRecorder })
  // คอลัมน์: สินค้า, (ผู้บันทึก), เช้า, บ่าย, รวม
  const cols = byRecorder ? 5 : 4

  return (
    <>
      <div className="toolbar summary-bar">
        <span className="dim">
          เบิกออก · {rangeText(range)} · เช้า = ก่อน {AFTERNOON_FROM} น. บ่าย = ตั้งแต่ {AFTERNOON_FROM} น.
        </span>
        <label className="check push-left">
          <input type="checkbox" checked={byRecorder} onChange={(e) => toggleByRecorder(e.target.checked)} />{' '}
          แยกตามผู้บันทึก
        </label>
        <ExportButton
          fileName={exportFileName(`issue-summary${rangeFileSuffix(range)}`, toIsoDate(new Date()))}
          sheetName="สรุปการเบิก"
          buildSheet={() => ({ sheetData: issueSummarySheet(summary, { byRecorder }) })}
          disabled={summary.rows.length === 0}
        />
      </div>

      {loadState === 'loading' && (
        <p className="empty" role="status">
          กำลังสรุปการเบิก…
        </p>
      )}
      {loadState === 'error' && (
        <p className="empty alert" role="alert">
          โหลดข้อมูลไม่สำเร็จ: {loadError}
        </p>
      )}
      {loadState === 'ready' && summary.rows.length === 0 && (
        <p className="empty dim">ไม่มีการเบิกออกในช่วงที่เลือก</p>
      )}

      {loadState === 'ready' && summary.rows.length > 0 && (
        <div className="table-wrap">
          <table className="issue-summary">
            <thead>
              <tr>
                <th>สินค้า</th>
                {byRecorder && <th>ผู้บันทึก</th>}
                <th className="num">เช้า</th>
                <th className="num">บ่าย</th>
                <th className="num">รวม</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.name}
                    <div className="sub mono">{r.sku}</div>
                  </td>
                  {byRecorder && <td>{r.recorder}</td>}
                  <td className="num">{qty(r.morning)}</td>
                  <td className="num">{qty(r.afternoon)}</td>
                  <td className="num">
                    <b>{formatQuantity(r.total)}</b> {r.unit}
                  </td>
                </tr>
              ))}
            </tbody>
            {summary.total && (
              <tfoot>
                <tr>
                  <td colSpan={cols - 3}>
                    <b>รวมทั้งหมด</b>
                  </td>
                  <td className="num">
                    <b>{qty(summary.total.morning)}</b>
                  </td>
                  <td className="num">
                    <b>{qty(summary.total.afternoon)}</b>
                  </td>
                  <td className="num">
                    <b>{formatQuantity(summary.total.total)}</b> {summary.total.unit}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {loadState === 'ready' && summary.rows.length > 0 && (
        <div className="table-foot">
          {summary.rows.length} แถว · จากการเบิกออก {movements.length} รายการ
        </div>
      )}
    </>
  )
}
