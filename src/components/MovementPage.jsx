import { useState } from 'react'
import { formatThaiDate } from '../lib/dateFormat.js'
import { PAGE } from '../lib/menu.js'
import { formatQuantity } from '../lib/numberFormat.js'
import {
  MOVEMENT_LABEL,
  MOVEMENT_TYPE,
  NOTE_REQUIRED_TYPES,
  REPAIR_REASONS,
  REPAIR_TYPES,
  TRANSFER_TYPES,
  WAREHOUSE_TYPES,
  allowedMovementTypes,
  getStockStatus,
  searchProducts,
  stockAfter,
  validateMovement,
} from '../lib/stockRules.js'
import { quantityIn, stockFor } from '../lib/warehouses.js'
import PageHead from './PageHead.jsx'
import ProductThumb from './ProductThumb.jsx'
import StockBadge from './StockBadge.jsx'

const TYPE_LABEL = MOVEMENT_LABEL

const NOTE_PLACEHOLDER = {
  [MOVEMENT_TYPE.ADJUST]: 'การปรับยอดต้องระบุเหตุผล',
  [MOVEMENT_TYPE.TO_REPAIR]: 'เหตุผลที่ส่งซ่อม เช่น สปาร์คเสีย',
  [MOVEMENT_TYPE.REPAIRED]: 'ซ่อมอะไรไป เช่น เปลี่ยนสปาร์คแล้ว',
  [MOVEMENT_TYPE.WRITE_OFF]: 'เหตุผลที่ตัดจำหน่าย เช่น ซ่อมไม่ได้',
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

// หน้ารับเข้า / เบิกออก (design.md ข้อ 7) intent = สินค้า ประเภท และคลังที่เลือกมาจากตารางสินค้า
// warehouses = คลังย่อยที่ใช้งานอยู่ เลือกคลังได้เฉพาะเบิกออก (ขายผ่านคลังย่อย) และโอน
export default function MovementPage({
  products,
  warehouses = [],
  imageUrls,
  loadState,
  role,
  today,
  intent,
  repository,
  onSaved,
}) {
  const [productQuery, setProductQuery] = useState('')
  const [productId, setProductId] = useState(intent?.productId ?? '')
  const [type, setType] = useState(intent?.type ?? MOVEMENT_TYPE.IN)
  // '' = คลังใหญ่
  const [warehouseId, setWarehouseId] = useState(intent?.warehouseId ?? '')
  const [quantity, setQuantity] = useState('')
  const [movementDate, setMovementDate] = useState(today)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [notice, setNotice] = useState(null)

  const types = allowedMovementTypes(role)
  const product = products.find((p) => p.id === productId) ?? null
  // สินค้าที่เลือกอยู่แสดงเสมอ แม้ไม่ตรงคำค้น
  const options = searchProducts(products, productQuery)
  const shownOptions = product && !options.includes(product) ? [product, ...options] : options
  // ประเภทที่ทำได้เฉพาะคลังใหญ่ ไม่ส่งคลังที่เลือกค้างไว้
  const canPickWarehouse = WAREHOUSE_TYPES.includes(type) && warehouses.length > 0
  const isTransfer = TRANSFER_TYPES.includes(type)
  // โอนกลับ: ยังไม่ได้เลือก และมีของอยู่คลังย่อยเดียว เลือกคลังนั้นให้เลย
  const holding = product ? warehouses.filter((w) => quantityIn(product, w.id) > 0) : []
  const autoSource = type === MOVEMENT_TYPE.TRANSFER_OUT && holding.length === 1 ? holding[0].id : ''
  const chosenWarehouse = canPickWarehouse ? warehouseId || autoSource : ''
  const warehouse = warehouses.find((w) => w.id === chosenWarehouse) ?? null
  const stock = product ? stockFor(product, chosenWarehouse) : null
  const after = product ? stockAfter(stock, type, quantity, chosenWarehouse) : null
  // แสดงยอดคลังใหญ่แยกเมื่อมีของอยู่ในคลังย่อย หรือเลือกคลังย่อย
  const showCentral = Boolean(product) && (product.subQty > 0 || chosenWarehouse !== '')
  const noteRequired = NOTE_REQUIRED_TYPES.includes(type)
  const isRepairType = REPAIR_TYPES.includes(type)
  // แสดงยอดรอซ่อมเมื่อเกี่ยวข้อง
  const showRepair = Boolean(product) && (isRepairType || product.repairQty > 0)
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
    const movement = { productId, type, quantity, movementDate, note, warehouseId: chosenWarehouse }
    const found = product ? validateMovement(movement, stock, role, today) : {}
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
      `บันทึก${TYPE_LABEL[type]}${warehouse ? ` (คลัง ${warehouse.name})` : ''} ${product.name} ${formatQuantity(quantity, { signed: type === MOVEMENT_TYPE.ADJUST })} ${product.unit} แล้ว`,
    )
    clearForm()
    onSaved()
  }

  return (
    <>
      <PageHead page={PAGE.MOVE} title="บันทึกรับเข้า / เบิกออก / โอน / ส่งซ่อม" />

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
                  {p.sku} · {p.name} (คงเหลือ {formatQuantity(p.onHand)}
                  {p.repairQty > 0 ? ` รอซ่อม ${formatQuantity(p.repairQty)}` : ''} {p.unit})
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

          {canPickWarehouse && (
            <>
              <label className={isTransfer ? 'req' : undefined} htmlFor="move-warehouse">
                {type === MOVEMENT_TYPE.TRANSFER_IN
                  ? 'โอนเข้าคลัง'
                  : type === MOVEMENT_TYPE.TRANSFER_OUT
                    ? 'โอนออกจากคลัง'
                    : 'ขายผ่านคลัง'}
              </label>
              <div>
                <select
                  id="move-warehouse"
                  value={chosenWarehouse}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  aria-invalid={Boolean(errors.warehouseId)}
                  aria-describedby="move-warehouse-hint"
                >
                  <option value="">
                    {type === MOVEMENT_TYPE.TRANSFER_IN
                      ? '— เลือกคลังย่อยปลายทาง —'
                      : type === MOVEMENT_TYPE.TRANSFER_OUT
                        ? '— เลือกคลังย่อยที่จะโอนออก —'
                        : 'คลังใหญ่'}
                  </option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {product ? ` (มี ${formatQuantity(quantityIn(product, w.id))})` : ''}
                    </option>
                  ))}
                </select>
                <div className="hint" id="move-warehouse-hint">
                  {type === MOVEMENT_TYPE.TRANSFER_IN
                    ? `คลังใหญ่ → ${warehouse?.name ?? 'คลังย่อย'} เช่น ประกอบเสร็จแล้ว (ยอดรวมไม่เปลี่ยน)`
                    : type === MOVEMENT_TYPE.TRANSFER_OUT
                      ? `${warehouse?.name ?? 'คลังย่อย'} → คลังใหญ่ (ปลายทางเป็นคลังใหญ่เสมอ ยอดรวมไม่เปลี่ยน)`
                      : chosenWarehouse
                        ? 'ขายผ่านคลังนี้: ตัดของในคลังนี้ก่อน ไม่พอจึงตัดคลังใหญ่'
                        : 'เบิกจากคลังใหญ่ ถ้าขายผ่าน Online / ขายส่ง ให้เลือกคลังนั้น'}
                </div>
                <FieldError message={errors.warehouseId} />
              </div>
            </>
          )}

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
                : type === MOVEMENT_TYPE.TO_REPAIR
                  ? 'ย้ายจากของดีไปรอซ่อม (เบิกไม่ได้จนกว่าจะซ่อมเสร็จ)'
                  : type === MOVEMENT_TYPE.REPAIRED
                    ? 'ย้ายจากรอซ่อมกลับเป็นของดี'
                    : type === MOVEMENT_TYPE.WRITE_OFF
                      ? 'ตัดออกจากยอดรอซ่อม (ซ่อมไม่ได้)'
                      : REPAIR_TYPES.includes(type) || type === MOVEMENT_TYPE.IN
                        ? 'ทศนิยมไม่เกิน 2 ตำแหน่ง · ทำที่คลังใหญ่'
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

          <label className={noteRequired ? 'req' : undefined} htmlFor="move-note">
            {isRepairType ? 'เหตุผล' : 'หมายเหตุ'}
          </label>
          <div>
            <textarea
              id="move-note"
              rows={2}
              placeholder={NOTE_PLACEHOLDER[type] ?? 'เช่น ขายหน้าร้าน'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(errors.note)}
            />
            {isRepairType && (
              <div className="chips" aria-label="เหตุผลที่ใช้บ่อย">
                {REPAIR_REASONS.map((reason) => (
                  <button key={reason} type="button" className="btn sm" onClick={() => setNote(reason)}>
                    {reason}
                  </button>
                ))}
              </div>
            )}
            <FieldError message={errors.note} />
          </div>

          <span className="label">ผลลัพธ์</span>
          <div className="preview" aria-live="polite">
            {product ? (
              <>
                <ProductThumb url={imageUrls[product.imagePath]} name={product.name} size="md" />
                <span>
                  คงเหลือตอนนี้ <b>{formatQuantity(product.onHand)}</b>
                </span>
                <span aria-hidden="true">→</span>
                <span>
                  หลังบันทึก <b>{after === null ? '–' : formatQuantity(after.onHand)}</b> {product.unit}
                </span>
                {showCentral && (
                  <span>
                    คลังใหญ่ <b>{formatQuantity(product.centralQty)}</b> →{' '}
                    <b>{after === null ? '–' : formatQuantity(after.central)}</b>
                  </span>
                )}
                {warehouse && (
                  <span>
                    คลัง {warehouse.name} <b>{formatQuantity(stock.warehouseQty)}</b> →{' '}
                    <b>{after === null ? '–' : formatQuantity(after.warehouse)}</b>
                  </span>
                )}
                {showRepair && (
                  <span>
                    รอซ่อม <b>{formatQuantity(product.repairQty)}</b> →{' '}
                    <b>{after === null ? '–' : formatQuantity(after.repairQty)}</b>
                  </span>
                )}
                {product.location && <span className="dim">ที่เก็บ: {product.location}</span>}
                {after !== null &&
                  (after.onHand < 0 || after.repairQty < 0 || after.central < 0 || after.warehouse < 0 ? (
                    <span className="badge out">ติดลบ บันทึกไม่ได้</span>
                  ) : (
                    <StockBadge status={getStockStatus(after.onHand, product.reorderPoint)} />
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
