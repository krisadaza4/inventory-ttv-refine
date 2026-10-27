import { useState } from 'react'
import changelogText from '../../CHANGELOG.md?raw'
import { isNewRelease, parseChangelog } from '../lib/changelog.js'
import { formatThaiDate } from '../lib/dateFormat.js'
import ProductDialog from './ProductDialog.jsx'

const { roadmap, releases } = parseChangelog(changelogText)
// แสดงเต็ม 3 หัวข้อล่าสุด ที่เหลือพับไว้
const SHOWN = 3

function Release({ release, isNew }) {
  return (
    <section className="cl-release">
      <h3>
        {release.version ? `v${release.version}` : release.title.split('—')[0].trim()}
        {release.date && <span className="dim cl-date">{formatThaiDate(release.date)}</span>}
        {isNew && <span className="badge ok">ใหม่</span>}
      </h3>
      <ul>
        {release.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

// หน้าต่าง "มีอะไรใหม่": รายการที่อัพเดทถัดไป + สิ่งที่เปลี่ยนในแต่ละเวอร์ชัน (จาก CHANGELOG.md)
// seen = เวอร์ชันที่ติ๊ก "ไม่แสดงอีก" ไว้ก่อนเปิดครั้งนี้ (ใช้ติดป้าย "ใหม่" และค่าเริ่มต้นของช่องติ๊ก)
// onClose(hideUntilNext) ทุกทางปิด (รับทราบ / ✕ / Esc / คลิกนอกกล่อง) ส่งค่าช่องติ๊กไปด้วย
export default function ChangelogDialog({ open, current, seen, onClose }) {
  const [hide, setHide] = useState(seen === current)
  const recent = releases.slice(0, SHOWN)
  const older = releases.slice(SHOWN)
  const close = () => onClose(hide)
  return (
    <ProductDialog open={open} label="มีอะไรใหม่" onRequestClose={close} className="product-dialog changelog-dialog">
      <div className="panel">
        <div className="panel-head">
          มีอะไรใหม่ <span className="mono dim">v{current}</span>
        </div>
        <div className="panel-body cl-body">
          <section className="cl-roadmap">
            <h3>อัพเดทถัดไป</h3>
            {roadmap.length > 0 ? (
              <ul>
                {roadmap.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="dim">ยังไม่มีรายการ</p>
            )}
          </section>
          {recent.map((r) => (
            <Release key={r.title} release={r} isNew={isNewRelease(r, seen, current)} />
          ))}
          {older.length > 0 && (
            <details className="cl-older">
              <summary>เวอร์ชันก่อนหน้า ({older.length})</summary>
              {older.map((r) => (
                <Release key={r.title} release={r} isNew={isNewRelease(r, seen, current)} />
              ))}
            </details>
          )}
        </div>
        <div className="form-actions">
          <label className="check push-left">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> ไม่แสดงอีก
            <span className="dim"> (จนกว่าจะมีเวอร์ชันใหม่)</span>
          </label>
          <button type="button" className="btn primary" onClick={close}>
            รับทราบ
          </button>
        </div>
      </div>
    </ProductDialog>
  )
}
