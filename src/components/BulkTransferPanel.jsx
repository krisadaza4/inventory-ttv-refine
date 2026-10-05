import { useState } from 'react'
import { formatThaiDate } from '../lib/dateFormat.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { MOVEMENT_TYPE, searchProducts } from '../lib/stockRules.js'
import { planBulkMovements, quantityIn } from '../lib/warehouses.js'
import ProductThumb from './ProductThumb.jsx'

// บันทึกหลายรายการในครั้งเดียว ใส่จำนวนในตาราง กดบันทึกครั้งเดียว
// type = in: รับเข้าคลังใหญ่ (warehouse = null) เช่น ของเข้าจากโรงงานหลายรุ่น
// type = transfer_in: โอนเข้าคลังย่อย warehouse (เช่น ประกอบเสร็จหลายรุ่น)
// บันทึกทีละรายการผ่าน record_movement รายการไหนผิดพลาดหยุดทันที รายการก่อนหน้าบันทึกไปแล้ว
// products = สินค้าที่เปิดใช้งานทั้งหมด (โอนเข้าแล้วสินค้าจะแสดงในคลังนั้นเอง)
export default function BulkTransferPanel({
  type = MOVEMENT_TYPE.TRANSFER_IN,
  warehouse = null,
  products,
  imageUrls,
  role,
  today,
  repository,
  onSaved,
  onClose,
}) {
  const receive = type === MOVEMENT_TYPE.IN
  const verb = receive ? 'รับเข้า' : 'โอนเข้า'
  const warehouseId = receive ? '' : warehouse.id
  const [query, setQuery] = useState('')
  // เริ่มที่สินค้าที่แสดงในคลังนี้ ติ๊กออกเพื่อเลือกจากสินค้าทั้งหมดในคลังใหญ่
  const [onlyListed, setOnlyListed] = useState(true)
  const [quantities, setQuantities] = useState({})
  const [movementDate, setMovementDate] = useState(today)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)

  // รับเข้าเลือกได้จากสินค้าทั้งหมดเสมอ
  const listed = receive ? products : products.filter((p) => p.warehouseIds?.includes(warehouseId))
  const rows = searchProducts(onlyListed ? listed : products, query).toSorted((a, b) => a.sku.localeCompare(b.sku, 'th'))
  const filled = Object.values(quantities).filter((q) => String(q).trim() !== '').length

  const setQuantity = (id, value) => {
    setQuantities((current) => ({ ...current, [id]: value }))
    setErrors((current) => {
      if (!current[id]) return current
      const { [id]: _removed, ...rest } = current
      return rest
    })
  }

  const handleSave = async () => {
    setServerError(null)
    if (!movementDate || movementDate > today) {
      setServerError('วันที่ต้องไม่เป็นวันในอนาคต')
      return
    }
    const plan = planBulkMovements(quantities, products, { type, warehouseId }, role, today)
    setErrors(plan.errors)
    if (Object.keys(plan.errors).length > 0) return
    if (plan.moves.length === 0) {
      setServerError('กรุณาใส่จำนวนอย่างน้อย 1 รายการ')
      return
    }

    setSaving(true)
    let saved = 0
    for (const move of plan.moves) {
      const { error } = await repository.recordMovement({
        productId: move.productId,
        type,
        quantity: move.quantity,
        movementDate,
        note,
        warehouseId,
      })
      if (error) {
        const product = products.find((p) => p.id === move.productId)
        setSaving(false)
        setServerError(`บันทึกได้ ${saved} จาก ${plan.moves.length} รายการ หยุดที่ ${product?.sku ?? ''}: ${error}`)
        // รายการที่บันทึกแล้วไม่ต้องใส่ซ้ำ
        setQuantities((current) => {
          const next = { ...current }
          for (const done of plan.moves.slice(0, saved)) delete next[done.productId]
          return next
        })
        if (saved > 0) onSaved(null)
        return
      }
      saved += 1
    }
    setSaving(false)
    onSaved(receive ? `รับเข้า ${saved} รายการแล้ว` : `โอนเข้าคลัง "${warehouse.name}" ${saved} รายการแล้ว`)
  }

  return (
    <div className="panel bulk-transfer">
      <div className="panel-head spread">
        <span>{receive ? 'รับเข้าคลังใหญ่หลายรายการ' : `โอนเข้าคลัง ${warehouse.name} หลายรายการ`}</span>
        <button type="button" className="btn sm" onClick={onClose} disabled={saving}>
          ปิด
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          className="grow"
          placeholder="ค้นหาชื่อ / รหัส / บาร์โค้ด"
          aria-label={`ค้นหาสินค้าที่จะ${verb}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!receive && (
          <label className="check">
            <input type="checkbox" checked={onlyListed} onChange={(e) => setOnlyListed(e.target.checked)} /> เฉพาะสินค้าที่แสดงในคลังนี้
          </label>
        )}
        <label className="check">
          วันที่{' '}
          <input
            type="date"
            className="short"
            max={today}
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
            aria-label={`วันที่${verb}`}
          />
        </label>
        <span className="hint">{formatThaiDate(movementDate)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty dim">
          {!receive && onlyListed && listed.length === 0
            ? 'ยังไม่มีสินค้าที่แสดงในคลังนี้ ติ๊กออกที่ "เฉพาะสินค้าที่แสดงในคลังนี้" เพื่อเลือกจากสินค้าทั้งหมด'
            : 'ไม่พบสินค้า'}
        </p>
      ) : (
        <div className="table-wrap bulk-transfer-table">
          <table>
            <thead>
              <tr>
                <th className="thumb-col">รูป</th>
                <th>รหัส</th>
                <th>ชื่อสินค้า</th>
                <th className="num">คลังใหญ่</th>
                <th className="num">{receive ? 'รวม' : 'ในคลังนี้'}</th>
                <th className="num">จำนวน{verb}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={errors[p.id] ? 'row-error' : undefined}>
                  <td className="thumb-col">
                    <ProductThumb url={imageUrls[p.imagePath]} name={p.name} size="row" />
                  </td>
                  <td className="mono">{p.sku}</td>
                  <td>{p.name}</td>
                  <td className="num">{formatQuantity(p.centralQty)}</td>
                  <td className="num dim">{formatQuantity(receive ? p.onHand : quantityIn(p, warehouseId))}</td>
                  <td className="num">
                    <input
                      className="qty-input"
                      inputMode="decimal"
                      aria-label={`จำนวน${verb} ${p.sku}`}
                      value={quantities[p.id] ?? ''}
                      onChange={(e) => setQuantity(p.id, e.target.value)}
                      disabled={saving || (!receive && p.centralQty <= 0)}
                      placeholder={!receive && p.centralQty <= 0 ? 'ไม่มีของ' : ''}
                      aria-invalid={Boolean(errors[p.id])}
                    />{' '}
                    <span className="dim">{p.unit}</span>
                    {errors[p.id] && <div className="err">{errors[p.id]}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-actions spread">
        <input
          className="grow"
          placeholder={receive ? 'หมายเหตุ (ไม่บังคับ) เช่น ของเข้าจากโรงงาน' : 'หมายเหตุ (ไม่บังคับ) เช่น ประกอบเสร็จ'}
          aria-label="หมายเหตุ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
        <button type="button" className="btn primary" onClick={handleSave} disabled={saving || filled === 0}>
          {saving ? 'กำลังบันทึก…' : `บันทึก${verb} ${filled} รายการ`}
        </button>
      </div>
      {serverError && (
        <p className="alert form-alert" role="alert">
          {serverError}
        </p>
      )}
    </div>
  )
}
