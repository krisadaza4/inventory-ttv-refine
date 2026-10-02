import { useEffect, useState } from 'react'
import { CHECK_INTERVAL_MS, fetchLatestVersion, isNewVersion } from '../lib/appVersion.js'

// แจ้งเมื่อมีเวอร์ชันใหม่: ตรวจทุก 5 นาที และทุกครั้งที่กลับมาที่แท็บ/แอปนี้ (ไม่ตรวจตอนพัฒนาในเครื่อง)
export default function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return undefined
    let stopped = false
    const check = async () => {
      const latest = await fetchLatestVersion()
      if (!stopped && isNewVersion(__APP_VERSION__, latest)) setHasUpdate(true)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!hasUpdate) return null
  return (
    <div className="update-banner" role="status">
      <span>มีเวอร์ชันใหม่ของโปรแกรม</span>
      <button type="button" className="btn primary sm" onClick={() => window.location.reload()}>
        รีเฟรชเลย
      </button>
    </div>
  )
}
