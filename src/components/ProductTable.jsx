import { formatQuantity } from '../lib/numberFormat.js'
import { MOVEMENT_TYPE, getStockStatus } from '../lib/stockRules.js'
import ProductThumb from './ProductThumb.jsx'
import StockBadge from './StockBadge.jsx'

// ตารางสินค้าคงคลัง (เรียงมาแล้วจากหน้าที่เรียกใช้) hide-sm = ซ่อนบนมือถือ
export default function ProductTable({ products, imageUrls, onMove }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="thumb-col">รูป</th>
            <th>รหัส</th>
            <th>ชื่อสินค้า</th>
            <th className="hide-sm">หมวดหมู่</th>
            <th className="num">คงเหลือ</th>
            <th className="num hide-sm" title="สินค้ารอซ่อม (ไม่นับในคงเหลือ เบิกไม่ได้)">
              รอซ่อม
            </th>
            <th className="hide-sm">หน่วย</th>
            <th className="num hide-sm">จุดสั่งซื้อ</th>
            <th className="num hide-sm" title="ยอดขายเฉลี่ยต่อเดือนจากไฟล์สต็อก">
              ขายเฉลี่ย/เดือน
            </th>
            <th>สถานะ</th>
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
                <button type="button" className="btn sm" onClick={() => onMove(p, MOVEMENT_TYPE.IN)}>
                  รับเข้า
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => onMove(p, MOVEMENT_TYPE.OUT)}
                  disabled={p.onHand <= 0}
                  title={p.onHand <= 0 ? 'สินค้าหมด เบิกออกไม่ได้' : undefined}
                >
                  เบิกออก
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
