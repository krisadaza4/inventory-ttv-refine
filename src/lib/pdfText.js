// อ่านข้อความพร้อมตำแหน่งจากไฟล์ PDF ในเบราว์เซอร์ (ไฟล์ไม่ถูกส่งขึ้นเซิร์ฟเวอร์)
// คืน pages = [[{ s, x, y: ระยะจากขอบบน, w }]] รูปแบบเดียวกับ fixtures ของ picklist.test.js
// โหลด pdfjs เมื่อใช้ครั้งแรกเท่านั้น (ไลบรารีใหญ่ ไม่รวมในหน้าแรก)
let pdfjsPromise = null

function loadPdfjs() {
  pdfjsPromise ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    },
  )
  return pdfjsPromise
}

const round = (n) => Math.round(n * 10) / 10

export async function readPdfPages(file) {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  try {
    const pages = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const { height } = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      pages.push(
        content.items
          .filter((item) => typeof item.str === 'string' && item.str.trim() !== '')
          .map((item) => ({ s: item.str, x: round(item.transform[4]), y: round(height - item.transform[5]), w: round(item.width) })),
      )
    }
    return pages
  } finally {
    await doc.destroy()
  }
}
