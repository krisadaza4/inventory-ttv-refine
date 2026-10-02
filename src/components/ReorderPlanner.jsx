import { useState } from 'react'
import { DEFAULT_COVER_MONTHS, MAX_COVER_MONTHS, parseCoverMonths, planReorderPoints } from '../lib/bulkEdit.js'
import { formatQuantity } from '../lib/numberFormat.js'

// ตั้งจุดสั่งซื้อจากยอดขายเฉลี่ย (admin): พิมพ์จำนวนเดือนสำรอง ดูตัวอย่าง แล้วยืนยันบันทึกทีเดียว
export default function ReorderPlanner({ allProducts, repository, onSaved, onClose }) {
  const [monthsText, setMonthsText] = useState(String(DEFAULT_COVER_MONTHS))
  const [onlyUnset, setOnlyUnset] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const months = parseCoverMonths(monthsText)
  const plan = months === null ? [] : planReorderPoints(allProducts, months, { onlyUnset })
  const noAverage = allProducts.filter((p) => p.active && p.avgMonthlySales === null).length

  const handleConfirm = async () => {
    setError(null)
    setSaving(true)
    const { updated, error: saveError } = await repository.setReorderPoints(
      plan.map((r) => ({ id: r.product.id, reorderPoint: r.next })),
    )
    setSaving(false)
    if (saveError) {
      setError(`บันทึกได้ ${updated} จาก ${plan.length} รายการ: ${saveError}`)
      if (updated > 0) onSaved(null)
      return
    }
    onSaved(`ตั้งจุดสั่งซื้อ ${updated} รายการแล้ว (สำรอง ${months} เดือน)`)
  }

  return (
    <div className="panel import-panel">
      <div className="panel-head">
        ตั้งจุดสั่งซื้อจากยอดขายเฉลี่ย
        <button type="button" className="btn sm" onClick={onClose} disabled={saving}>
          ปิด
        </button>
      </div>
      <div className="panel-body stack">
        <p className="hint">
          จุดสั่งซื้อ = ขายเฉลี่ย/เดือน × จำนวนเดือนที่ต้องมีของสำรอง (ปัดขึ้นเป็นจำนวนเต็ม) คงเหลือเท่านี้หรือน้อยกว่าจะขึ้นว่า
          "ใกล้หมด" สินค้าที่ไม่มียอดขายเฉลี่ย {noAverage} รายการจะไม่ถูกเปลี่ยน
        </p>
        <div className="toolbar plain-toolbar">
          <label className="check">
            สำรอง
            <input
              className="months-input"
              inputMode="decimal"
              aria-label="จำนวนเดือนสำรอง"
              aria-invalid={months === null}
              value={monthsText}
              onChange={(e) => setMonthsText(e.target.value)}
            />
            เดือน
          </label>
          <label className="check">
            <input type="checkbox" checked={onlyUnset} onChange={(e) => setOnlyUnset(e.target.checked)} /> เฉพาะที่จุดสั่งซื้อยังเป็น 0
          </label>
        </div>

        {months === null && (
          <p className="alert" role="alert">
            จำนวนเดือนต้องมากกว่า 0 ไม่เกิน {MAX_COVER_MONTHS} ทศนิยมไม่เกิน 1 ตำแหน่ง เช่น 3.4
          </p>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {months !== null && plan.length === 0 ? (
          <p className="empty dim">ไม่มีรายการที่ต้องเปลี่ยน</p>
        ) : plan.length === 0 ? null : (
          <div className="table-wrap planner-table">
            <table>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th className="num">ขายเฉลี่ย/เดือน</th>
                  <th className="num">จุดสั่งซื้อเดิม</th>
                  <th className="num">ใหม่</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((r) => (
                  <tr key={r.product.id}>
                    <td className="mono">{r.product.sku}</td>
                    <td className="num">{formatQuantity(r.product.avgMonthlySales)}</td>
                    <td className="num dim">{formatQuantity(r.current)}</td>
                    <td className="num">
                      <b>{formatQuantity(r.next)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-cancel" onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>
          <button type="button" className="btn primary" onClick={handleConfirm} disabled={saving || plan.length === 0}>
            {saving ? 'กำลังบันทึก…' : `ยืนยันตั้งจุดสั่งซื้อ ${plan.length} รายการ`}
          </button>
        </div>
      </div>
    </div>
  )
}
