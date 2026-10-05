import { PAGE, getMenu } from '../lib/menu.js'

// เมนูซ้ายแสดงตามบทบาท บนมือถือ CSS ย้ายไปเป็นแถบล่าง (มีปุ่มหน้าแรกซ้ายสุด เฉพาะมือถือ)
// คลังย่อยแสดงเยื้องใต้ "สินค้าคงคลัง" (คลังใหญ่) บนมือถือซ่อน ใช้แถบเลือกคลังในหน้าสินค้าแทน
// warehouseId = คลังที่ดูอยู่ ('' = คลังใหญ่)
export default function Sidebar({ role, page, onChange, onHome, warehouses = [], warehouseId = '', onPickWarehouse }) {
  const onProducts = page === PAGE.PRODUCTS
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
          {group.items.map((item) => {
            const on = item.page === page && (item.page !== PAGE.PRODUCTS || warehouseId === '')
            // ดูคลังย่อยอยู่: "สินค้าคงคลัง" ยังเป็นเมนูที่เลือก (แถบล่างมือถือ) แต่จางลงบนคอมพิวเตอร์
            const parentOfOn = item.page === PAGE.PRODUCTS && onProducts && warehouseId !== ''
            return [
              <button
                key={item.page}
                type="button"
                className={['nav-item', (on || parentOfOn) && 'on', parentOfOn && 'parent-of-on'].filter(Boolean).join(' ')}
                data-page={item.page}
                aria-current={on ? 'page' : undefined}
                title={item.label}
                onClick={() => onChange(item.page)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
                <span className="nav-short">{item.short}</span>
              </button>,
              ...(item.page === PAGE.PRODUCTS
                ? warehouses.map((w) => {
                    const subOn = onProducts && warehouseId === w.id
                    return (
                      <button
                        key={`wh-${w.id}`}
                        type="button"
                        className={subOn ? 'nav-item nav-sub on' : 'nav-item nav-sub'}
                        aria-current={subOn ? 'page' : undefined}
                        title={`คลัง ${w.name}`}
                        onClick={() => onPickWarehouse(w.id)}
                      >
                        <span className="nav-label">{w.name}</span>
                      </button>
                    )
                  })
                : []),
            ]
          })}
        </div>
      ))}
    </nav>
  )
}
