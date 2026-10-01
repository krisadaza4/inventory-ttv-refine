import { getMenu } from '../lib/menu.js'

// เมนูซ้ายแสดงตามบทบาท บนมือถือ CSS ย้ายไปเป็นแถบล่าง (มีปุ่มหน้าแรกซ้ายสุด เฉพาะมือถือ)
export default function Sidebar({ role, page, onChange, onHome }) {
  return (
    <nav className="sidebar" aria-label="เมนูหลัก">
      {onHome && (
        <button type="button" className="nav-item nav-home" data-page="home" title="หน้าแรก" onClick={onHome}>
          <span className="nav-icon" aria-hidden="true">
            ⌂
          </span>
          <span className="nav-short">หน้าแรก</span>
        </button>
      )}
      {getMenu(role).map((group) => (
        <div key={group.label} className="nav-group" role="group" aria-label={group.label}>
          <div className="nav-group-label" aria-hidden="true">
            {group.label}
          </div>
          {group.items.map((item) => (
            <button
              key={item.page}
              type="button"
              className={item.page === page ? 'nav-item on' : 'nav-item'}
              data-page={item.page}
              aria-current={item.page === page ? 'page' : undefined}
              title={item.label}
              onClick={() => onChange(item.page)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              <span className="nav-short">{item.short}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
