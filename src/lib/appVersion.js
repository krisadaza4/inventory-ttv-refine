// ตรวจว่ามีเวอร์ชันใหม่ deploy แล้วหรือยัง (แทนการให้ผู้ใช้กด Ctrl+F5 เอง)
export const VERSION_URL = '/version.json'
export const CHECK_INTERVAL_MS = 5 * 60 * 1000

// ดึงรหัสเวอร์ชันล่าสุดจากเซิร์ฟเวอร์ ไม่ใช้ cache อ่านไม่ได้ (ออฟไลน์ ฯลฯ) คืน null
export async function fetchLatestVersion(fetchFn = globalThis.fetch) {
  try {
    const response = await fetchFn(VERSION_URL, { cache: 'no-store' })
    if (!response.ok) return null
    const { version } = await response.json()
    return typeof version === 'string' && version ? version : null
  } catch {
    return null
  }
}

// มีเวอร์ชันใหม่เมื่ออ่านค่าได้และไม่ตรงกับที่ฝังในหน้านี้
export function isNewVersion(current, latest) {
  return Boolean(current) && Boolean(latest) && current !== latest
}
