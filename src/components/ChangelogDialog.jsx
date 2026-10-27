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

// หน้าต่าง "มีอะไรใหม่": รายการที่กำลังจะทำ + สิ่งที่เปลี่ยนในแต่ละเวอร์ชัน (จาก CHANGELOG.md)
// seen = เวอร์ชันที่เครื่องนี้เคยเห็นก่อนเปิดครั้งนี้ (ใช้ติดป้าย "ใหม่")
export default function ChangelogDialog({ open, current, seen, onClose }) {
  const recent = releases.slice(0, SHOWN)
  const older = releases.slice(SHOWN)
  return (
    <ProductDialog open={open} label="มีอะไรใหม่" onRequestClose={onClose} className="product-dialog changelog-dialog">
      <div className="panel">
        <div className="panel-head">
          มีอะไรใหม่ <span className="mono dim">v{current}</span>
        </div>
        <div className="panel-body cl-body">
          <section className="cl-roadmap">
            <h3>กำลังจะทำ</h3>
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
          <button type="button" className="btn primary" onClick={onClose}>
            รับทราบ
          </button>
        </div>
      </div>
    </ProductDialog>
  )
}
