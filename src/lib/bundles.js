import { normalizeSku } from './pdfIssue.js'

// ตรวจฟอร์มชุดสินค้าก่อนบันทึก (ฐานข้อมูลตรวจซ้ำใน save_product_bundle)
// draft = { sku, items: [{ productId, quantity: ข้อความ }] } bundles = ชุดที่มีอยู่ oldSku = รหัสเดิมเมื่อแก้ไข (null = เพิ่มใหม่)
// คืน { bundle: { sku, items: [{ productId, quantity: ตัวเลข }] } | null, errors: { sku?, items?, [productId]? } }
export function checkBundleDraft(draft, bundles, oldSku = null) {
  const errors = {}
  const sku = normalizeSku(draft.sku)
  if (sku === '') errors.sku = 'กรุณาใส่รหัสชุด'
  else if (sku.length > 100) errors.sku = 'รหัสชุดยาวเกิน 100 ตัวอักษร'
  else if (sku !== normalizeSku(oldSku) && bundles.some((b) => normalizeSku(b.sku) === sku)) errors.sku = 'รหัสชุดนี้มีอยู่แล้ว'

  const items = []
  if (draft.items.length === 0) errors.items = 'เลือกสินค้าในชุดอย่างน้อย 1 รายการ'
  for (const item of draft.items) {
    const text = String(item.quantity ?? '').trim()
    const quantity = Number(text)
    if (text === '' || !Number.isFinite(quantity) || quantity <= 0) errors[item.productId] = 'จำนวนต้องมากกว่า 0'
    else if (!/^\d+(\.\d{1,2})?$/.test(text)) errors[item.productId] = 'ทศนิยมไม่เกิน 2 ตำแหน่ง'
    else items.push({ productId: item.productId, quantity })
  }
  if (Object.keys(errors).length > 0) return { bundle: null, errors }
  return { bundle: { sku, items }, errors }
}

// สรุปชิ้นส่วนเป็นข้อความสั้น เช่น "GL-203R, VLP-889A, LGT001-P1 ×2"
export function bundleSummary(bundle, productsById) {
  return bundle.items
    .map((item) => {
      const sku = productsById.get(item.productId)?.sku ?? '(ไม่พบสินค้า)'
      return item.quantity === 1 ? sku : `${sku} ×${item.quantity}`
    })
    .join(', ')
}
