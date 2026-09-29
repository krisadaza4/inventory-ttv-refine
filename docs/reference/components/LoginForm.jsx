import { useState } from 'react'
import { toThaiError } from '../lib/supabaseErrors.js'

const EMPTY_FIELDS = 'กรุณากรอกอีเมลและรหัสผ่าน'

// หน้าเข้าสู่ระบบของเจ้าของ ไม่มีลิงก์สมัครสมาชิก (บัญชีสร้างโดยผู้ดูแลระบบ)
// เข้าสู่ระบบสำเร็จแล้ว App รู้เองจาก onAuthStateChange
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
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <h2>เข้าสู่ระบบ</h2>

      <label>
        อีเมล
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label>
        รหัสผ่าน
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && (
        <ul role="alert">
          <li>{error}</li>
        </ul>
      )}

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </form>
  )
}
