// จำ signed URL ของรูปสินค้าไว้ใช้ซ้ำ (2026-11-24)
// เดิมขอ URL ใหม่ทั้งหมดทุกครั้งที่โหลดสินค้าใหม่ (หลังบันทึกทุกรายการ) token ใน URL เปลี่ยน เบราว์เซอร์จึงโหลดรูปซ้ำทุกครั้ง
// ตอนนี้ใช้ URL เดิมจนเหลืออายุน้อยกว่า REFRESH_MARGIN_MS แล้วค่อยขอใหม่ ขอเฉพาะรูปที่ยังไม่มี URL หรือใกล้หมดอายุ
export const REFRESH_MARGIN_MS = 10 * 60 * 1000

// cache = Map(path -> { url, expiresAt }) paths = รูปที่ต้องใช้ตอนนี้
// คืน { urls: { path: url } ที่ใช้ซ้ำได้, toSign: [path ที่ต้องขอใหม่] }
export function planImageUrls(cache, paths, now = Date.now(), margin = REFRESH_MARGIN_MS) {
  const urls = {}
  const toSign = []
  for (const path of new Set(paths)) {
    const hit = cache.get(path)
    if (hit && hit.expiresAt - now > margin) urls[path] = hit.url
    else toSign.push(path)
  }
  return { urls, toSign }
}

// เก็บ URL ที่เพิ่งขอมา (อายุ ttlSeconds) ลง cache และลบรูปที่ไม่ใช้แล้ว
export function rememberImageUrls(cache, signed, paths, ttlSeconds, now = Date.now()) {
  const expiresAt = now + ttlSeconds * 1000
  for (const [path, url] of Object.entries(signed)) cache.set(path, { url, expiresAt })
  const keep = new Set(paths)
  for (const path of [...cache.keys()]) if (!keep.has(path)) cache.delete(path)
  return cache
}

// URL ชุดใหม่ต่างจากชุดเดิมไหม (เท่ากัน = ไม่ต้อง setState ให้ตารางวาดใหม่)
export function sameUrls(a, b) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}
