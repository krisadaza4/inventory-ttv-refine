const FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

// จำนวนสินค้า เช่น 1,200 หรือ 2.5 (signed: +3 / −2.5 ใช้เครื่องหมายลบแบบยาวให้อ่านง่าย)
export function formatQuantity(value, { signed = false } = {}) {
  const amount = Number(value)
  const text = FORMAT.format(Math.abs(amount))
  if (amount < 0) return `${signed ? '−' : '-'}${text}`
  return signed && amount > 0 ? `+${text}` : text
}
