import { useState } from 'react'
import { formatQuantity } from '../lib/numberFormat.js'
import { checkImageFile, resizeImage } from '../lib/productImages.js'
import { validateProduct } from '../lib/stockRules.js'
import ProductThumb from './ProductThumb.jsx'

const EMPTY = { sku: '', barcode: '', name: '', category: '', unit: '', reorderPoint: '0' }

const FIELDS = [
  { key: 'sku', label: 'รหัสสินค้า', required: true, placeholder: 'เช่น DR-001', className: 'mono' },
  { key: 'barcode', label: 'บาร์โค้ด', hint: 'ไม่บังคับ พิมพ์หรือยิงเครื่องสแกน', className: 'mono' },
  { key: 'name', label: 'ชื่อสินค้า', required: true },
  { key: 'category', label: 'หมวดหมู่', required: true, placeholder: 'เช่น เครื่องดื่ม', list: 'category-options' },
  { key: 'unit', label: 'หน่วย', required: true, placeholder: 'เช่น ชิ้น, กล่อง, กก.' },
  { key: 'reorderPoint', label: 'จุดสั่งซื้อ', hint: 'คงเหลือเท่านี้หรือน้อยกว่า = ใกล้หมด', inputMode: 'decimal' },
]

const toFields = (product) =>
  product
    ? {
        sku: product.sku,
        barcode: product.barcode ?? '',
        name: product.name,
        category: product.category,
        unit: product.unit,
        reorderPoint: String(product.reorderPoint),
      }
    : EMPTY

// ฟอร์มเพิ่ม/แก้ไขสินค้า product = null คือเพิ่มใหม่ (App ใส่ key ตามสินค้า ฟอร์มจึงเริ่มใหม่ทุกครั้งที่เปลี่ยน)
export default function ProductForm({ product, imageUrl, categories, repository, onSaved, onCancel }) {
  const [fields, setFields] = useState(() => toFields(product))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState(null)

  const set = (key) => (e) => setFields((current) => ({ ...current, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const found = validateProduct(fields)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    const { id, error } = await repository.saveProduct({ ...fields, id: product?.id })
    setBusy(false)
    if (error) setServerError(error)
    else onSaved(id, product ? `บันทึกการแก้ไข ${fields.name.trim()} แล้ว` : `เพิ่มสินค้า ${fields.name.trim()} แล้ว`)
  }

  // เลือกรูป/ถ่ายรูป: ย่อในเบราว์เซอร์ แล้วอัปโหลดแทนรูปเดิม
  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setServerError(null)
    const invalid = checkImageFile(file)
    if (invalid) {
      setServerError(invalid)
      return
    }
    setBusy(true)
    try {
      const blob = await resizeImage(file)
      const { error } = await repository.uploadProductImage(product, blob)
      if (error) setServerError(error)
      else onSaved(product.id, `${product.imagePath ? 'เปลี่ยน' : 'เพิ่ม'}รูป ${product.name} แล้ว`)
    } catch (thrown) {
      setServerError(thrown.message)
    }
    setBusy(false)
  }

  const handleRemoveImage = async () => {
    setServerError(null)
    setBusy(true)
    const { error } = await repository.removeProductImage(product)
    setBusy(false)
    if (error) setServerError(error)
    else onSaved(product.id, `ลบรูป ${product.name} แล้ว`)
  }

  const handleToggleActive = async () => {
    setServerError(null)
    setBusy(true)
    const { error } = await repository.setProductActive(product.id, !product.active)
    setBusy(false)
    if (error) setServerError(error)
    else onSaved(product.id, product.active ? `ปิดใช้งาน ${product.name} แล้ว` : `เปิดใช้งาน ${product.name} แล้ว`)
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">
        {product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
        {product && <span className="mono dim">{product.sku}</span>}
      </div>
      {serverError && (
        <p className="alert form-alert" role="alert">
          บันทึกไม่สำเร็จ: {serverError}
        </p>
      )}

      <div className="panel-body form-grid compact">
        {FIELDS.map((f) => (
          <div key={f.key} className="form-row">
            <label className={f.required ? 'req' : undefined} htmlFor={`product-${f.key}`}>
              {f.label}
            </label>
            <div>
              <input
                id={`product-${f.key}`}
                className={f.className}
                placeholder={f.placeholder}
                list={f.list}
                inputMode={f.inputMode}
                value={fields[f.key]}
                onChange={set(f.key)}
                aria-invalid={Boolean(errors[f.key])}
              />
              {f.hint && <div className="hint">{f.hint}</div>}
              {errors[f.key] && <div className="err">{errors[f.key]}</div>}
            </div>
          </div>
        ))}
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="form-row">
          <span className="label">รูปสินค้า</span>
          {product ? (
            <div className="image-field">
              <ProductThumb url={imageUrl} name={product.name} size="lg" />
              <div className="image-actions">
                <label className={busy ? 'btn sm disabled' : 'btn sm'}>
                  {product.imagePath ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImage} disabled={busy} />
                </label>
                <label className={busy ? 'btn sm disabled' : 'btn sm'}>
                  ถ่ายรูป
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={handleImage}
                    disabled={busy}
                  />
                </label>
                {product.imagePath && (
                  <button type="button" className="btn sm" onClick={handleRemoveImage} disabled={busy}>
                    ลบรูป
                  </button>
                )}
                <span className="hint">ย่อเหลือไม่เกิน 800px ให้อัตโนมัติ</span>
              </div>
            </div>
          ) : (
            <div className="plain hint">บันทึกสินค้าก่อน แล้วจึงเพิ่มรูปได้</div>
          )}
        </div>

        {product && (
          <div className="form-row">
            <span className="label">คงเหลือ</span>
            <div className="plain">
              {formatQuantity(product.onHand)} {product.unit}{' '}
              <span className="hint">(เปลี่ยนได้จากหน้ารับเข้า / เบิกออก)</span>
            </div>
          </div>
        )}
      </div>

      <div className="form-actions">
        {product && (
          <button type="button" className="btn push-left" onClick={handleToggleActive} disabled={busy}>
            {product.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          ยกเลิก
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}
