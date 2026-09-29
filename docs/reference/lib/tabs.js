import { STATUS, getLoanStatus } from './loanRules.js'

// Tab ในแถบเมนูด้านล่าง (design.md ข้อ 7 ปรับ UI เฟส 9)
export const TAB = {
  ACTIVE: 'active',
  RETURNED: 'returned',
  ADD: 'add',
}

// สถานะที่แต่ละ Tab แสดง เรียงกลุ่มตามลำดับนี้ (Tab เพิ่มไม่มีรายการ)
export const TAB_STATUSES = {
  [TAB.ACTIVE]: [STATUS.OVERDUE, STATUS.OUTSTANDING],
  [TAB.RETURNED]: [STATUS.RETURNED],
}

// นับ Loan ตามสถานะของวันนี้ ใช้กับการ์ดสรุปและตัวเลขบน Tab
export function countByStatus(loans, today) {
  const counts = { [STATUS.OVERDUE]: 0, [STATUS.OUTSTANDING]: 0, [STATUS.RETURNED]: 0 }
  for (const loan of loans) counts[getLoanStatus(loan, today)] += 1
  return counts
}
