import { ROLE } from '../lib/roles.js'
import { THEME } from '../lib/theme.js'

export const APP_NAME = 'Inventory TTV'
export const APP_SUBTITLE = 'ระบบบริหารสต็อกสินค้า'

const ROLE_LABEL = {
  [ROLE.ADMIN]: 'เจ้าของร้าน (admin)',
  [ROLE.STAFF]: 'พนักงาน (staff)',
}

// ปุ่มสลับธีมบอกสิ่งที่จะเกิดเมื่อกด
export function ThemeToggle({ theme, onToggle }) {
  return (
    <button type="button" className="tb-btn" onClick={onToggle}>
      {theme === THEME.DARK ? 'โหมดสว่าง' : 'โหมดมืด'}
    </button>
  )
}

export default function TitleBar({ profile, theme, onToggleTheme, signingOut, onSignOut }) {
  return (
    <header className="titlebar">
      <div className="brand">
        {APP_NAME} <small>{APP_SUBTITLE}</small>
      </div>
      <div className="who">
        {profile.displayName}
        <small>{ROLE_LABEL[profile.role] ?? profile.role}</small>
      </div>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button type="button" className="tb-btn" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
      </button>
    </header>
  )
}
