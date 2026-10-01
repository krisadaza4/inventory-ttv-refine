// อ่านไฟล์ zip (.xlsx คือ zip) โดยไม่ต้องเพิ่ม dependency: ใช้ central directory + DecompressionStream
// รองรับเฉพาะแบบ stored (0) และ deflate (8) ซึ่ง Excel ใช้เสมอ

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50

export const ZIP_ERROR = 'ไฟล์นี้ไม่ใช่ไฟล์ Excel (.xlsx) ที่อ่านได้'

function findEndOfCentralDirectory(view) {
  // EOCD ยาว 22 ไบต์ + comment ไม่เกิน 65535
  const stop = Math.max(0, view.byteLength - 22 - 65535)
  for (let i = view.byteLength - 22; i >= stop; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i
  }
  throw new Error(ZIP_ERROR)
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// คืน { names, has(name), read(name) → Uint8Array, readText(name) → string }
export function openZip(buffer) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(view)
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map()

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error(ZIP_ERROR)
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, { method, compressedSize, localOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  const read = async (name) => {
    const entry = entries.get(name)
    if (!entry) return null
    const at = entry.localOffset
    if (view.getUint32(at, true) !== LOCAL_SIGNATURE) throw new Error(ZIP_ERROR)
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
    const data = bytes.subarray(start, start + entry.compressedSize)
    if (entry.method === 0) return data.slice()
    if (entry.method === 8) return inflateRaw(data)
    throw new Error(ZIP_ERROR)
  }

  return {
    names: [...entries.keys()],
    has: (name) => entries.has(name),
    read,
    readText: async (name) => {
      const data = await read(name)
      return data === null ? null : decoder.decode(data)
    },
  }
}
