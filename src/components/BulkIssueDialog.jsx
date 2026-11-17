import { useEffect, useRef, useState } from 'react'
import { ISSUE_NOTE_OPTIONS, planBulkIssue } from '../lib/bulkIssue.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { searchProducts } from '../lib/stockRules.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import ProductDialog from './ProductDialog.jsx'
import ThaiDateInput from './ThaiDateInput.jsx'

const MAX_PICKS = 8

// หน้าต่าง "เบิกออกหลายรายการ" (หน้ารับเข้า/เบิกออก): ค้นหาแล้วกดเลือกสินค้า ใส่จำนวนที่เบิกและหมายเหตุ (ออนไลน์ / ขายส่ง) ต่อรายการ
// บันทึกทั้งใบพร้อมกัน (record_movements) รายการไหนไม่ผ่าน ไม่เบิกอะไรเลย
// products = สินค้าที่เปิดใช้งานทั้งหมด onSaved(ข้อความ) เมื่อบันทึกสำเร็จ onClose() ปิดหน้าต่าง
export default function BulkIssueDialog({ products, role, today, repository, onSaved, onClose }) {
  const [query, setQuery] = useState('')
  // แถวที่เลือก เรียงตามลำดับที่กดเลือก { productId, quantity, note }
  const [rows, setRows] = useState([])
  const [movementDate, setMovementDate] = useState(today)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const searchRef = useRef(null)

  // เปิดหน้าต่างแล้วพิมพ์ค้นหาได้ทันที (autoFocus ใช้ไม่ได้ เพราะ <dialog> เปิดหลังกล่องค้นหาถูกสร้าง effect ของ parent รันหลัง effect เปิด dialog)
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const byId = new Map(products.map((p) => [p.id, p]))
  const picked = new Set(rows.map((r) => r.productId))
  const matches = searchProducts(products, query)
    .filter((p) => !picked.has(p.id))
    .toSorted((a, b) => a.sku.localeCompare(b.sku, 'th'))
  const shown = matches.slice(0, MAX_PICKS)

  const addProduct = (product) => {
    if (product.onHand <= 0) return
    setRows((current) => (current.some((r) => r.productId === product.id) ? current : [...current, { productId: product.id, quantity: '', note: '' }]))
    setQuery('')
    setServerError(null)
  }

  const patchRow = (productId, patch) => {
    setRows((current) => current.map((r) => (r.productId === productId ? { ...r, ...patch } : r)))
    setErrors((current) => {
      if (!current[productId]) return current
      const { [productId]: _removed, ...rest } = current
      return rest
    })
  }

  const removeRow = (productId) => {
    setRows((current) => current.filter((r) => r.productId !== productId))
    setErrors((current) => {
      const { [productId]: _removed, ...rest } = current
      return rest
    })
  }

  // ตั้งหมายเหตุทุกแถวพร้อมกัน (ทางลัด) แถวไหนตั้งเองไว้แล้วจะถูกทับ
  const setAllNotes = (note) => {
    if (!note) return
    setRows((current) => current.map((r) => ({ ...r, note })))
    setErrors({})
  }

  const requestClose = () => {
    if (saving) return
    if (rows.length > 0) setConfirmClose(true)
    else onClose()
  }

  const handleSave = async () => {
    setServerError(null)
    if (!movementDate || movementDate > today) {
      setServerError('วันที่ต้องไม่เป็นวันในอนาคต')
      return
    }
    const plan = planBulkIssue(rows, products, role, today)
    setErrors(plan.errors)
    if (Object.keys(plan.errors).length > 0) {
      setServerError('มีรายการที่ยังไม่ถูกต้อง กรุณาแก้ไขช่องที่ขึ้นสีแดงก่อน')
      return
    }
    if (plan.moves.length === 0) {
      setServerError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)
    const { saved, error } = await repository.recordMovements({ items: plan.moves, movementDate })
    setSaving(false)
    if (error) {
      setServerError(`ไม่ได้เบิกออก (ไม่มีรายการไหนถูกบันทึก): ${error}`)
      return
    }
    onSaved(`เบิกออก ${saved} รายการแล้ว`)
  }

  const noteAllValue = rows.length > 0 && rows.every((r) => r.note && r.note === rows[0].note) ? rows[0].note : ''

  return (
    <>
      <ProductDialog open label="เบิกออกหลายรายการ" onRequestClose={requestClose} className="product-dialog bulk-issue-dialog">
        <div className="panel">
          <div className="panel-head">เบิกออกหลายรายการ</div>
          <div className="panel-body bulk-issue-body">
            <div className="issue-top">
              <div className="date-field">
                <span>วันที่เบิก</span>
                <ThaiDateInput ariaLabel="วันที่เบิก" max={today} value={movementDate} onChange={setMovementDate} />
              </div>
              <label className="date-field">
                <span>ตั้งหมายเหตุทุกรายการ</span>
                <select value={noteAllValue} onChange={(e) => setAllNotes(e.target.value)} disabled={rows.length === 0 || saving}>
                  <option value="">เลือก…</option>
                  {ISSUE_NOTE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="issue-search">
              <input
                type="search"
                ref={searchRef}
                placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด แล้วกดเลือกสินค้า (Enter = เลือกรายการแรก)"
                aria-label="ค้นหาสินค้าที่จะเบิก"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const first = shown.find((p) => p.onHand > 0)
                    if (first) addProduct(first)
                  }
                }}
                disabled={saving}
              />
              {query.trim() !== '' && (
                <ul className="pick-list" aria-label="ผลการค้นหา">
                  {shown.length === 0 && <li className="dim pick-empty">ไม่พบสินค้า (หรือเลือกไว้แล้ว)</li>}
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="pick-item" onClick={() => addProduct(p)} disabled={p.onHand <= 0}>
                        <span className="mono">{p.sku}</span>
                        <span className="pick-name">{p.name}</span>
                        <span className="dim">{p.onHand > 0 ? `คงเหลือ ${formatQuantity(p.onHand)} ${p.unit}` : 'หมด'}</span>
                      </button>
                    </li>
                  ))}
                  {matches.length > MAX_PICKS && <li className="dim pick-empty">มีอีก {matches.length - MAX_PICKS} รายการ พิมพ์เพิ่มเพื่อกรอง</li>}
                </ul>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="empty dim">ยังไม่ได้เลือกสินค้า ค้นหาแล้วกดเลือกจากรายการด้านบน</p>
            ) : (
              <div className="table-wrap">
                <table className="issue-table">
                  <thead>
                    <tr>
                      <th className="num">ลำดับ</th>
                      <th>รายการสินค้า</th>
                      <th>หน่วย</th>
                      <th className="num">จำนวนที่เบิกออก</th>
                      <th className="num">จำนวนคงเหลือ</th>
                      <th>หมายเหตุ</th>
                      <th>
                        <span className="sr-only">ลบรายการ</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const p = byId.get(row.productId)
                      const err = errors[row.productId] ?? {}
                      return (
                        <tr key={row.productId} className={err.quantity || err.note ? 'row-error' : undefined}>
                          <td className="num dim">{index + 1}</td>
                          <td>
                            {p.name}
                            <div className="sub mono">{p.sku}</div>
                          </td>
                          <td>{p.unit}</td>
                          <td className="num">
                            <input
                              className="qty-input"
                              inputMode="decimal"
                              aria-label={`จำนวนที่เบิกออก ${p.sku}`}
                              value={row.quantity}
                              onChange={(e) => patchRow(row.productId, { quantity: e.target.value })}
                              disabled={saving}
                              aria-invalid={Boolean(err.quantity)}
                            />
                            {err.quantity && <div className="err">{err.quantity}</div>}
                          </td>
                          <td className="num">{formatQuantity(p.onHand)}</td>
                          <td>
                            <select
                              aria-label={`หมายเหตุ ${p.sku}`}
                              value={row.note}
                              onChange={(e) => patchRow(row.productId, { note: e.target.value })}
                              disabled={saving}
                              aria-invalid={Boolean(err.note)}
                            >
                              <option value="">เลือก…</option>
                              {ISSUE_NOTE_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                            {err.note && <div className="err">{err.note}</div>}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn sm"
                              aria-label={`เอา ${p.sku} ออกจากรายการ`}
                              onClick={() => removeRow(row.productId)}
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
            <span className="dim issue-hint">บันทึกทั้งใบพร้อมกัน ถ้ามีรายการใดไม่ผ่าน จะไม่เบิกรายการไหนเลย</span>
            <span className="issue-buttons">
              <button type="button" className="btn" onClick={requestClose} disabled={saving}>
                ยกเลิก
              </button>
              <button type="button" className="btn primary" onClick={handleSave} disabled={saving || rows.length === 0}>
                {saving ? 'กำลังบันทึก…' : `ยืนยันการเบิกออก ${rows.length} รายการ`}
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
                message: 'รายการที่เลือกไว้ยังไม่ได้เบิก และจะหายไป',
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
