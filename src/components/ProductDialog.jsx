import { useEffect, useRef } from 'react'

// หน้าต่างกลางจอสำหรับฟอร์มสินค้า ใช้ <dialog> ของเบราว์เซอร์ (showModal กันคลิก/โฟกัสหน้าหลัง)
// ปิดได้ด้วย ✕, Esc หรือคลิกพื้นที่นอกกล่อง ทุกทางผ่าน onRequestClose (ให้หน้าเรียกใช้ถามยืนยันได้)
export default function ProductDialog({ open, label, onRequestClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="product-dialog"
      aria-label={label}
      onCancel={(e) => {
        // Esc: ไม่ปิดเอง ให้หน้าเรียกใช้ตัดสินใจ (อาจมีข้อมูลยังไม่บันทึก)
        e.preventDefault()
        onRequestClose()
      }}
      onMouseDown={(e) => {
        // กล่องไม่มี padding: คลิกโดนตัว dialog เอง = คลิกที่ฉากหลัง
        if (e.target === e.currentTarget) onRequestClose()
      }}
    >
      {open && (
        <>
          <button type="button" className="dialog-close" aria-label="ปิด" onClick={onRequestClose}>
            ✕
          </button>
          {children}
        </>
      )}
    </dialog>
  )
}
