export const ERROR_MESSAGE = {
  INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  EMAIL_NOT_CONFIRMED: 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาติดต่อผู้ดูแลระบบ',
  SIGNUP_DISABLED: 'ระบบปิดการสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ',
  USER_BANNED: 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
  RATE_LIMIT: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  NETWORK: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  INVALID_DATA: 'ข้อมูลไม่ถูกต้องตามกติกา กรุณาตรวจสอบชื่อและวันที่',
  FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้',
  NOT_FOUND: 'ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไข',
  UNKNOWN: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
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
  22007: ERROR_MESSAGE.INVALID_DATA, // invalid_datetime_format
  22008: ERROR_MESSAGE.INVALID_DATA, // datetime_field_overflow
  42501: ERROR_MESSAGE.FORBIDDEN, // insufficient_privilege / ผิดนโยบาย RLS
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
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code]
  if (error.status === 429) return ERROR_MESSAGE.RATE_LIMIT
  if (isNetworkError(error)) return ERROR_MESSAGE.NETWORK
  return ERROR_MESSAGE.UNKNOWN
}
