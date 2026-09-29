import { useState } from 'react'
import { toThaiError } from '../lib/supabaseErrors.js'

const EMPTY_FIELDS = 'กรุณากรอกอีเมลและรหัสผ่าน'

// ไม่มีลิงก์สมัครสมาชิก (เจ้าของร้านสร้างบัญชีให้) เข้าสู่ระบบสำเร็จแล้ว App รู้เองจาก onAuthStateChange
export default function LoginForm({ auth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError(EMPTY_FIELDS)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: authError } = await auth.signInWithPassword({ email: email.trim(), password })
      setError(toThaiError(authError))
    } catch (thrown) {
      setError(toThaiError(thrown))
    }
    setSubmitting(false)
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <div className="panel-head">เข้าสู่ระบบ</div>
      <div className="panel-body">
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>อีเมล</span>
          <input
            type="email"
            autoComplete="username"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>รหัสผ่าน</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        <p className="gate-note">บัญชีผู้ใช้สร้างโดยเจ้าของร้านเท่านั้น</p>
      </div>
    </form>
  )
}
