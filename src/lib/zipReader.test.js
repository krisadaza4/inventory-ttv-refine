import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { ZIP_ERROR, openZip } from './zipReader.js'

// สร้าง zip ขนาดเล็กเองในเทสต์ (ไม่ตรวจ CRC ใน openZip จึงใส่ 0)
function makeZip(files) {
  const encoder = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, text, method } of files) {
    const nameBytes = encoder.encode(name)
    const raw = encoder.encode(text)
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, method, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, method, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  return new Blob([...locals, ...centrals, eocd]).arrayBuffer()
}

describe('openZip', () => {
  it('อ่านไฟล์ทั้งแบบ stored และ deflate รวมชื่อภาษาไทย', async () => {
    const zip = openZip(
      await makeZip([
        { name: 'a.txt', text: 'hello', method: 0 },
        { name: 'xl/รูป.xml', text: '<x>สวัสดี</x>'.repeat(50), method: 8 },
      ]),
    )
    expect(zip.names).toEqual(['a.txt', 'xl/รูป.xml'])
    expect(zip.has('a.txt')).toBe(true)
    expect(await zip.readText('a.txt')).toBe('hello')
    expect(await zip.readText('xl/รูป.xml')).toBe('<x>สวัสดี</x>'.repeat(50))
  })

  it('ไฟล์ที่ไม่มีใน zip คืน null', async () => {
    const zip = openZip(await makeZip([{ name: 'a.txt', text: 'x', method: 0 }]))
    expect(await zip.read('none')).toBeNull()
    expect(await zip.readText('none')).toBeNull()
  })

  it('ไฟล์ที่ไม่ใช่ zip โยนข้อความไทย', () => {
    expect(() => openZip(new TextEncoder().encode('not a zip file at all, just text').buffer)).toThrow(ZIP_ERROR)
  })
})
