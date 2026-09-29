import { THEME } from '../lib/theme.js'

// ปุ่มไอคอนสลับโหมดมืด/สว่าง ชื่อปุ่มบอกสิ่งที่จะเกิดเมื่อกด
export default function ThemeToggle({ theme, onToggle }) {
  const label = theme === THEME.DARK ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'
  return (
    <button type="button" className="icon-button" onClick={onToggle} aria-label={label} title={label}>
      <span aria-hidden="true">{theme === THEME.DARK ? '☀️' : '🌙'}</span>
    </button>
  )
}
