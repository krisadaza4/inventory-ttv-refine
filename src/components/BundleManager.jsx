import { useEffect, useState } from 'react'
import { bundleSummary, checkBundleDraft, sortBundleItems } from '../lib/bundles.js'
import { normalizeSku } from '../lib/pdfIssue.js'
import { searchProducts } from '../lib/stockRules.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import ProductDialog from './ProductDialog.jsx'

const MAX_PICKS = 8

// หน้าต่าง "ชุดสินค้า (Bundle)" ในหน้าจัดการสินค้า: รหัสชุดใน PDF ของ seller → ชิ้นส่วนที่ตัดสต็อกจริง
// ใช้ตอนเบิกออกจาก PDF (แตกชุดเป็นชิ้นส่วน) allProducts = สินค้าทั้งหมดรวมที่ปิดใช้งาน (แสดงชื่อชิ้นส่วนเดิมได้)
export default function BundleManager({ allProducts, repository, onClose }) {
  const [bundles, setBundles] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // { oldSku, sku, items: [{ productId, quantity }] }
  const [pickQuery, setPickQuery] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [reloadSeq, setReloadSeq] = useState(0)

  useEffect(() => {
    let cancelled = false
    repository.listBundles().then(({ bundles: list, error }) => {
      if (cancelled) return
      setBundles(list)
      setLoadError(error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [repository, reloadSeq])

  const byId = new Map(allProducts.map((p) => [p.id, p]))
  const active = allProducts.filter((p) => p.active !== false)
  const q = normalizeSku(query)
  const shownBundles = q
    ? bundles.filter((b) => normalizeSku(b.sku).includes(q) || normalizeSku(bundleSummary(b, byId)).includes(q))
    : bundles

  const inEditor = new Set(editing?.items.map((i) => i.productId) ?? [])
  const picks = editing && pickQuery.trim() !== '' ? searchProducts(active, pickQuery).filter((p) => !inEditor.has(p.id)) : []
  const productSkus = new Set(active.map((p) => normalizeSku(p.sku)))

  const startNew = () => {
    setEditing({ oldSku: null, sku: '', items: [] })
    setErrors({})
    setServerError(null)
    setNotice(null)
    setPickQuery('')
  }

  const startEdit = (bundle) => {
    setEditing({ oldSku: bundle.sku, sku: bundle.sku, items: sortBundleItems(bundle, byId).map((i) => ({ productId: i.productId, quantity: String(i.quantity) })) })
    setErrors({})
    setServerError(null)
    setNotice(null)
    setPickQuery('')
  }

  const patchEditing = (patch) => {
    setEditing((current) => ({ ...current, ...patch }))
    setErrors({})
  }

  const addItem = (product) => {
    patchEditing({ items: [...editing.items, { productId: product.id, quantity: '1' }] })
    setPickQuery('')
  }

  const save = async () => {
    setServerError(null)
    const { bundle, errors: found } = checkBundleDraft(editing, bundles, editing.oldSku)
    setErrors(found)
    if (!bundle) return
    setSaving(true)
    const { error } = await repository.saveBundle({ sku: bundle.sku, items: bundle.items, oldSku: editing.oldSku })
    setSaving(false)
    if (error) {
      setServerError(`บันทึกไม่สำเร็จ: ${error}`)
      return
    }
    setNotice(`บันทึกชุด ${bundle.sku} แล้ว`)
    setEditing(null)
    setReloadSeq((n) => n + 1)
  }

  const remove = async (sku) => {
    setSaving(true)
    const { error } = await repository.removeBundle(sku)
    setSaving(false)
    if (error) {
      setServerError(`ลบไม่สำเร็จ: ${error}`)
      return
    }
    setNotice(`ลบชุด ${sku} แล้ว`)
    setEditing(null)
    setReloadSeq((n) => n + 1)
  }

  const requestClose = () => {
    if (saving) return
    if (editing) setConfirmClose(true)
    else onClose()
  }

  return (
    <>
      <ProductDialog open label="ชุดสินค้า (Bundle)" onRequestClose={requestClose} className="product-dialog bulk-issue-dialog">
        <div className="panel">
          <div className="panel-head">ชุดสินค้า (Bundle)</div>
          <div className="panel-body bulk-issue-body">
            <p className="dim bundle-intro">
              รหัสชุดใน PDF ของ seller (เช่น GL-203R-P1) ไม่ใช่สินค้าในสต็อก ตอนเบิกออกจาก PDF ระบบจะตัดชิ้นส่วนตามที่ตั้งไว้ที่นี่
              (จำนวนชิ้นส่วน × จำนวนชุดที่สั่ง)
            </p>

            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}

            {editing ? (
              <div className="bundle-editor">
                <label className="date-field">
                  <span>รหัสชุด (ตรงกับใน PDF)</span>
                  <input
                    value={editing.sku}
                    onChange={(e) => patchEditing({ sku: e.target.value })}
                    placeholder="เช่น GL-203R-P1"
                    aria-invalid={Boolean(errors.sku)}
                    disabled={saving}
                  />
                </label>
                {errors.sku && <div className="err">{errors.sku}</div>}
                {!errors.sku && productSkus.has(normalizeSku(editing.sku)) && (
                  <div className="pdf-warn-text">รหัสนี้เป็นสินค้าในสต็อกด้วย ตอนเบิกจาก PDF ถ้าสินค้านี้ยังมีสต็อกจะตัดสินค้านี้ตรง สต็อกหมดแล้วจึงแตกเป็นชิ้นส่วนตามชุดนี้</div>
                )}

                <div className="issue-search">
                  <input
                    type="search"
                    placeholder="ค้นหาชื่อ / รหัส แล้วกดเลือกสินค้าที่อยู่ในชุด"
                    aria-label="ค้นหาสินค้าในชุด"
                    value={pickQuery}
                    onChange={(e) => setPickQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (picks[0]) addItem(picks[0])
                      }
                    }}
                    disabled={saving}
                  />
                  {pickQuery.trim() !== '' && (
                    <ul className="pick-list" aria-label="ผลการค้นหา">
                      {picks.length === 0 && <li className="dim pick-empty">ไม่พบสินค้า (หรือเลือกไว้แล้ว)</li>}
                      {picks.slice(0, MAX_PICKS).map((p) => (
                        <li key={p.id}>
                          <button type="button" className="pick-item" onClick={() => addItem(p)}>
                            <span className="mono">{p.sku}</span>
                            <span className="pick-name">{p.name !== p.sku ? p.name : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {editing.items.length === 0 ? (
                  <p className="empty dim">ยังไม่มีสินค้าในชุด</p>
                ) : (
                  <table className="issue-table">
                    <thead>
                      <tr>
                        <th>สินค้าในชุด</th>
                        <th className="num">จำนวนต่อ 1 ชุด</th>
                        <th>
                          <span className="sr-only">เอาออก</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {editing.items.map((item) => {
                        const p = byId.get(item.productId)
                        return (
                          <tr key={item.productId} className={errors[item.productId] ? 'row-error' : undefined}>
                            <td>
                              <span className="mono">{p?.sku ?? '(ไม่พบสินค้า)'}</span>
                              {p && p.name !== p.sku && <div className="sub">{p.name}</div>}
                              {p && p.active === false && <div className="pdf-warn-text">สินค้านี้ถูกปิดใช้งาน ชุดนี้จะเบิกไม่ได้</div>}
                            </td>
                            <td className="num">
                              <input
                                className="qty-input"
                                inputMode="decimal"
                                aria-label={`จำนวนต่อชุด ${p?.sku ?? ''}`}
                                value={item.quantity}
                                onChange={(e) =>
                                  patchEditing({
                                    items: editing.items.map((i) => (i.productId === item.productId ? { ...i, quantity: e.target.value } : i)),
                                  })
                                }
                                aria-invalid={Boolean(errors[item.productId])}
                                disabled={saving}
                              />
                              {errors[item.productId] && <div className="err">{errors[item.productId]}</div>}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn sm"
                                aria-label={`เอา ${p?.sku ?? ''} ออกจากชุด`}
                                onClick={() => patchEditing({ items: editing.items.filter((i) => i.productId !== item.productId) })}
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
                )}
                {errors.items && <div className="err">{errors.items}</div>}
              </div>
            ) : (
              <>
                <div className="issue-top">
                  <input
                    type="search"
                    className="bundle-search"
                    placeholder="ค้นหารหัสชุด หรือรหัสชิ้นส่วน"
                    aria-label="ค้นหาชุดสินค้า"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button type="button" className="btn primary" onClick={startNew} disabled={loading || Boolean(loadError)}>
                    + เพิ่มชุดใหม่
                  </button>
                </div>
                {loading && (
                  <p className="dim" role="status">
                    กำลังโหลด…
                  </p>
                )}
                {loadError && (
                  <p className="alert form-alert" role="alert">
                    โหลดชุดสินค้าไม่สำเร็จ: {loadError}
                  </p>
                )}
                {!loading && !loadError && (
                  <div className="table-wrap">
                    <table className="issue-table">
                      <thead>
                        <tr>
                          <th>รหัสชุด</th>
                          <th>ชิ้นส่วนที่ตัดสต็อก (ต่อ 1 ชุด)</th>
                          <th>
                            <span className="sr-only">จัดการ</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownBundles.length === 0 && (
                          <tr>
                            <td colSpan={3} className="dim">
                              {bundles.length === 0 ? 'ยังไม่มีชุดสินค้า' : 'ไม่พบชุดที่ค้นหา'}
                            </td>
                          </tr>
                        )}
                        {shownBundles.map((b) => (
                          <tr key={b.sku}>
                            <td className="mono nowrap">{b.sku}</td>
                            <td>{bundleSummary(b, byId)}</td>
                            <td className="nowrap">
                              <button type="button" className="btn sm" onClick={() => startEdit(b)}>
                                แก้ไข
                              </button>{' '}
                              <button type="button" className="btn sm" onClick={() => setConfirmDelete(b.sku)} disabled={saving}>
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {serverError && (
              <p className="alert form-alert" role="alert">
                {serverError}
              </p>
            )}
          </div>
          <div className="form-actions spread">
            <span className="dim issue-hint">{bundles.length} ชุด</span>
            <span className="issue-buttons">
              {editing ? (
                <>
                  <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
                    ยกเลิก
                  </button>
                  <button type="button" className="btn primary" onClick={save} disabled={saving}>
                    {saving ? 'กำลังบันทึก…' : 'บันทึกชุด'}
                  </button>
                </>
              ) : (
                <button type="button" className="btn" onClick={onClose}>
                  ปิด
                </button>
              )}
            </span>
          </div>
        </div>
      </ProductDialog>
      <ConfirmDialog
        request={
          confirmDelete
            ? {
                title: `ลบชุด ${confirmDelete}?`,
                message: 'ลบแค่การตั้งค่าชุด สต็อกและประวัติไม่เปลี่ยน แต่ PDF ที่มีรหัสนี้จะเบิกไม่ได้จนกว่าจะตั้งชุดใหม่',
                confirmLabel: 'ลบชุด',
                danger: true,
              }
            : null
        }
        onAnswer={(ok) => {
          const sku = confirmDelete
          setConfirmDelete(null)
          if (ok) remove(sku)
        }}
      />
      <ConfirmDialog
        request={
          confirmClose
            ? { title: 'ปิดหน้าต่างนี้?', message: 'ชุดที่กำลังแก้ไขยังไม่ได้บันทึก', confirmLabel: 'ปิดโดยไม่บันทึก', danger: true }
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
