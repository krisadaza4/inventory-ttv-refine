// ยอดขายรายเดือน (ค่าจากไฟล์สต็อก) จัดเป็นตาราง สินค้า × 12 เดือน
// year ในข้อมูลเป็น ค.ศ. หน้าจอแสดง พ.ศ.

export const MONTH_LABELS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export const toBuddhistYear = (year) => year + 543
// ปีในไฟล์อาจเป็น พ.ศ. (2569) หรือ ค.ศ. (2026)
export const toGregorianYear = (year) => (year > 2400 ? year - 543 : year)

const round2 = (n) => Math.round(n * 100) / 100

// ปีที่มีข้อมูล ล่าสุดก่อน
export function salesYears(sales) {
  return [...new Set(sales.map((s) => s.year))].sort((a, b) => b - a)
}

// แถวละสินค้า: months[0..11] เป็นตัวเลขหรือ null (ไม่มีข้อมูล)
// เฉลี่ย/เดือน = รวม ÷ 12 ตามสูตรในไฟล์ของร้าน
// สินค้าที่ไม่มียอดในปีนั้นเลยไม่แสดง
export function buildSalesRows(products, sales, year) {
  const byProduct = new Map()
  for (const s of sales) {
    if (s.year !== year) continue
    if (!byProduct.has(s.productId)) byProduct.set(s.productId, Array(12).fill(null))
    byProduct.get(s.productId)[s.month - 1] = s.quantity
  }
  const rows = []
  for (const product of products) {
    const months = byProduct.get(product.id)
    if (!months) continue
    const total = round2(months.reduce((sum, q) => sum + (q ?? 0), 0))
    rows.push({ product, months, total, average: round2(total / 12) })
  }
  return rows
}

// key: 'sku' | 'total' | 'average' | 'm1'..'m12', dir: 'asc' | 'desc'
export function sortSalesRows(rows, key, dir) {
  const value = (row) => {
    if (key === 'sku') return row.product.sku
    if (key === 'total' || key === 'average') return row[key]
    return row.months[Number(key.slice(1)) - 1] ?? -1
  }
  const sign = dir === 'desc' ? -1 : 1
  return rows.toSorted((a, b) => {
    const va = value(a)
    const vb = value(b)
    const cmp = typeof va === 'string' ? va.localeCompare(vb, 'th') : va - vb
    return cmp * sign || a.product.sku.localeCompare(b.product.sku, 'th')
  })
}
