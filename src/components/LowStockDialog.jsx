import { useState } from 'react'
import { formatThaiDate } from '../lib/dateFormat.js'
import { lowStockFileName, selectLowStock, stockRatio } from '../lib/lowStock.js'
import { renderLowStockImage } from '../lib/lowStockImage.js'
import { formatQuantity } from '../lib/numberFormat.js'
import { productSheet } from '../lib/spreadsheet.js'
import { listCategories } from '../lib/stockRules.js'
import ExportButton from './ExportButton.jsx'
import ProductDialog from './ProductDialog.jsx'
import ProductThumb from './ProductThumb.jsx'

// หน้าต่าง "สรุปสินค้าใกล้หมด" (หน้าสินค้าคงคลัง): การ์ดสินค้าที่คงเหลือ ≤ จุดสั่งซื้อ บันทึกเป็นรูป PNG หรือ Excel ได้
// ทุกบทบาทใช้ได้ (ดูอย่างเดียว) products = สินค้าที่เปิดใช้งาน
export default function LowStockDialog({ products, imageUrls, today, onClose }) {
  const [category, setCategory] = useState('')
  const [includeOut, setIncludeOut] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const { items, low, out, total } = selectLowStock(products, { category, includeOut })
  const categories = listCategories(products)
  const percent = total > 0 ? ((low / total) * 100).toFixed(1) : '0.0'
  const scope = category || 'ทุกหมวดหมู่'

  const saveImage = async () => {
    setSaving(true)
    setError(null)
    try {
      const blob = await renderLowStockImage(items, imageUrls, {
        title: `สรุปสินค้าใกล้หมด (${items.length} รายการ)`,
        subtitle: `${formatThaiDate(today)} · ${scope}${includeOut ? ' · รวมสินค้าที่หมดแล้ว' : ''} · ใกล้หมด ${low} / หมด ${out} จาก ${total} รายการ`,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = lowStockFileName(today, 'png')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (thrown) {
      setError(`บันทึกรูปไม่สำเร็จ: ${thrown.message}`)
    }
    setSaving(false)
  }

  return (
    <ProductDialog open label="สรุปสินค้าใกล้หมด" onRequestClose={onClose} className="product-dialog low-stock-dialog">
      <div className="panel">
        <div className="panel-head">
          <span>
            <span aria-hidden="true">⚠</span> สรุปสินค้าใกล้หมด ({items.length} รายการ)
          </span>
        </div>
        <div className="panel-body">
          <div className="low-summary">
            <div className="low-stat low">
              <span>ใกล้หมด</span>
              <b>{low}</b>
            </div>
            <div className="low-stat out">
              <span>หมด</span>
              <b>{out}</b>
            </div>
            <div className="low-stat">
              <span>สัดส่วนใกล้หมด</span>
              <b>{percent}%</b>
              <small>
                {low} จาก {total} รายการ
              </small>
            </div>
          </div>

          <div className="issue-top">
            <label className="date-field">
              <span>หมวดหมู่</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={includeOut} onChange={(e) => setIncludeOut(e.target.checked)} /> รวมสินค้าที่หมดแล้ว (
              {out})
            </label>
          </div>

          {items.length === 0 ? (
            <p className="empty dim">ไม่มีสินค้าใกล้หมด{category ? `ในหมวด ${category}` : ''} 🎉</p>
          ) : (
            <ul className="low-grid" aria-label="สินค้าใกล้หมด">
              {items.map((p) => (
                <li key={p.id} className={`low-card ${p.status}`}>
                  <ProductThumb url={imageUrls[p.imagePath]} name={p.name} size="lg" />
                  <b className="mono">{p.sku}</b>
                  {p.name !== p.sku && <span className="low-name">{p.name}</span>}
                  <span className="low-badge">{p.status === 'out' ? 'หมด' : `คงเหลือ ${formatQuantity(p.onHand)} ${p.unit}`}</span>
                  <span className="low-bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(stockRatio(p) * 100)}%` }} />
                  </span>
                  <small className="dim">
                    จุดสั่งซื้อ {formatQuantity(p.reorderPoint)} · ขายเฉลี่ย{' '}
                    {p.avgMonthlySales === null ? '–' : formatQuantity(p.avgMonthlySales)}/เดือน
                  </small>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="alert form-alert" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="form-actions spread">
          <span className="dim issue-hint">ใกล้หมด = คงเหลือไม่เกินจุดสั่งซื้อ</span>
          <span className="issue-buttons">
            <ExportButton
              fileName={lowStockFileName(today, 'xlsx')}
              sheetName="สินค้าใกล้หมด"
              buildSheet={() => ({ sheetData: productSheet(items) })}
              disabled={items.length === 0}
            />
            <button type="button" className="btn primary" onClick={saveImage} disabled={saving || items.length === 0}>
              {saving ? 'กำลังสร้างรูป…' : '💾 บันทึกเป็นรูปภาพ'}
            </button>
          </span>
        </div>
      </div>
    </ProductDialog>
  )
}
