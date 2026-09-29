import { useState } from 'react'
import { parseExpressReport, planImport } from '../lib/expressImport.js'

const PREVIEW_ROWS = 10
const INVALID_ROWS = 20

// นำเข้ารายการสินค้าจากรายงาน Express (.xlsx): อ่านไฟล์ → สรุปให้ดูก่อน → ยืนยันแล้วจึงบันทึก
// allProducts รวมสินค้าที่ปิดใช้งาน เพื่อไม่เพิ่มรหัสซ้ำกับของเดิม
export default function ProductImport({ allProducts, repository, onImported, onClose }) {
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState(null)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPlan(null)
    setError(null)
    setReading(true)
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const sheets = await readXlsxFile(file)
      const rows = Array.isArray(sheets[0]) ? sheets : (sheets[0]?.data ?? [])
      const { items, error: parseError } = parseExpressReport(rows)
      if (parseError) setError(parseError)
      else setPlan(planImport(items, allProducts))
    } catch {
      setError('อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ Excel (.xlsx)')
    }
    setReading(false)
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    const total = plan.toInsert.length
    const { inserted, error: saveError } = await repository.insertProducts(plan.toInsert)
    setSaving(false)
    if (saveError) {
      setError(
        `นำเข้าแล้ว ${inserted} จาก ${total} รายการ แล้วหยุดเพราะ: ${saveError} ` +
          'เลือกไฟล์เดิมอีกครั้งเพื่อนำเข้าส่วนที่เหลือ (รายการที่เพิ่มแล้วจะถูกข้าม)',
      )
      setPlan(null)
      onImported(null)
      return
    }
    onImported(`นำเข้าสินค้าจาก ${fileName} แล้ว ${inserted} รายการ`)
  }

  return (
    <div className="panel import-panel">
      <div className="panel-head">
        นำเข้ารายการสินค้าจาก Express
        <button type="button" className="btn sm" onClick={onClose} disabled={saving}>
          ปิด
        </button>
      </div>
      <div className="panel-body stack">
        <p className="hint">
          ใช้ไฟล์ "รายงานสินค้าและวัตถุดิบ" ที่ส่งออกจาก Express (.xlsx) นำเข้าเฉพาะสินค้าที่รหัสบ/ช ขึ้นต้นด้วย ST
          ไม่แก้สินค้าที่มีอยู่แล้ว จุดสั่งซื้อตั้งเป็น 0 และไม่นำเข้าจำนวนคงเหลือ
        </p>
        <label className="file-pick">
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            disabled={reading || saving}
          />
        </label>

        {reading && <p role="status">กำลังอ่านไฟล์…</p>}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {plan && (
          <>
            <div className="stats">
              <div className="panel stat">
                <span>จะเพิ่มใหม่</span>
                <b>{plan.toInsert.length}</b>
              </div>
              <div className="panel stat">
                <span>ข้าม (มีในระบบแล้ว / ไม่ใช่สินค้า)</span>
                <b>
                  {plan.skippedExisting} / {plan.skippedNonStock}
                </b>
              </div>
              <div className={plan.invalid.length > 0 ? 'panel stat out' : 'panel stat'}>
                <span>แถวข้อมูลไม่ครบ (ไม่นำเข้า)</span>
                <b>{plan.invalid.length}</b>
              </div>
            </div>

            {plan.invalid.length > 0 && (
              <details>
                <summary>ดูแถวที่ไม่นำเข้า ({plan.invalid.length})</summary>
                <ul className="sub">
                  {plan.invalid.slice(0, INVALID_ROWS).map((x) => (
                    <li key={x.row}>
                      แถว {x.row} <span className="mono">{x.sku}</span>: {x.reason}
                    </li>
                  ))}
                  {plan.invalid.length > INVALID_ROWS && <li>…และอีก {plan.invalid.length - INVALID_ROWS} แถว</li>}
                </ul>
              </details>
            )}

            {plan.toInsert.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>รหัส</th>
                      <th>ชื่อสินค้า</th>
                      <th className="hide-sm">หมวดหมู่</th>
                      <th>หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.toInsert.slice(0, PREVIEW_ROWS).map((p) => (
                      <tr key={p.sku}>
                        <td className="mono">{p.sku}</td>
                        <td>{p.name}</td>
                        <td className="hide-sm dim">{p.category}</td>
                        <td>{p.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan.toInsert.length > PREVIEW_ROWS && (
                  <div className="table-foot">ตัวอย่าง {PREVIEW_ROWS} รายการแรก จาก {plan.toInsert.length}</div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn" onClick={onClose} disabled={saving}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirm}
                disabled={saving || plan.toInsert.length === 0}
              >
                {saving ? 'กำลังนำเข้า…' : `ยืนยันนำเข้า ${plan.toInsert.length} รายการ`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
