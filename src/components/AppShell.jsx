import StatusBar from './StatusBar.jsx'
import TitleBar from './TitleBar.jsx'

// โครงหน้าแบบโปรแกรม: แถบบน / เมนูซ้าย / เนื้อหา / แถบสถานะ (design.md ข้อ 7)
export default function AppShell({ titleBar, sidebar, statusBar, children }) {
  return (
    <div className="app">
      <TitleBar {...titleBar} />
      {sidebar ?? <nav className="sidebar" aria-label="เมนูหลัก" />}
      <main className="app-main">{children}</main>
      <StatusBar {...statusBar} />
    </div>
  )
}
