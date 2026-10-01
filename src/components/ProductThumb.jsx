import { useEffect, useState } from 'react'

// รูปใหญ่เต็มจอ กด Esc หรือพื้นหลังเพื่อปิด
function ImageViewer({ url, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <img src={url} alt={alt} />
      <button type="button" className="btn viewer-close" onClick={onClose}>
        ปิด
      </button>
    </div>
  )
}

// รูปเล็กของสินค้า กดดูรูปใหญ่ได้ ไม่มีรูป = กรอบว่าง (url มาจาก signImageUrls)
export default function ProductThumb({ url, name, size = 'sm' }) {
  const [open, setOpen] = useState(false)
  if (!url) return <span className={`thumb ${size} empty`} aria-hidden="true" />
  return (
    <>
      <button type="button" className={`thumb ${size}`} onClick={() => setOpen(true)} title="ดูรูปใหญ่">
        <img src={url} alt={`รูป ${name}`} loading="lazy" />
      </button>
      {open && <ImageViewer url={url} alt={`รูป ${name}`} onClose={() => setOpen(false)} />}
    </>
  )
}
