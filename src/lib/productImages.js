// รูปสินค้า: ย่อในเบราว์เซอร์ก่อนอัปโหลด (design.md ข้อ 7.2)

export const IMAGE_BUCKET = 'product-images'
export const MAX_IMAGE_SIDE = 800
export const IMAGE_QUALITY = 0.8
// signed URL ของรูปใช้ได้ 1 ชั่วโมง โหลดสินค้าใหม่เมื่อไรได้ URL ใหม่
export const IMAGE_URL_TTL = 60 * 60

// ไฟล์ต้นฉบับจากกล้องมือถือใหญ่ได้ แต่เกินนี้ไม่น่าใช่รูปถ่ายสินค้า
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export const IMAGE_ERROR = {
  NOT_IMAGE: 'กรุณาเลือกไฟล์รูปภาพ',
  TOO_LARGE: 'ไฟล์รูปใหญ่เกิน 20MB',
  CANNOT_READ: 'เปิดรูปนี้ไม่ได้ กรุณาใช้รูป JPG หรือ PNG',
}

export function checkImageFile(file) {
  if (!file || !String(file.type).startsWith('image/')) return IMAGE_ERROR.NOT_IMAGE
  if (file.size > MAX_SOURCE_BYTES) return IMAGE_ERROR.TOO_LARGE
  return null
}

// ขนาดหลังย่อ: ด้านยาวไม่เกิน MAX_IMAGE_SIDE คงสัดส่วน ไม่ขยายรูปเล็ก
export function scaledSize(width, height, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

// ชื่อไฟล์ใหม่ทุกครั้งที่เปลี่ยนรูป เพื่อไม่ให้เบราว์เซอร์แสดงรูปเก่าจาก cache
export function imagePathFor(productId, now = Date.now()) {
  return `${productId}/${now}.jpg`
}

// ย่อรูปเป็น JPEG ด้วย canvas (ใช้ได้เฉพาะในเบราว์เซอร์ ไม่มีเทสต์อัตโนมัติ)
export async function resizeImage(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(IMAGE_ERROR.CANNOT_READ)
  }
  const { width, height } = scaledSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // พื้นขาวแทนส่วนโปร่งใสของ PNG (JPEG ไม่มีโปร่งใส)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
  if (!blob) throw new Error(IMAGE_ERROR.CANNOT_READ)
  return blob
}
