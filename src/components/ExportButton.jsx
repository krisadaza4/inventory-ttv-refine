import { useState } from 'react'

// ปุ่มส่งออก Excel: buildSheet คืน { sheetData } หรือ { error } (async ได้)
// โหลด write-excel-file เมื่อกดเท่านั้น หน้าแรกจะได้ไม่ช้าลง
export default function ExportButton({ fileName, sheetName, buildSheet, disabled }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await buildSheet()
      if (result.error) {
        setError(result.error)
      } else {
        const { default: writeExcelFile } = await import('write-excel-file/browser')
        await writeExcelFile(result.sheetData, { sheet: sheetName, stickyRowsCount: 1 }).toFile(fileName)
      }
    } catch {
      setError('สร้างไฟล์ Excel ไม่สำเร็จ กรุณาลองใหม่')
    }
    setBusy(false)
  }

  return (
    <span className="export">
      <button type="button" className="btn" onClick={handleClick} disabled={disabled || busy}>
        {busy ? 'กำลังสร้างไฟล์…' : 'ส่งออก Excel'}
      </button>
      {error && (
        <span className="err" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
