import { TAB } from '../lib/tabs.js'

// แถบเมนูด้านล่างจอ 3 Tab (ค้างคืน / คืนแล้ว / เพิ่ม)
// activeCount = จำนวนค้างคืน, hasOverdue = มีรายการเกินกำหนด (ตัวเลขเป็นสีแดง)
export default function TabBar({ tab, editing, activeCount, returnedCount, hasOverdue, onChange }) {
  const tabs = [
    { id: TAB.ACTIVE, icon: '📦', label: 'ค้างคืน', count: activeCount, alert: hasOverdue },
    { id: TAB.RETURNED, icon: '✅', label: 'คืนแล้ว', count: returnedCount },
    { id: TAB.ADD, icon: editing ? '✏️' : '➕', label: editing ? 'แก้ไข' : 'เพิ่ม' },
  ]

  return (
    <nav className="tab-bar" aria-label="เมนูหลัก">
      <div role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="tab-panel"
            className="tab"
            onClick={() => onChange(item.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="tab-label">{item.label}</span>
            {item.count > 0 && (
              <span className={`tab-count${item.alert ? ' tab-count-alert' : ''}`}>{item.count}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}
