import { useEffect, useRef, useState } from 'react'
import { resizeImage } from '../lib/productImages.js'
import { imageTypeOf, parseStockSheet, planImageUpdate, readSheetImages } from '../lib/stockSheetImport.js'
import { openZip } from '../lib/zipReader.js'
import ProductThumb from './ProductThumb.jsx'

const PREVIEW_ROWS = 8
const LIST_ROWS = 20

// อัปเดตรูปจากไฟล์บันทึกรายการสินค้าคลัง (.xlsx): แทนที่รูปของสินค้าที่รหัสตรงกัน (รวมรหัสเดิม)
// ไม่เพิ่มสินค้า ไม่แตะยอด โลเคชั่น หรือยอดขาย
export default function ImageSheetUpdate({ allProducts, imageUrls, repository, onDone, onClose }) {
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState(null)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [failures, setFailures] = useState([])
  const zipRef = useRef(null)
  // รูปใหม่ในตัวอย่าง: { [path ในไฟล์]: object URL }
  const [previewUrls, setPreviewUrls] = useState({})

  useEffect(() => {
    if (!plan) return undefined
    const urls = {}
    let cancelled = false
    ;(async () => {
      for (const { imagePath } of plan.updates.slice(0, PREVIEW_ROWS)) {
        if (cancelled) break
        try {
          urls[imagePath] = URL.createObjectURL(
            new Blob([await zipRef.current.read(imagePath)], { type: imageTypeOf(imagePath) }),
          )
        } catch {
          // อ่านรูปไม่ได้ แสดงกรอบว่าง
        }
      }
      if (cancelled) Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
      else setPreviewUrls(urls)
    })()
    return () => {
      cancelled = true
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
      setPreviewUrls({})
    }
  }, [plan])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPlan(null)
    setError(null)
    setFailures([])
    setReading(true)
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const sheets = await readXlsxFile(file)
      const rows = Array.isArray(sheets[0]) ? sheets : (sheets[0]?.data ?? [])
      const { items, picColumn, error: parseError } = parseStockSheet(rows)
      if (parseError) {
        setError(parseError)
      } else {
        const zip = openZip(await file.arrayBuffer())
        zipRef.current = zip
        setPlan(planImageUpdate(items, await readSheetImages(zip, picColumn), allProducts))
      }
    } catch {
      setError('อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ Excel (.xlsx)')
    }
    setReading(false)
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    let replaced = 0
    const failed = []
    for (const [i, { product, imagePath, sku }] of plan.updates.entries()) {
      setProgress(`กำลังแทนที่รูป ${i + 1} / ${plan.updates.length}`)
      try {
        const bytes = await zipRef.current.read(imagePath)
        const blob = await resizeImage(new Blob([bytes], { type: imageTypeOf(imagePath) }))
        const { error: uploadError } = await repository.uploadProductImage(product, blob)
        if (uploadError) failed.push({ sku, reason: uploadError })
        else replaced += 1
      } catch (thrown) {
        failed.push({ sku, reason: thrown.message })
      }
    }
    setSaving(false)
    setProgress(null)
    setPlan(null)
    setFailures(failed)
    const message = `อัปเดตรูปจาก ${fileName}: แทนที่รูป ${replaced} รายการ`
    onDone(failed.length === 0 ? message : null, replaced > 0)
    if (failed.length > 0) setError(`${message} ไม่สำเร็จ ${failed.length} รายการ (ดูรายการด้านล่าง)`)
  }

  return (
    <div className="panel import-panel">
      <div className="panel-head">
        อัปเดตรูปจากไฟล์ (แทนที่รูปอย่างเดียว)
        <button type="button" className="btn sm" onClick={onClose} disabled={saving}>
          ปิด
        </button>
      </div>
      <div className="panel-body stack">
        <p className="hint">
          ใช้ไฟล์รูปแบบเดียวกับ "นำเข้าไฟล์สต็อก" (คอลัมน์ รายการสินค้า, Pic, ยอดรวมสินค้า) จับคู่ด้วยรหัสสินค้าหรือรหัสเดิม แล้วแทนที่รูปเดิม
          ไม่เพิ่มสินค้า และไม่เปลี่ยนยอด โลเคชั่น หรือยอดขาย
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
        {progress && <p role="status">{progress}</p>}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {plan && (
          <>
            <div className="stats">
              <div className="panel stat">
                <span>แทนที่รูป</span>
                <b>{plan.updates.length}</b>
              </div>
              <div className="panel stat">
                <span>ไม่มีรูปในไฟล์</span>
                <b>{plan.noImage.length}</b>
              </div>
              <div className={plan.notFound.length > 0 ? 'panel stat out' : 'panel stat'}>
                <span>ไม่พบสินค้าในระบบ</span>
                <b>{plan.notFound.length}</b>
              </div>
            </div>

            {plan.notFound.length > 0 && (
              <details>
                <summary>รหัสที่ไม่พบ ({plan.notFound.length})</summary>
                <ul>
                  {plan.notFound.slice(0, LIST_ROWS).map((sku) => (
                    <li key={sku} className="mono">
                      {sku}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {plan.updates.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="thumb-col">รูปเดิม</th>
                      <th className="thumb-col">รูปใหม่</th>
                      <th>รหัส</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.updates.slice(0, PREVIEW_ROWS).map((u) => (
                      <tr key={u.product.id}>
                        <td className="thumb-col">
                          <ProductThumb url={imageUrls[u.product.imagePath]} name={u.product.name} size="row" />
                        </td>
                        <td className="thumb-col">
                          <ProductThumb url={previewUrls[u.imagePath]} name={u.product.name} size="row" />
                        </td>
                        <td className="mono">{u.sku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan.updates.length > PREVIEW_ROWS && (
                  <p className="hint">ตัวอย่าง {PREVIEW_ROWS} รายการแรก จาก {plan.updates.length} รายการ</p>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirm}
                disabled={saving || plan.updates.length === 0}
              >
                แทนที่รูป {plan.updates.length} รายการ
              </button>
            </div>
          </>
        )}

        {failures.length > 0 && (
          <details open>
            <summary>รายการที่ไม่สำเร็จ ({failures.length})</summary>
            <ul>
              {failures.slice(0, LIST_ROWS).map((f) => (
                <li key={f.sku}>
                  <span className="mono">{f.sku}</span>: {f.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  )
}
