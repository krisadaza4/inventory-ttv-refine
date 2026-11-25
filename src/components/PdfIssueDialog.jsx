import { useState } from 'react'
import { formatQuantity } from '../lib/numberFormat.js'
import { PDF_ISSUE_NOTE, UNMATCHED_REASON, checkPdfIssue, orderKey, ordersOfLines, planPdfIssue } from '../lib/pdfIssue.js'
import { readPdfPages } from '../lib/pdfText.js'
import { PLATFORM_LABEL, parsePicklist } from '../lib/picklist.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import ProductDialog from './ProductDialog.jsx'
import ThaiDateInput from './ThaiDateInput.jsx'

// ที่มาของจำนวน เช่น "Shopee 3 · TikTok 1 · Shopee ชุด GL-203R-P1 ×2"
const sourceSummary = (sources) => {
  const parts = new Map()
  for (const s of sources) {
    const key = s.bundle ? `${s.platform}|${s.bundle}` : s.platform
    const current = parts.get(key) ?? { ...s, quantity: 0, bundleQty: 0 }
    current.quantity += s.quantity
    current.bundleQty += s.bundleQty ?? 0
    parts.set(key, current)
  }
  return [...parts.values()]
    .map((s) =>
      s.bundle
        ? `${PLATFORM_LABEL[s.platform]} ชุด ${s.bundle} ×${formatQuantity(s.bundleQty)}`
        : `${PLATFORM_LABEL[s.platform]} ${formatQuantity(s.quantity)}`,
    )
    .join(' · ')
}

const REASON_TEXT = {
  [UNMATCHED_REASON.NO_PRODUCT]: 'ไม่มีรหัสนี้ในระบบ',
  [UNMATCHED_REASON.BUNDLE_NOT_SET]: 'ยังไม่ได้ตั้งเป็นชุดสินค้า',
  [UNMATCHED_REASON.BUNDLE_INACTIVE]: 'ชุดมีสินค้าที่ปิดใช้งาน',
}

// หน้าต่าง "เบิกออกจาก PDF": เลือกไฟล์รายการหยิบสินค้าจากเว็บ seller (Shopee / Lazada / TikTok) หลายไฟล์พร้อมกัน
// อ่านไฟล์ในเบราว์เซอร์ จับคู่ SKU กับสินค้า ข้ามคำสั่งซื้อที่เคยเบิกแล้ว ตรวจแล้วยืนยันทีเดียว (record_online_issue)
export default function PdfIssueDialog({ products, role, today, repository, onSaved, onClose }) {
  const [movementDate, setMovementDate] = useState(today)
  const [files, setFiles] = useState([])
  const [plan, setPlan] = useState(null)
  const [removed, setRemoved] = useState(() => new Set())
  const [quantities, setQuantities] = useState({})
  const [errors, setErrors] = useState({})
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const byId = new Map(products.map((p) => [p.id, p]))
  const lines = plan ? plan.lines.filter((line) => !removed.has(line.productId)) : []
  const orders = ordersOfLines(lines)
  const busy = reading || saving

  const handleFiles = async (fileList) => {
    const picked = [...fileList]
    if (picked.length === 0) return
    setReading(true)
    setServerError(null)
    setErrors({})
    setPlan(null)
    setRemoved(new Set())
    setQuantities({})
    const results = []
    for (const file of picked) {
      try {
        const parsed = parsePicklist(await readPdfPages(file))
        results.push({ name: file.name, ...parsed })
      } catch (thrown) {
        console.error('อ่าน PDF ไม่ได้', file.name, thrown)
        results.push({ name: file.name, platform: null, rows: [], warnings: [], error: 'อ่านไฟล์ไม่ได้ (ไม่ใช่ PDF หรือไฟล์เสีย)' })
      }
    }
    setFiles(results)
    const readable = results.filter((r) => !r.error)
    const orderNos = readable.flatMap((r) => r.rows.flatMap((row) => row.orders))
    const [issuedResult, bundleResult] = await Promise.all([repository.listIssuedOrders(orderNos), repository.listBundles()])
    setReading(false)
    if (issuedResult.error) {
      setServerError(`ตรวจคำสั่งซื้อที่เคยเบิกไม่ได้: ${issuedResult.error}`)
      return
    }
    if (bundleResult.error) {
      setServerError(`โหลดชุดสินค้าไม่ได้: ${bundleResult.error}`)
      return
    }
    const issued = new Set(issuedResult.rows.map((r) => orderKey(r.platform, r.orderNo, r.sku)))
    setPlan(planPdfIssue(readable, products, issued, bundleResult.bundles))
  }

  const setQuantity = (productId, value) => {
    setQuantities((current) => ({ ...current, [productId]: value }))
    setErrors((current) => {
      if (!current[productId]) return current
      const { [productId]: _removed, ...rest } = current
      return rest
    })
  }

  const removeLine = (productId) => {
    setRemoved((current) => new Set(current).add(productId))
  }

  const requestClose = () => {
    if (busy) return
    if (lines.length > 0) setConfirmClose(true)
    else onClose()
  }

  const handleSave = async () => {
    setServerError(null)
    if (!movementDate || movementDate > today) {
      setServerError('วันที่ต้องไม่เป็นวันในอนาคต')
      return
    }
    const checked = checkPdfIssue(lines, quantities, products, role, today)
    setErrors(checked.errors)
    if (Object.keys(checked.errors).length > 0) {
      setServerError('มีรายการที่ยังไม่ถูกต้อง กรุณาแก้ไขช่องที่ขึ้นสีแดงก่อน')
      return
    }
    if (checked.moves.length === 0 || orders.length === 0) {
      setServerError('ไม่มีรายการที่จะเบิก')
      return
    }
    setSaving(true)
    const { saved, error } = await repository.recordOnlineIssue({ items: checked.moves, orders, movementDate })
    setSaving(false)
    if (error) {
      setServerError(`ไม่ได้เบิกออก (ไม่มีรายการไหนถูกบันทึก): ${error}`)
      return
    }
    onSaved(`เบิกออกจาก PDF ${saved} รายการแล้ว (${orders.length} คำสั่งซื้อ)`)
  }

  return (
    <>
      <ProductDialog open label="เบิกออกจาก PDF" onRequestClose={requestClose} className="product-dialog bulk-issue-dialog">
        <div className="panel">
          <div className="panel-head">เบิกออกจาก PDF (Shopee / Lazada / TikTok)</div>
          <div className="panel-body bulk-issue-body">
            <div className="issue-top">
              <div className="date-field">
                <span>วันที่เบิก</span>
                <ThaiDateInput ariaLabel="วันที่เบิก" max={today} value={movementDate} onChange={setMovementDate} />
              </div>
              <label className="btn pdf-pick">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    handleFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                เลือกไฟล์ PDF
              </label>
              <span className="dim pdf-hint">เลือกได้หลายไฟล์พร้อมกัน หมายเหตุ "{PDF_ISSUE_NOTE}" รหัสชุดแตกเป็นชิ้นส่วนให้อัตโนมัติ</span>
            </div>

            {reading && (
              <p className="dim" role="status">
                กำลังอ่านไฟล์…
              </p>
            )}

            {files.length > 0 && (
              <ul className="pdf-files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span className="mono">{f.name}</span>
                    {f.error ? (
                      <span className="err"> {f.error}</span>
                    ) : (
                      <span className="dim">
                        {' '}
                        · {PLATFORM_LABEL[f.platform]} · {f.rows.length} รายการ ·{' '}
                        {new Set(f.rows.flatMap((r) => r.orders)).size} คำสั่งซื้อ
                      </span>
                    )}
                    {f.warnings.map((w) => (
                      <div key={w} className="pdf-warn-text">
                        {w}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {plan && plan.unmatched.length > 0 && (
              <div className="pdf-warn" role="alert">
                <strong>เบิกไม่ได้ {plan.unmatched.length} รายการ (ไม่ถูกเบิก)</strong>
                <div className="dim">
                  แก้รหัสใน Excel หรือบนเว็บ seller ให้ตรงกัน หรือถ้าเป็นชุด ตั้งค่าที่หน้า จัดการสินค้า → ชุดสินค้า (Bundle) แล้วเลือกไฟล์ใหม่อีกครั้ง
                </div>
                <table className="issue-table cards-sm">
                  <thead>
                    <tr>
                      <th>แพลตฟอร์ม</th>
                      <th>รหัสใน PDF</th>
                      <th className="num">จำนวน</th>
                      <th>สาเหตุ</th>
                      <th>เลขคำสั่งซื้อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.unmatched.map((u, i) => (
                      <tr key={`${u.platform}-${u.sku}-${i}`}>
                        <td className="cell-main">
                          <span className="mono show-sm">{u.sku} · </span>
                          {PLATFORM_LABEL[u.platform]}
                        </td>
                        <td className="cell-hide-sm mono">{u.sku}</td>
                        <td className="num" data-label="จำนวน">
                          {formatQuantity(u.quantity)}
                        </td>
                        <td data-label="สาเหตุ">{REASON_TEXT[u.reason]}</td>
                        <td className="mono dim cell-wide" data-label="เลขคำสั่งซื้อ">
                          {u.orders.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plan && plan.skipped.length > 0 && (
              <details className="pdf-skipped">
                <summary>ข้าม {plan.skipped.length} รายการ: คำสั่งซื้อเคยเบิกไปแล้ว</summary>
                <ul>
                  {plan.skipped.map((s, i) => (
                    <li key={`${s.platform}-${s.sku}-${i}`}>
                      {PLATFORM_LABEL[s.platform]} · <span className="mono">{s.sku}</span> × {formatQuantity(s.quantity)} ·{' '}
                      <span className="mono dim">{s.orders.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {!plan && !reading && files.length === 0 && (
              <p className="empty dim">เลือกไฟล์ PDF รายการหยิบสินค้าที่โหลดจากเว็บ seller</p>
            )}

            {plan && lines.length === 0 && <p className="empty dim">ไม่มีรายการที่จะเบิก</p>}

            {plan && plan.bundled.length > 0 && (
              <div className="pdf-bundles">
                <strong>ชุดสินค้าที่แตกเป็นชิ้นส่วน {plan.bundled.length} รายการ</strong>
                <ul>
                  {plan.bundled.map((b, i) => (
                    <li key={`${b.platform}-${b.sku}-${i}`}>
                      <span className="bundle-tag">ชุด</span> {PLATFORM_LABEL[b.platform]} · <span className="mono">{b.sku}</span> ×
                      {formatQuantity(b.quantity)} →{' '}
                      <span className="mono">
                        {b.items.map((item) => `${byId.get(item.productId)?.sku ?? '?'} ×${formatQuantity(item.quantity)}`).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lines.length > 0 && (
              <div className="table-wrap">
                <table className="issue-table cards-sm">
                  <thead>
                    <tr>
                      <th className="num">ลำดับ</th>
                      <th>รายการสินค้า</th>
                      <th>ที่มา</th>
                      <th className="num">จำนวนที่เบิกออก</th>
                      <th className="num">จำนวนคงเหลือ</th>
                      <th>
                        <span className="sr-only">ลบรายการ</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const p = byId.get(line.productId)
                      const err = errors[line.productId] ?? {}
                      return (
                        <tr
                          key={line.productId}
                          className={[err.quantity && 'row-error', line.fromBundle && 'row-bundle'].filter(Boolean).join(' ') || undefined}
                        >
                          <td className="num dim cell-index">{index + 1}</td>
                          <td className="cell-main">
                            {line.fromBundle && <span className="bundle-tag">ชุด</span>} {p.name}
                            {p.name !== p.sku && <div className="sub mono">{p.sku}</div>}
                          </td>
                          <td className="cell-wide" data-label="ที่มา">
                            {sourceSummary(line.sources)}
                            {line.partial && <div className="pdf-warn-text">บางคำสั่งซื้อเคยเบิกแล้ว ตรวจจำนวนอีกครั้ง</div>}
                          </td>
                          <td className="num" data-label="จำนวนที่เบิกออก">
                            <input
                              className="qty-input"
                              inputMode="decimal"
                              aria-label={`จำนวนที่เบิกออก ${p.sku}`}
                              value={quantities[line.productId] ?? String(line.quantity)}
                              onChange={(e) => setQuantity(line.productId, e.target.value)}
                              disabled={saving}
                              aria-invalid={Boolean(err.quantity)}
                            />
                            {err.quantity && <div className="err">{err.quantity}</div>}
                          </td>
                          <td className="num nowrap" data-label="คงเหลือ">
                            {formatQuantity(p.onHand)} {p.unit}
                          </td>
                          <td className="cell-remove">
                            <button
                              type="button"
                              className="btn sm"
                              aria-label={`เอา ${p.sku} ออกจากรายการ`}
                              onClick={() => removeLine(line.productId)}
                              disabled={saving}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {serverError && (
              <p className="alert form-alert" role="alert">
                {serverError}
              </p>
            )}
          </div>
          <div className="form-actions spread">
            <span className="dim issue-hint">บันทึกทั้งใบพร้อมกัน คำสั่งซื้อที่เบิกแล้วจะถูกข้ามในครั้งถัดไป</span>
            <span className="issue-buttons">
              <button type="button" className="btn" onClick={requestClose} disabled={busy}>
                ยกเลิก
              </button>
              <button type="button" className="btn primary" onClick={handleSave} disabled={busy || lines.length === 0}>
                {saving ? 'กำลังบันทึก…' : `ยืนยันการเบิกออก ${lines.length} รายการ`}
              </button>
            </span>
          </div>
        </div>
      </ProductDialog>
      <ConfirmDialog
        request={
          confirmClose
            ? {
                title: 'ปิดหน้าต่างนี้?',
                message: 'รายการที่อ่านจากไฟล์ยังไม่ได้เบิก และจะหายไป',
                confirmLabel: 'ปิดโดยไม่เบิก',
                danger: true,
              }
            : null
        }
        onAnswer={(ok) => {
          setConfirmClose(false)
          if (ok) onClose()
        }}
      />
    </>
  )
}
