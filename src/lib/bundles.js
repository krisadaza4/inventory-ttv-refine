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

// เรียงชิ้นส่วน: สินค้าหลัก (รหัสชุดขึ้นต้นด้วยรหัสสินค้านั้น เช่น GL-203R ใน GL-203R-P1) ก่อน ที่เหลือเรียงตามรหัส
// ชิ้นส่วนที่ไม่พบสินค้าอยู่ท้ายสุด
export function sortBundleItems(bundle, productsById) {
  const skuOf = (item) => normalizeSku(productsById.get(item.productId)?.sku)
  const rank = (item) => {
    const sku = skuOf(item)
    if (sku === '') return -1
    return normalizeSku(bundle.sku).startsWith(`${sku}-`) ? sku.length : 0
  }
  return bundle.items.toSorted((a, b) => rank(b) - rank(a) || skuOf(a).localeCompare(skuOf(b), 'th'))
}

// สรุปชิ้นส่วนเป็นข้อความสั้น เช่น "GL-203R, LGT001-P1 ×2, VLP-889A"
export function bundleSummary(bundle, productsById) {
  return sortBundleItems(bundle, productsById)
    .map((item) => {
      const sku = productsById.get(item.productId)?.sku ?? '(ไม่พบสินค้า)'
      return item.quantity === 1 ? sku : `${sku} ×${item.quantity}`
    })
    .join(', ')
}
