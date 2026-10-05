import { useEffect, useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { MONTH_LABELS, toBuddhistYear } from '../lib/monthlySales.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { warehouseSalesSheet } from '../lib/spreadsheet.js'
import { MOVEMENT_TYPE } from '../lib/stockRules.js'
import { outYears, salesByWarehouse } from '../lib/warehouses.js'
import ExportButton from './ExportButton.jsx'

// ยอดขาย/เบิกออกแยกตามคลัง รายเดือน คำนวณจากประวัติในระบบ (ไม่ใช่ไฟล์สต็อกของร้าน)
// warehouses รวมที่ปิดใช้งาน
export default function WarehouseSales({ warehouses, repository }) {
  const [movements, setMovements] = useState([])
  // 'loading' | 'ready' | 'error'
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  useEffect(() => {
    let active = true
    repository.listAllMovements({ type: MOVEMENT_TYPE.OUT }).then((result) => {
      if (!active) return
      if (result.error) {
        setError(result.error)
        setState('error')
      } else {
        setMovements(result.movements)
        setState('ready')
      }
    })
    return () => {
      active = false
    }
  }, [repository, attempt])

  const years = outYears(movements, currentYear)
  const summary = salesByWarehouse(movements, warehouses, year)

  return (
    <>
      <div className="toolbar">
        <select aria-label="เลือกปี" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              ปี {toBuddhistYear(y)}
            </option>
          ))}
        </select>
        <span className="hint grow">จำนวนชิ้นที่ขาย/เบิกออก จากประวัติในระบบ · คลังใหญ่ = เบิกออกที่ไม่ระบุคลัง</span>
        <ExportButton
          fileName={`inventory-sales-by-warehouse-${toBuddhistYear(year)}-${toIsoDate(new Date())}.xlsx`}
          sheetName={`ยอดตามคลัง ${toBuddhistYear(year)}`}
          buildSheet={() => ({ sheetData: warehouseSalesSheet(summary) })}
          disabled={state !== 'ready'}
        />
      </div>

      {state === 'loading' && (
        <p className="empty" role="status">
          กำลังโหลดประวัติ…
        </p>
      )}
      {state === 'error' && (
        <div className="empty">
          <p className="alert" role="alert">
            โหลดประวัติไม่สำเร็จ: {error}
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setState('loading')
              setAttempt((n) => n + 1)
            }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {state === 'ready' && (
        <div className="table-wrap">
          <table className="wh-sales-table">
            <thead>
              <tr>
                <th>คลัง</th>
                {MONTH_LABELS.map((label) => (
                  <th key={label} className="num">
                    {label}
                  </th>
                ))}
                <th className="num">รวม</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.id || 'central'}>
                  <td className="nowrap">{r.name}</td>
                  {r.months.map((q, i) => (
                    <td key={i} className="num">
                      {q === 0 ? <span className="dim">–</span> : formatQuantity(q)}
                    </td>
                  ))}
                  <td className="num">
                    <b>{formatQuantity(r.total)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>รวมทุกคลัง</th>
                {summary.totals.months.map((q, i) => (
                  <th key={i} className="num">
                    {formatQuantity(q)}
                  </th>
                ))}
                <th className="num">{formatQuantity(summary.totals.total)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
