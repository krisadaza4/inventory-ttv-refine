// อีเมลของเจ้าของที่เข้าสู่ระบบอยู่ (ตัวเล็กในส่วนหัว) และปุ่มออกจากระบบ
export default function AccountBar({ email, signingOut, onSignOut }) {
  return (
    <div className="account-bar">
      <span className="account-email">เข้าสู่ระบบเป็น {email}</span>
      <button type="button" className="ghost-button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
      </button>
    </div>
  )
}
