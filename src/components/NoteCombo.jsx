import { useEffect, useRef, useState } from 'react'

// ช่องพิมพ์ + ลูกศรเลือกตัวเลือกสำเร็จรูป (ทำเองแทน <datalist> เพราะรายการของ datalist เพี้ยนตำแหน่งเมื่ออยู่ใน <dialog>)
// รายการลอยแบบ fixed ใต้ช่อง จึงไม่ถูกตารางที่เลื่อนได้ตัดทิ้ง
export default function NoteCombo({ value, onChange, options, placeholder, ariaLabel, maxLength, disabled, invalid, className = '' }) {
  const [rect, setRect] = useState(null)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const open = () => {
    if (disabled || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    setRect({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 140) })
  }
  const close = () => setRect(null)

  useEffect(() => {
    if (!rect) return undefined
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [rect])

  return (
    <div className="note-combo" ref={wrapRef}>
      <input
        ref={inputRef}
        className={`note-input ${className}`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={open}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && rect) {
            e.stopPropagation()
            close()
          }
        }}
        disabled={disabled}
        aria-invalid={invalid}
        autoComplete="off"
      />
      <button
        type="button"
        className="note-combo-arrow"
        tabIndex={-1}
        aria-label="เลือกหมายเหตุสำเร็จรูป"
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault()
          if (rect) close()
          else {
            inputRef.current?.focus()
            open()
          }
        }}
      >
        ▾
      </button>
      {rect && (
        <ul className="note-menu" style={{ left: rect.left, top: rect.top, width: rect.width }} role="listbox">
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                className="pick-item"
                role="option"
                aria-selected={value === o}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(o)
                  close()
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
