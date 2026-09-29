import { useState } from 'react'
import { formatThaiDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { canAdjust } from '../lib/roles.js'
import { MOVEMENT_TYPE, getStockStatus, quantityAfter, searchProducts, validateMovement } from '../lib/stockRules.js'
import PageHead from './PageHead.jsx'
import StockBadge from './StockBadge.jsx'

const TYPE_LABEL = {
  [MOVEMENT_TYPE.IN]: 'รับเข้า',
  [MOVEMENT_TYPE.OUT]: 'เบิกออก',
  [MOVEMENT_TYPE.ADJUST]: 'ปรับยอด',
}

// ข้อความผิดพลาดสีแดงใต้ช่อง
function FieldError({ id, message }) {
  if (!message) return null
  return (
    <div className="err" id={id}>
      {message}
    </div>
  )
}

// หน้ารับเข้า / เบิกออก (design.md ข้อ 7) intent = สินค้าและประเภทที่เลือกมาจากตารางสินค้า
export default function MovementPage({ products, loadState, role, today, intent, repository, onSaved }) {
  const [productQuery, setProductQuery] = useState('')
  const [productId, setProductId] = useState(intent?.productId ?? '')
  const [type, setType] = useState(intent?.type ?? MOVEMENT_TYPE.IN)
  const [quantity, setQuantity] = useState('')
  const [movementDate, setMovementDate] = useState(today)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [notice, setNotice] = useState(null)

  const types = canAdjust(role) ? Object.values(MOVEMENT_TYPE) : [MOVEMENT_TYPE.IN, MOVEMENT_TYPE.OUT]
  const product = products.find((p) => p.id === productId) ?? null
  // สินค้าที่เลือกอยู่แสดงเสมอ แม้ไม่ตรงคำค้น
  const options = searchProducts(products, productQuery)
  const shownOptions = product && !options.includes(product) ? [product, ...options] : options
  const after = product ? quantityAfter(product.onHand, type, quantity) : null
  const productError = errors.productId

  const clearForm = () => {
    setQuantity('')
    setNote('')
    setMovementDate(today)
    setErrors({})
    setServerError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setNotice(null)
    setServerError(null)
    const movement = { productId, type, quantity, movementDate, note }
    const found = product ? validateMovement(movement, product.onHand, role, today) : {}
    if (!product) found.productId = 'กรุณาเลือกสินค้า'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    const { error } = await repository.recordMovement(movement)
    setSubmitting(false)
    if (error) {
      setServerError(error)
      return
    }
    setNotice(
      `บันทึก${TYPE_LABEL[type]} ${product.name} ${formatQuantity(quantity, { signed: type === MOVEMENT_TYPE.ADJUST })} ${product.unit} แล้ว`,
    )
    clearForm()
    onSaved()
  }

  return (
    <>
      <PageHead page={PAGE.MOVE} title="บันทึกรับเข้า / เบิกออก" />

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <form className="panel" onSubmit={handleSubmit} noValidate>
        <div className="panel-head">รายละเอียดรายการ</div>
        {serverError && (
          <p className="alert form-alert" role="alert">
            บันทึกไม่สำเร็จ: {serverError}
          </p>
        )}

        <div className="panel-body form-grid">
          <label className="req" htmlFor="move-product">
            สินค้า
          </label>
          <div className="stack">
            <input
              type="search"
              placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด"
              aria-label="ค้นหาสินค้า"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <select
              id="move-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={loadState !== 'ready'}
              aria-invalid={Boolean(productError)}
              aria-describedby={productError ? 'move-product-err' : undefined}
            >
              <option value="">
                {loadState === 'loading' ? 'กำลังโหลดรายการสินค้า…' : `— เลือกสินค้า (${shownOptions.length} รายการ) —`}
              </option>
              {shownOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name} (คงเหลือ {formatQuantity(p.onHand)} {p.unit})
                </option>
              ))}
            </select>
            <FieldError id="move-product-err" message={productError} />
          </div>

          <span className="label req" id="move-type-label">
            ประเภท
          </span>
          <div>
            <div className="radio" role="radiogroup" aria-labelledby="move-type-label">
              {types.map((t) => (
                <label key={t}>
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />{' '}
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
            <FieldError message={errors.type} />
          </div>

          <label className="req" htmlFor="move-qty">
            จำนวน
          </label>
          <div>
            <input
              id="move-qty"
              className="short"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby="move-qty-hint"
            />{' '}
            <span className="dim">{product?.unit}</span>
            <div className="hint" id="move-qty-hint">
              {type === MOVEMENT_TYPE.ADJUST
                ? 'ใส่ค่าบวกเพื่อเพิ่ม หรือค่าลบเพื่อลด ทศนิยมไม่เกิน 2 ตำแหน่ง'
                : 'ทศนิยมไม่เกิน 2 ตำแหน่ง'}
            </div>
            <FieldError message={errors.quantity} />
          </div>

          <label className="req" htmlFor="move-date">
            วันที่
          </label>
          <div>
            <input
              id="move-date"
              type="date"
              className="short"
              max={today}
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              aria-invalid={Boolean(errors.movementDate)}
            />{' '}
            <span className="hint">{formatThaiDate(movementDate)} · ห้ามเลือกวันในอนาคต</span>
            <FieldError message={errors.movementDate} />
          </div>

          <label className={type === MOVEMENT_TYPE.ADJUST ? 'req' : undefined} htmlFor="move-note">
            หมายเหตุ
          </label>
          <div>
            <textarea
              id="move-note"
              rows={2}
              placeholder={type === MOVEMENT_TYPE.ADJUST ? 'การปรับยอดต้องระบุเหตุผล' : 'เช่น ขายหน้าร้าน'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(errors.note)}
            />
            <FieldError message={errors.note} />
          </div>

          <span className="label">ผลลัพธ์</span>
          <div className="preview" aria-live="polite">
            {product ? (
              <>
                <span>
                  คงเหลือตอนนี้ <b>{formatQuantity(product.onHand)}</b>
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  หลังบันทึก <b>{after === null ? '–' : formatQuantity(after)}</b> {product.unit}
                </span>
                {after !== null &&
                  (after < 0 ? (
                    <span className="badge out">ติดลบ บันทึกไม่ได้</span>
                  ) : (
                    <StockBadge status={getStockStatus(after, product.reorderPoint)} />
                  ))}
              </>
            ) : (
              <span className="dim">เลือกสินค้าเพื่อดูคงเหลือ</span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={clearForm} disabled={submitting}>
            ล้างข้อมูล
          </button>
          <button type="submit" className="btn primary" disabled={submitting || loadState !== 'ready'}>
            {submitting ? 'กำลังบันทึก…' : 'บันทึกรายการ'}
          </button>
        </div>
      </form>
    </>
  )
}
