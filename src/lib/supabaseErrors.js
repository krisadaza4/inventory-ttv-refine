export const ERROR_MESSAGE = {
  INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  EMAIL_NOT_CONFIRMED: 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาติดต่อเจ้าของร้าน',
  SIGNUP_DISABLED: 'ระบบปิดการสมัครสมาชิก กรุณาติดต่อเจ้าของร้าน',
  USER_BANNED: 'บัญชีนี้ถูกระงับ กรุณาติดต่อเจ้าของร้าน',
  RATE_LIMIT: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  NETWORK: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  NO_PROFILE: 'บัญชีนี้ยังไม่ได้กำหนดบทบาท กรุณาติดต่อเจ้าของร้าน',
  INVALID_TYPE: 'ประเภทรายการไม่ถูกต้อง',
  ADJUST_ADMIN_ONLY: 'ปรับยอดได้เฉพาะเจ้าของร้าน',
  INVALID_QUANTITY: 'จำนวนไม่ถูกต้อง',
  FUTURE_DATE: 'วันที่ต้องไม่เป็นวันในอนาคต',
  ADJUST_NEEDS_NOTE: 'การปรับยอดต้องระบุหมายเหตุ',
  PRODUCT_NOT_FOUND: 'ไม่พบสินค้า',
  PRODUCT_INACTIVE: 'สินค้านี้ถูกปิดใช้งานแล้ว',
  INSUFFICIENT_STOCK: 'จำนวนคงเหลือไม่พอ',
  DUPLICATE_SKU: 'รหัสสินค้านี้มีอยู่แล้ว กรุณาใช้รหัสอื่น',
  DUPLICATE_BARCODE: 'บาร์โค้ดนี้มีอยู่แล้ว กรุณาตรวจสอบอีกครั้ง',
  DUPLICATE: 'ข้อมูลนี้มีอยู่แล้ว',
  INVALID_DATA: 'ข้อมูลไม่ถูกต้องตามกติกา กรุณาตรวจสอบอีกครั้ง',
  FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไข',
  UNKNOWN: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
}

// hint จาก record_movement (supabase/schema.sql) -> ข้อความสำรองถ้าฐานข้อมูลไม่ส่งข้อความมา
const BY_HINT = {
  no_profile: ERROR_MESSAGE.NO_PROFILE,
  invalid_type: ERROR_MESSAGE.INVALID_TYPE,
  adjust_admin_only: ERROR_MESSAGE.ADJUST_ADMIN_ONLY,
  invalid_quantity: ERROR_MESSAGE.INVALID_QUANTITY,
  future_date: ERROR_MESSAGE.FUTURE_DATE,
  adjust_needs_note: ERROR_MESSAGE.ADJUST_NEEDS_NOTE,
  product_not_found: ERROR_MESSAGE.PRODUCT_NOT_FOUND,
  product_inactive: ERROR_MESSAGE.PRODUCT_INACTIVE,
  insufficient_stock: ERROR_MESSAGE.INSUFFICIENT_STOCK,
}

// code จาก Supabase Auth และ Postgres/PostgREST -> ข้อความไทย
const BY_CODE = {
  invalid_credentials: ERROR_MESSAGE.INVALID_CREDENTIALS,
  email_not_confirmed: ERROR_MESSAGE.EMAIL_NOT_CONFIRMED,
  signup_disabled: ERROR_MESSAGE.SIGNUP_DISABLED,
  user_banned: ERROR_MESSAGE.USER_BANNED,
  over_request_rate_limit: ERROR_MESSAGE.RATE_LIMIT,
  session_expired: ERROR_MESSAGE.SESSION_EXPIRED,
  session_not_found: ERROR_MESSAGE.SESSION_EXPIRED,
  refresh_token_not_found: ERROR_MESSAGE.SESSION_EXPIRED,
  refresh_token_already_used: ERROR_MESSAGE.SESSION_EXPIRED,
  PGRST301: ERROR_MESSAGE.SESSION_EXPIRED, // JWT หมดอายุ/ไม่ถูกต้อง
  PGRST116: ERROR_MESSAGE.NOT_FOUND, // .single() ไม่พบแถว (รวมกรณี RLS กรองออก)
  23514: ERROR_MESSAGE.INVALID_DATA, // check_violation
  23502: ERROR_MESSAGE.INVALID_DATA, // not_null_violation
  '22P02': ERROR_MESSAGE.INVALID_DATA, // invalid_text_representation
  22007: ERROR_MESSAGE.INVALID_DATA, // invalid_datetime_format
  22008: ERROR_MESSAGE.INVALID_DATA, // datetime_field_overflow
  42501: ERROR_MESSAGE.FORBIDDEN, // insufficient_privilege / ผิดนโยบาย RLS
}

// unique_violation: แยกจากชื่อ constraint ใน schema.sql
function duplicateMessage(error) {
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (text.includes('products_sku_unique')) return ERROR_MESSAGE.DUPLICATE_SKU
  if (text.includes('products_barcode_unique')) return ERROR_MESSAGE.DUPLICATE_BARCODE
  return ERROR_MESSAGE.DUPLICATE
}

// fetch ล้มไม่มี code ให้ตรวจ ต้องดูจากชื่อและข้อความ
const NETWORK_MESSAGE = /failed to fetch|fetch failed|networkerror|network request failed|load failed/i

function isNetworkError(error) {
  if (error.name === 'AuthRetryableFetchError') return true
  return NETWORK_MESSAGE.test(error.message ?? '')
}

// แปลงข้อผิดพลาดจาก Supabase เป็นข้อความไทย ไม่มีข้อผิดพลาดคืน null
export function toThaiError(error) {
  if (!error) return null
  // ตรวจ hint ก่อน code เพราะ no_profile/adjust_admin_only ใช้ code 42501 เหมือนกัน
  // ข้อความจาก record_movement เป็นภาษาไทยอยู่แล้ว และบางข้อมีตัวเลขคงเหลือ
  if (error.hint && BY_HINT[error.hint]) return error.message || BY_HINT[error.hint]
  if (error.code === '23505') return duplicateMessage(error)
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code]
  if (error.status === 429) return ERROR_MESSAGE.RATE_LIMIT
  if (isNetworkError(error)) return ERROR_MESSAGE.NETWORK
  return ERROR_MESSAGE.UNKNOWN
}
