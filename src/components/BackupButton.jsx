import { useState } from 'react'
import { toIsoDate } from '../lib/dateFormat.js'
import { backupSheets, exportFileName } from '../lib/spreadsheet.js'

// สำรองข้อมูล (admin): ดึงสินค้า (รวมที่ปิดใช้งาน) ประวัติ และยอดขายรายเดือนทั้งหมด แล้วบันทึกเป็น Excel ไฟล์เดียว
// Supabase แบบฟรีไม่มีสำรองอัตโนมัติ ให้กดเก็บไว้เป็นระยะ
// onBackedUp(วันที่ YYYY-MM-DD) เรียกเมื่อบันทึกไฟล์สำเร็จ ใช้จำวันสำรองล่าสุด
export default function BackupButton({ repository, onBackedUp }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  const handleClick = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const [productsResult, movementsResult, salesResult] = await Promise.all([
        repository.listProducts({ includeInactive: true }),
        repository.listAllMovements(),
        repository.listMonthlySales(),
      ])
      const failed = productsResult.error ?? movementsResult.error ?? salesResult.error
      if (failed) {
        setError(`ดึงข้อมูลไม่สำเร็จ: ${failed}`)
      } else {
        const sheets = backupSheets({
          products: productsResult.products,
          movements: movementsResult.movements,
          sales: salesResult.sales,
        })
        const { default: writeExcelFile } = await import('write-excel-file/browser')
        const today = toIsoDate(new Date())
        await writeExcelFile(sheets).toFile(exportFileName('backup', today))
        onBackedUp?.(today)
        setDone(
          `สำรองแล้ว: สินค้า ${productsResult.products.length} / ประวัติ ${movementsResult.movements.length} / ยอดขาย ${salesResult.sales.length} แถว`,
        )
      }
    } catch {
      setError('สร้างไฟล์สำรองไม่สำเร็จ กรุณาลองใหม่')
    }
    setBusy(false)
  }

  return (
    <span className="export">
      <button
        type="button"
        className="btn btn-backup"
        onClick={handleClick}
        disabled={busy}
        title="ดาวน์โหลดสินค้า ประวัติ และยอดขายทั้งหมดเป็นไฟล์ Excel"
      >
        <span aria-hidden="true">⤓</span> {busy ? 'กำลังสำรอง…' : 'สำรองข้อมูล'}
      </button>
      {error && (
        <span className="err" role="alert">
          {error}
        </span>
      )}
      {done && (
        <span className="hint" role="status">
          {done}
        </span>
      )}
    </span>
  )
}
