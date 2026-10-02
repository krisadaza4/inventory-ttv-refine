import { formatQuantity } from '../lib/numberFormat.js'
import { MOVEMENT_TYPE, getStockStatus } from '../lib/stockRules.js'
import ProductThumb from './ProductThumb.jsx'
import SortHead from './SortHead.jsx'
import StockBadge from './StockBadge.jsx'

// ตารางสินค้าคงคลัง (เรียงมาแล้วจากหน้าที่เรียกใช้ กดหัวคอลัมน์เพื่อเปลี่ยนการเรียง) hide-sm = ซ่อนบนมือถือ
export default function ProductTable({ products, imageUrls, onMove, sort, onSort }) {
  const head = { sort, onSort }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="thumb-col">รูป</th>
            <SortHead sortKey="sku" {...head}>
              รหัส
            </SortHead>
            <SortHead sortKey="name" {...head}>
              ชื่อสินค้า
            </SortHead>
            <SortHead sortKey="category" className="hide-sm" {...head}>
              หมวดหมู่
            </SortHead>
            <SortHead sortKey="onHand" className="num" {...head}>
              คงเหลือ
            </SortHead>
            <SortHead
              sortKey="repairQty"
              className="num hide-sm"
              title="สินค้ารอซ่อม (ไม่นับในคงเหลือ เบิกไม่ได้)"
              {...head}
            >
              รอซ่อม
            </SortHead>
            <th className="hide-sm">หน่วย</th>
            <SortHead sortKey="reorderPoint" className="num hide-sm" {...head}>
              จุดสั่งซื้อ
            </SortHead>
            <SortHead
              sortKey="avgMonthlySales"
              className="num hide-sm"
              title="ยอดขายเฉลี่ยต่อเดือนจากไฟล์สต็อก"
              {...head}
            >
              ขายเฉลี่ย/เดือน
            </SortHead>
            <SortHead sortKey="status" {...head}>
              สถานะ
            </SortHead>
            <th className="hide-sm">
              <span className="sr-only">ทำรายการ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="thumb-col">
                <ProductThumb url={imageUrls[p.imagePath]} name={p.name} size="row" />
              </td>
              <td className="mono">{p.sku}</td>
              <td>
                {p.name}
                {p.barcode && <div className="sub mono">{p.barcode}</div>}
                {p.location && <div className="sub">ที่เก็บ: {p.location}</div>}
              </td>
              <td className="hide-sm dim">{p.category}</td>
              <td className="num">
                <b>{formatQuantity(p.onHand)}</b>
                <span className="show-sm dim"> {p.unit}</span>
              </td>
              <td className="num hide-sm">{p.repairQty > 0 ? formatQuantity(p.repairQty) : '–'}</td>
              <td className="hide-sm">{p.unit}</td>
              <td className="num hide-sm dim">{formatQuantity(p.reorderPoint)}</td>
              <td className="num hide-sm">{p.avgMonthlySales === null ? '–' : formatQuantity(p.avgMonthlySales)}</td>
              <td>
                <StockBadge status={getStockStatus(p.onHand, p.reorderPoint)} />
              </td>
              <td className="num hide-sm actions">
                <button type="button" className="btn sm btn-in" onClick={() => onMove(p, MOVEMENT_TYPE.IN)}>
                  <span aria-hidden="true">＋</span> รับเข้า
                </button>
                <button
                  type="button"
                  className="btn sm btn-out"
                  onClick={() => onMove(p, MOVEMENT_TYPE.OUT)}
                  disabled={p.onHand <= 0}
                  title={p.onHand <= 0 ? 'สินค้าหมด เบิกออกไม่ได้' : undefined}
                >
                  <span aria-hidden="true">－</span> เบิกออก
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
