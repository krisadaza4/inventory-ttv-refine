import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatThaiDate, toIsoDate } from '../lib/dateFormat.js'
import { THAI_MONTH_NAMES, THAI_WEEKDAYS, isSelectable, monthGrid, parseMonth, shiftMonth } from '../lib/thaiCalendar.js'

const POPUP_WIDTH = 284
const POPUP_HEIGHT = 340

// ช่องเลือกวันที่ของแอป แสดงแบบ "1 ต.ค. 2569" ปฏิทินชื่อเดือนไทย ปี พ.ศ. เหมือนกันทุกเครื่อง
// (แทน <input type="date"> ที่แสดงตามภาษาเครื่อง เช่น 10/01/2026)
// value / onChange เป็น 'YYYY-MM-DD' (ค.ศ.) ว่าง = ไม่ได้เลือก, min / max จำกัดวันที่เลือกได้
// clearable = มีปุ่ม "ล้าง" ในปฏิทิน (ใช้กับตัวกรอง ไม่ใช้กับช่องที่ต้องมีค่า)
// ปฏิทินใช้ position fixed เพราะ .panel ตัดส่วนที่ล้นกรอบ (overflow hidden)
export default function ThaiDateInput({
  value,
  onChange,
  min,
  max,
  id,
  ariaLabel,
  placeholder = 'เลือกวันที่',
  clearable = false,
  invalid = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(null)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const popupRef = useRef(null)
  const today = toIsoDate(new Date())

  const openPicker = () => {
    setView(parseMonth(value) ?? parseMonth(max && today > max ? max : today))
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  // วางปฏิทินใต้ช่อง ถ้าที่ด้านล่างไม่พอให้ขึ้นด้านบน ไม่ล้นขอบขวา
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom >= POPUP_HEIGHT + 8
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - POPUP_WIDTH - 8)),
      top: below ? r.bottom + 4 : Math.max(8, r.top - POPUP_HEIGHT - 4),
    })
  }, [open])

  // คลิกนอกปฏิทิน / Esc / เลื่อนหน้า / ปรับขนาดจอ: ปิด
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (popupRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      close(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const onScroll = (e) => {
      if (!popupRef.current?.contains(e.target)) close(false)
    }
    const onResize = () => close(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const pick = (iso) => {
    onChange(iso)
    close()
  }

  const canPrev = view && (!min || `${String(view.year)}-${String(view.month).padStart(2, '0')}` > min.slice(0, 7))
  const canNext = view && (!max || `${String(view.year)}-${String(view.month).padStart(2, '0')}` < max.slice(0, 7))

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`thai-date ${value ? '' : 'empty'} ${className}`.trim()}
        aria-label={ariaLabel ? `${ariaLabel}${value ? ` ${formatThaiDate(value)}` : ''}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? close() : openPicker())}
      >
        <span>{value ? formatThaiDate(value) : placeholder}</span>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </button>

      {open && view && pos && (
        <div
          ref={popupRef}
          className="thai-cal"
          role="dialog"
          aria-label="เลือกวันที่"
          style={{ left: pos.left, top: pos.top, width: POPUP_WIDTH }}
        >
          <div className="thai-cal-head">
            <button
              type="button"
              className="thai-cal-nav"
              aria-label="เดือนก่อน"
              disabled={!canPrev}
              onClick={() => setView(shiftMonth(view, -1))}
            >
              ‹
            </button>
            <b>
              {THAI_MONTH_NAMES[view.month - 1]} {view.year + 543}
            </b>
            <button
              type="button"
              className="thai-cal-nav"
              aria-label="เดือนถัดไป"
              disabled={!canNext}
              onClick={() => setView(shiftMonth(view, 1))}
            >
              ›
            </button>
          </div>
          <table className="thai-cal-grid">
            <thead>
              <tr>
                {THAI_WEEKDAYS.map((d) => (
                  <th key={d} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(view).map((week) => (
                <tr key={week.find(Boolean)}>
                  {week.map((iso, i) =>
                    iso ? (
                      <td key={iso}>
                        <button
                          type="button"
                          className={`thai-cal-day${iso === value ? ' selected' : ''}${iso === today ? ' today' : ''}`}
                          disabled={!isSelectable(iso, { min, max })}
                          aria-label={formatThaiDate(iso)}
                          aria-pressed={iso === value}
                          onClick={() => pick(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </td>
                    ) : (
                      <td key={`e${i}`} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="thai-cal-foot">
            <button
              type="button"
              className="btn sm"
              disabled={!isSelectable(today, { min, max })}
              onClick={() => pick(today)}
            >
              วันนี้
            </button>
            {clearable && value && (
              <button type="button" className="btn sm" onClick={() => pick('')}>
                ล้าง
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
