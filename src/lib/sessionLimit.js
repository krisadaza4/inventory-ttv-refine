// บังคับเข้าสู่ระบบใหม่ทุก 12 ชั่วโมง นับจากเวลาเข้าสู่ระบบล่าสุดที่เซิร์ฟเวอร์บันทึก (user.last_sign_in_at)
// ต่ออายุ token อัตโนมัติไม่เปลี่ยนค่านี้ จึงนับจากการกรอกรหัสผ่านครั้งล่าสุดจริง
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000
export const SESSION_EXPIRED_MESSAGE = 'ครบ 12 ชั่วโมงนับจากเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'
// setTimeout รอได้ไม่เกินค่านี้ (ประมาณ 24.8 วัน)
const MAX_TIMEOUT_MS = 2 ** 31 - 1

// เวลาที่เหลือก่อนต้องเข้าสู่ระบบใหม่ (ms) ≤ 0 = หมดแล้ว, อ่านเวลาไม่ได้ คืน null (ไม่บังคับ)
export function msUntilRelogin(lastSignInAt, now = Date.now(), maxMs = SESSION_MAX_MS) {
  const signedIn = Date.parse(lastSignInAt ?? '')
  if (Number.isNaN(signedIn)) return null
  return signedIn + maxMs - now
}

// ระยะเวลาสำหรับ setTimeout (ไม่ติดลบ ไม่เกินที่เบราว์เซอร์รับได้)
export function reloginTimeout(remainingMs) {
  return Math.min(Math.max(remainingMs, 0), MAX_TIMEOUT_MS)
}
