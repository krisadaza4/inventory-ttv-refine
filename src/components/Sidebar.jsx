import { getMenu } from '../lib/menu.js'

// เมนูซ้ายแสดงตามบทบาท บนมือถือ CSS ย้ายไปเป็นแถบล่าง
export default function Sidebar({ role, page, onChange }) {
  return (
    <nav className="sidebar" aria-label="เมนูหลัก">
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
