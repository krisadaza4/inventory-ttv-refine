import { STOCK_STATUS } from '../lib/stockRules.js'

const STOCK_LABEL = {
  [STOCK_STATUS.OUT]: 'หมด',
  [STOCK_STATUS.LOW]: 'ใกล้หมด',
  [STOCK_STATUS.OK]: 'ปกติ',
}

// ป้ายสถานะมีข้อความกำกับเสมอ ไม่พึ่งสีอย่างเดียว
export default function StockBadge({ status }) {
  return <span className={`badge ${status}`}>{STOCK_LABEL[status]}</span>
}
