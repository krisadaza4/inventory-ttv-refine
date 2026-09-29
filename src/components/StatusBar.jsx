import { formatThaiDate } from '../lib/dateFormat.js'

// productCount เป็น null ได้ (ยังไม่ได้โหลดสินค้า)
export default function StatusBar({ connected, productCount = null, today }) {
  return (
    <footer className="statusbar">
      <span role="status">
        <span className={connected ? 'dot' : 'dot off'} aria-hidden="true" />
        {connected ? 'เชื่อมต่อฐานข้อมูลแล้ว' : 'เชื่อมต่อฐานข้อมูลไม่ได้'}
      </span>
      {productCount !== null && <span>สินค้า {productCount} รายการ</span>}
      <span className="right">วันนี้ {formatThaiDate(today)}</span>
    </footer>
  )
}
