// อ่าน CHANGELOG.md สำหรับหน้าต่าง "มีอะไรใหม่" และจำเวอร์ชันที่เครื่องนี้ติ๊ก "ไม่แสดงอีก" ไว้
export const ROADMAP_TITLE = 'อัพเดทถัดไป'
export const CHANGELOG_SEEN_KEY = 'inventory-ttv:changelog-hidden'

const VERSION = /^v(\d+\.\d+\.\d+)/
const DATE = /(\d{4}-\d{2}-\d{2})/

// ตัด markdown ที่ใช้บ่อยในรายการ (ตัวหนา, โค้ด) ให้เหลือข้อความ
const plain = (text) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()

// { roadmap: [ข้อความ], releases: [{ title, version, date, items }] } เรียงตามไฟล์ (ใหม่ก่อน)
export function parseChangelog(markdown) {
  const roadmap = []
  const releases = []
  let current = null
  const text = String(markdown ?? '').replace(/<!--[\s\S]*?-->/g, '')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      const title = heading[1].trim()
      if (title === ROADMAP_TITLE) {
        current = { roadmap: true }
      } else {
        current = {
          title,
          version: title.match(VERSION)?.[1] ?? null,
          date: title.match(DATE)?.[1] ?? null,
          items: [],
        }
        releases.push(current)
      }
      continue
    }
    const item = line.match(/^[-*]\s+(.+)$/)
    if (!item || !current) continue
    if (current.roadmap) roadmap.push(plain(item[1]))
    else current.items.push(plain(item[1]))
  }
  return { roadmap, releases }
}

// เทียบเลขเวอร์ชัน X.Y.Z: คืน <0, 0, >0 (null ถือว่าเก่าสุด)
export function compareVersions(a, b) {
  if (a === b) return 0
  if (!a) return -1
  if (!b) return 1
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

// เปิดหน้าต่างเองทุกครั้งที่เพิ่งเข้าสู่ระบบ ยกเว้นติ๊ก "ไม่แสดงอีก" ไว้ที่เวอร์ชันนี้ (หรือใหม่กว่า) แล้ว
// seen = เวอร์ชันที่ติ๊ก "ไม่แสดงอีก" ไว้ล่าสุด
export function shouldShowChangelog(seen, current, freshLogin = true) {
  return freshLogin && Boolean(current) && compareVersions(current, seen) > 0
}

// เวอร์ชันที่ติดป้าย "ใหม่": ใหม่กว่าที่ติ๊กไม่แสดงไว้ ไม่เคยติ๊กเลย = เฉพาะเวอร์ชันปัจจุบัน
export function isNewRelease(release, seen, current) {
  if (!release.version || compareVersions(release.version, current) > 0) return false
  return seen ? compareVersions(release.version, seen) > 0 : release.version === current
}

export function readSeenVersion(storage = globalThis.localStorage) {
  try {
    const saved = storage.getItem(CHANGELOG_SEEN_KEY)
    return /^\d+\.\d+\.\d+$/.test(saved ?? '') ? saved : null
  } catch {
    return null
  }
}

// version = null คือเอาติ๊ก "ไม่แสดงอีก" ออก บันทึกไม่ได้ก็ไม่เป็นไร แค่จะเห็นหน้าต่างอีกครั้ง
export function saveSeenVersion(version, storage = globalThis.localStorage) {
  try {
    if (version) storage.setItem(CHANGELOG_SEEN_KEY, version)
    else storage.removeItem(CHANGELOG_SEEN_KEY)
  } catch {
    // ไม่จำค่า
  }
}
