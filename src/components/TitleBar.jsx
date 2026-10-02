import { ROLE } from '../lib/roles.js'
import { THEME } from '../lib/theme.js'

export const APP_NAME = 'Inventory TTV'
export const APP_SUBTITLE = 'ระบบบริหารสต็อกสินค้า'
// เลขเวอร์ชันจาก package.json (vite.config.js ฝังให้ตอน build)
export const APP_RELEASE = __APP_RELEASE__

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

// โลโก้: ยังไม่ตั้ง = กล่องสี admin กดเพื่อเลือกไฟล์รูปใหม่ได้
function Logo({ url, canChange, busy, onPick }) {
  const mark = url ? <img className="logo" src={url} alt="" /> : <span className="logo" aria-hidden="true" />
  if (!canChange) return mark
  return (
    <label className={busy ? 'logo-pick busy' : 'logo-pick'} title="คลิกเพื่อเปลี่ยนโลโก้">
      {mark}
      <span className="sr-only">เปลี่ยนโลโก้</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </label>
  )
}

export default function TitleBar({ profile, theme, onToggleTheme, signingOut, onSignOut, onHome, logo = {} }) {
  return (
    <header className="titlebar">
      <div className="brand">
        <Logo {...logo} />
        {onHome ? (
          <button type="button" className="brand-text brand-home" onClick={onHome} title="กลับหน้าแรก (สินค้าคงคลัง)">
            <span className="brand-name">
              {APP_NAME} <small>{APP_SUBTITLE}</small>
            </span>
            <span className="app-version">v{APP_RELEASE}</span>
          </button>
        ) : (
          <span className="brand-text">
            <span className="brand-name">
              {APP_NAME} <small>{APP_SUBTITLE}</small>
            </span>
            <span className="app-version">v{APP_RELEASE}</span>
          </span>
        )}
      </div>
      <div className="who">
        {profile.displayName}
        <small>{ROLE_LABEL[profile.role] ?? profile.role}</small>
      </div>
      {onHome && (
        <button type="button" className="tb-btn tb-home" onClick={onHome} title="กลับหน้าแรก (สินค้าคงคลัง)">
          <span aria-hidden="true">⌂</span> <span className="tb-text">หน้าแรก</span>
        </button>
      )}
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button type="button" className="tb-btn tb-signout" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
      </button>
    </header>
  )
}
