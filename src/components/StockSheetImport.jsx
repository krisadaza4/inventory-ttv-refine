import { useEffect, useRef, useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { resizeImage } from '../lib/productImages.js'
import {
  STOCK_SHEET_DEFAULTS,
  imageTypeOf,
  openingNote,
  parseStockSheet,
  planStockImport,
  readSheetImages,
  skuKey,
} from '../lib/stockSheetImport.js'
import { MOVEMENT_TYPE } from '../lib/stockRules.js'
import { openZip } from '../lib/zipReader.js'
import ProductThumb from './ProductThumb.jsx'

const PREVIEW_ROWS = 10
const LIST_ROWS = 20

// นำเข้าไฟล์บันทึกรายการสินค้าคลัง (.xlsx): เพิ่มสินค้า → ปรับยอดเริ่มต้น → อัปโหลดรูปที่ฝังในไฟล์
// นำเข้าซ้ำได้: ข้ามรหัสที่มีแล้ว ไม่ปรับยอดสินค้าที่คงเหลือไม่เป็น 0 ไม่ใส่รูป/โลเคชั่นทับของที่มีอยู่แล้ว
export default function StockSheetImport({ allProducts, repository, onImported, onClose }) {
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState(null)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const zipRef = useRef(null)
  // รูปเล็กในตารางตัวอย่าง: { [path ในไฟล์]: object URL } อ่านจากไฟล์ที่เลือก ยังไม่ได้อัปโหลด
  const [previewUrls, setPreviewUrls] = useState({})

  useEffect(() => {
    if (!plan) return undefined
    const paths = [...new Set(plan.entries.slice(0, PREVIEW_ROWS).map((x) => x.imagePath).filter(Boolean))]
    const urls = {}
    let cancelled = false
    ;(async () => {
      for (const path of paths) {
        if (cancelled) break
        const type = imageTypeOf(path)
        if (!type) continue
        try {
          urls[path] = URL.createObjectURL(new Blob([await zipRef.current.read(path)], { type }))
        } catch {
          // อ่านรูปไม่ได้ แสดงกรอบว่าง
        }
      }
      // ยกเลิกระหว่างอ่าน: ลบ URL ที่สร้างหลัง cleanup ทำงานไปแล้ว
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
    setResult(null)
    setError(null)
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
        setPlan(planStockImport(items, await readSheetImages(zip, picColumn), allProducts))
      }
    } catch {
      setError('อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ Excel (.xlsx)')
    }
    setReading(false)
  }

  const uploadImage = async (product, imagePath) => {
    const type = imageTypeOf(imagePath)
    if (!type) return 'รูปชนิดนี้เปิดไม่ได้'
    const bytes = await zipRef.current.read(imagePath)
    const blob = await resizeImage(new Blob([bytes], { type }))
    const { error: uploadError } = await repository.uploadProductImage(product, blob)
    return uploadError
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    const counts = { inserted: 0, adjusted: 0, images: 0, locations: 0 }
    const failures = []

    const toInsert = plan.entries.filter((x) => !x.exists).map((x) => x.product)
    setProgress('กำลังเพิ่มสินค้า…')
    const { inserted, error: insertError } = await repository.insertProducts(toInsert)
    counts.inserted = inserted
    if (insertError) {
      setError(`เพิ่มสินค้าแล้ว ${inserted} จาก ${toInsert.length} รายการ แล้วหยุดเพราะ: ${insertError} เลือกไฟล์เดิมอีกครั้งเพื่อทำต่อ`)
      finish(counts, failures, true)
      return
    }

    const { products, error: loadError } = await repository.listProducts({ includeInactive: true })
    if (loadError) {
      setError(`โหลดรายการสินค้าไม่สำเร็จ: ${loadError} เลือกไฟล์เดิมอีกครั้งเพื่อทำต่อ`)
      finish(counts, failures, true)
      return
    }
    const bySku = new Map(products.map((p) => [skuKey(p.sku), p]))
    const today = toIsoDate(new Date())

    for (const [i, entry] of plan.entries.entries()) {
      setProgress(`กำลังบันทึกยอดและรูป ${i + 1} / ${plan.entries.length}`)
      const product = bySku.get(skuKey(entry.product.sku))
      if (!product) {
        failures.push({ sku: entry.product.sku, reason: 'ไม่พบสินค้าหลังเพิ่ม' })
        continue
      }
      if (entry.quantity > 0 && product.onHand === 0) {
        const { error: moveError } = await repository.recordMovement({
          productId: product.id,
          type: MOVEMENT_TYPE.ADJUST,
          quantity: entry.quantity,
          movementDate: today,
          note: openingNote(entry, fileName),
        })
        if (moveError) failures.push({ sku: entry.product.sku, reason: `ยอด: ${moveError}` })
        else counts.adjusted += 1
      }
      if (entry.product.location && !product.location) {
        const { error: saveError } = await repository.saveProduct({ ...product, location: entry.product.location })
        if (saveError) failures.push({ sku: entry.product.sku, reason: `โลเคชั่น: ${saveError}` })
        else counts.locations += 1
      }
      if (entry.imagePath && !product.imagePath) {
        let imageError
        try {
          imageError = await uploadImage(product, entry.imagePath)
        } catch (thrown) {
          imageError = thrown.message
        }
        if (imageError) failures.push({ sku: entry.product.sku, reason: `รูป: ${imageError}` })
        else counts.images += 1
      }
    }
    finish(counts, failures)
  }

  const finish = (counts, failures, stopped = false) => {
    setSaving(false)
    setProgress(null)
    setPlan(null)
    setResult({ ...counts, failures })
    const message = `นำเข้าจาก ${fileName}: เพิ่มสินค้า ${counts.inserted}, บันทึกยอดเริ่มต้น ${counts.adjusted}, ใส่รูป ${counts.images}, ใส่โลเคชั่น ${counts.locations} รายการ`
    // มีรายการไม่สำเร็จ เปิดหน้านี้ค้างไว้ให้เห็นรายละเอียด
    onImported(failures.length === 0 && !stopped ? message : null)
  }

  const newCount = plan ? plan.entries.filter((x) => !x.exists).length : 0
  const withImage = plan ? plan.entries.filter((x) => x.imagePath).length : 0
  const withStock = plan ? plan.entries.filter((x) => x.quantity > 0).length : 0
  const withLocation = plan ? plan.entries.filter((x) => x.product.location).length : 0

  return (
    <div className="panel import-panel">
      <div className="panel-head">
        นำเข้าไฟล์สต็อก (รูป + ยอดคงเหลือ)
        <button type="button" className="btn sm" onClick={onClose} disabled={saving}>
          ปิด
        </button>
      </div>
      <div className="panel-body stack">
        <p className="hint">
          ใช้ไฟล์ "บันทึกรายการสินค้าคลัง" (.xlsx) ที่มีคอลัมน์ รายการสินค้า, Pic, ของดีพร้อมขาย, สินค้ารอซ่อม, ยอดรวมสินค้า, โลเคชั่น
          รหัสใช้เป็นชื่อสินค้า หน่วย "{STOCK_SHEET_DEFAULTS.unit}" หมวดหมู่ "{STOCK_SHEET_DEFAULTS.category}" ยอดเริ่มต้นใช้ยอดรวม
          (บันทึกเป็นปรับยอด) แก้ข้อมูลทีหลังได้ในหน้านี้
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

        {result && result.failures.length > 0 && (
          <div className="stack">
            <p className="alert" role="alert">
              เพิ่มสินค้า {result.inserted}, บันทึกยอด {result.adjusted}, ใส่รูป {result.images}, ใส่โลเคชั่น {result.locations} รายการ แต่ไม่สำเร็จ{' '}
              {result.failures.length} รายการ เลือกไฟล์เดิมอีกครั้งเพื่อทำส่วนที่เหลือ
            </p>
            <ul className="sub">
              {result.failures.slice(0, LIST_ROWS).map((x, i) => (
                <li key={i}>
                  <span className="mono">{x.sku}</span>: {x.reason}
                </li>
              ))}
              {result.failures.length > LIST_ROWS && <li>…และอีก {result.failures.length - LIST_ROWS} รายการ</li>}
            </ul>
          </div>
        )}

        {plan && (
          <>
            <div className="stats">
              <div className="panel stat">
                <span>สินค้าในไฟล์ (ใหม่ / มีแล้ว)</span>
                <b>
                  {newCount} / {plan.entries.length - newCount}
                </b>
              </div>
              <div className="panel stat">
                <span>มีรูป / มียอด &gt; 0 / มีโลเคชั่น</span>
                <b>
                  {withImage} / {withStock} / {withLocation}
                </b>
              </div>
              <div className={plan.invalid.length > 0 ? 'panel stat out' : 'panel stat'}>
                <span>แถวที่ไม่นำเข้า</span>
                <b>{plan.invalid.length}</b>
              </div>
            </div>

            {plan.invalid.length > 0 && (
              <details>
                <summary>ดูแถวที่ไม่นำเข้า ({plan.invalid.length})</summary>
                <ul className="sub">
                  {plan.invalid.slice(0, LIST_ROWS).map((x) => (
                    <li key={x.row}>
                      แถว {x.row} <span className="mono">{x.sku}</span>: {x.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {plan.entries.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>รหัส</th>
                      <th className="num">ดี</th>
                      <th className="num">รอซ่อม</th>
                      <th className="num">ยอดรวม</th>
                      <th className="hide-sm">โลเคชั่น</th>
                      <th>รูป</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.entries.slice(0, PREVIEW_ROWS).map((x) => (
                      <tr key={x.product.sku}>
                        <td className="mono">{x.product.sku}</td>
                        <td className="num">{x.good}</td>
                        <td className="num">{x.repair}</td>
                        <td className="num">{x.quantity}</td>
                        <td className="hide-sm">{x.product.location || '–'}</td>
                        <td>
                          <ProductThumb url={previewUrls[x.imagePath]} name={x.product.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {plan.entries.length > PREVIEW_ROWS && (
                  <div className="table-foot">ตัวอย่าง {PREVIEW_ROWS} รายการแรก จาก {plan.entries.length}</div>
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
                disabled={saving || plan.entries.length === 0}
              >
                {saving ? 'กำลังนำเข้า…' : `ยืนยันนำเข้า ${plan.entries.length} รายการ`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
