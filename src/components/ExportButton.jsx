import { useState } from 'react'

// ปุ่มส่งออก Excel: buildSheet คืน { sheetData } หรือ { error } (async ได้)
// โหลด write-excel-file เมื่อกดเท่านั้น หน้าแรกจะได้ไม่ช้าลง
// ไอคอน Excel แบบปัจจุบัน: แผ่นงานเขียวไล่ระดับ 4 แถบ + กล่องเขียวเข้มตัว X ด้านซ้าย
function ExcelIcon() {
  return (
    <svg className="excel-icon" viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
      <path d="M10 4h18a2 2 0 0 1 2 2v5H10z" fill="#7ddcaa" />
      <path d="M10 11h10v7H10z" fill="#5cc98f" />
      <path d="M20 11h10v7H20z" fill="#4bb37e" />
      <path d="M10 18h20v5H10z" fill="#3f9e6c" />
      <path d="M10 23h20v3a2 2 0 0 1-2 2H10z" fill="#3f9e6c" />
      <path d="M10 18h10v10H10z" fill="#4bb37e" />
      <rect x="2" y="9" width="14" height="14" rx="2" fill="#2e9a62" />
      <path d="M5.6 12.5h2.3L9 14.9l1.1-2.4h2.3l-2.2 3.5 2.3 3.5h-2.4L9 17.1l-1.1 2.4H5.5l2.3-3.5z" fill="#fff" />
    </svg>
  )
}

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
      <button type="button" className="btn btn-excel" onClick={handleClick} disabled={disabled || busy}>
        <ExcelIcon />
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
