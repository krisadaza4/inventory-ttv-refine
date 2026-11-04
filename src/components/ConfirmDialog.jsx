import ProductDialog from './ProductDialog.jsx'

// หน้าต่างยืนยันในแอป ใช้แทน window.confirm (บางเบราว์เซอร์/หน้าต่างในแอปบล็อก confirm แล้วตอบ "ยกเลิก" ทันที)
// request = { title, message, confirmLabel, danger } หรือ null (ปิด)
// onAnswer(true) = ยืนยัน, onAnswer(false) = ยกเลิก / ✕ / Esc / คลิกนอกกล่อง
export default function ConfirmDialog({ request, onAnswer }) {
  return (
    <ProductDialog
      open={request !== null}
      label={request?.title ?? 'ยืนยัน'}
      onRequestClose={() => onAnswer(false)}
      className="product-dialog confirm-dialog"
    >
      {request && (
        <div className="panel">
          <div className="panel-head">{request.title}</div>
          <div className="panel-body confirm-body">{request.message}</div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => onAnswer(false)}>
              ยกเลิก
            </button>
            <button
              type="button"
              className={request.danger ? 'btn btn-cancel' : 'btn primary'}
              onClick={() => onAnswer(true)}
              autoFocus
            >
              {request.confirmLabel ?? 'ยืนยัน'}
            </button>
          </div>
        </div>
      )}
    </ProductDialog>
  )
}
