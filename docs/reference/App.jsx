import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import './App.css'
import AccountBar from './components/AccountBar.jsx'
import LoanForm from './components/LoanForm.jsx'
import LoanList from './components/LoanList.jsx'
import LocalImportBanner from './components/LocalImportBanner.jsx'
import LoginForm from './components/LoginForm.jsx'
import SearchBox from './components/SearchBox.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import TabBar from './components/TabBar.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import { toIsoDate } from './lib/dateFormat.js'
import { STATUS, filterLoansByFriend, markReturned, unmarkReturned } from './lib/loanRules.js'
import { TAB, TAB_STATUSES, countByStatus } from './lib/tabs.js'
import { createLoanRepository } from './lib/loanRepository.js'
import { importLegacyLoans } from './lib/localImport.js'
import { IMPORT_MARK, getImportMark, readLegacyLoans, setImportMark } from './lib/storage.js'
import { getSupabase } from './lib/supabaseClient.js'
import { toThaiError } from './lib/supabaseErrors.js'
import { getInitialTheme, saveTheme, toggleTheme } from './lib/theme.js'

function App() {
  const { client, error: configError } = getSupabase()
  // undefined = กำลังตรวจ session, null = ยังไม่เข้าสู่ระบบ
  const [session, setSession] = useState(client ? undefined : null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(null)
  const [theme, setTheme] = useState(() =>
    getInitialTheme(undefined, window.matchMedia('(prefers-color-scheme: dark)').matches),
  )

  // ตั้งธีมให้ <html> ก่อนวาดหน้าจอ เพื่อไม่ให้จอกะพริบ
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // ติดตาม session (INITIAL_SESSION ทำให้รีเฟรชแล้วยังเข้าสู่ระบบอยู่)
  // ห้ามเรียกฟังก์ชัน async ของ Supabase ใน callback นี้ ตามคำแนะนำของ supabase-js
  useEffect(() => {
    if (!client) return undefined
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  const handleToggleTheme = () => {
    const next = toggleTheme(theme)
    setTheme(next)
    saveTheme(next)
  }

  // ออกจากระบบเฉพาะเบราว์เซอร์นี้ ล้าง session ทันทีเพื่อล้าง Loan ออกจาก state
  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) setSignOutError(toThaiError(error))
      else setSession(null)
    } catch (thrown) {
      setSignOutError(toThaiError(thrown))
    }
    setSigningOut(false)
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-logo" aria-hidden="true">
              🤝
            </span>
            <h1>Borrow Buddy</h1>
            <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
          </div>
          {session && (
            <AccountBar email={session.user.email} signingOut={signingOut} onSignOut={handleSignOut} />
          )}
        </div>
      </header>

      <main className={session ? 'has-tab-bar' : undefined}>
        {configError && <p role="alert">{configError}</p>}
        {session === undefined && <p role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</p>}
        {session === null && client && <LoginForm auth={client.auth} />}
        {session && (
          <>
            {signOutError && <p role="alert">{signOutError}</p>}
            {/* key ตามบัญชีเจ้าของ: เปลี่ยนบัญชีหรือออกจากระบบแล้ว Loan เดิมถูกล้างทั้งหมด */}
            <OwnerHome key={session.user.id} ownerId={session.user.id} client={client} />
          </>
        )}
      </main>
    </>
  )
}

// หน้าหลักของเจ้าของที่เข้าสู่ระบบแล้ว Loan ทั้งหมดมาจาก Supabase
function OwnerHome({ ownerId, client }) {
  const repository = useMemo(() => createLoanRepository(client), [client])
  const [loans, setLoans] = useState([])
  // 'loading' | 'ready' | 'error'
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState(TAB.ACTIVE)
  // Tab ที่อยู่ก่อนกดแก้ไข เพื่อกลับไปหลังบันทึกหรือยกเลิก
  const [returnTab, setReturnTab] = useState(TAB.ACTIVE)

  // นำเข้าข้อมูลเดิม: อ่านครั้งเดียวตอนเปิดหน้า (อ่านอย่างเดียว ไม่แก้คีย์เดิม)
  const [legacy] = useState(readLegacyLoans)
  const [importMark, setMark] = useState(() => getImportMark(ownerId))
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importNotice, setImportNotice] = useState(null)

  const applyLoadResult = ({ loans: loaded, error }) => {
    if (error) {
      setLoadError(error)
      setLoadState('error')
    } else {
      setLoans(loaded)
      setLoadState('ready')
    }
  }

  const retryLoad = async () => {
    setLoadState('loading')
    applyLoadResult(await repository.listLoans())
  }

  // โหลดครั้งแรกหลังเข้าสู่ระบบ ไม่ใช้ผลที่มาช้าหลังออกจากระบบไปแล้ว
  useEffect(() => {
    let active = true
    repository.listLoans().then((result) => {
      if (active) applyLoadResult(result)
    })
    return () => {
      active = false
    }
  }, [repository])

  const today = toIsoDate(new Date())
  const editingLoan = loans.find((loan) => loan.id === editingId) ?? null
  const visibleLoans = filterLoansByFriend(loans, query)
  const counts = countByStatus(loans, today)

  // ส่งหนึ่งรายการไปเซิร์ฟเวอร์ แล้วใช้ค่าที่เซิร์ฟเวอร์ส่งกลับอัปเดตหน้าจอ คืน true เมื่อสำเร็จ
  const persist = async (loan) => {
    setSaving(true)
    setSaveError(null)
    const { loan: saved, error } = loan.id
      ? await repository.updateLoan(loan)
      : await repository.createLoan(loan)
    setSaving(false)
    if (error) {
      setSaveError(error)
      return false
    }
    setLoans((current) =>
      loan.id ? current.map((l) => (l.id === saved.id ? saved : l)) : [...current, saved],
    )
    return true
  }

  // บันทึกสำเร็จแล้วไปดูรายการ: แก้ไขกลับ Tab เดิม, เพิ่มใหม่ไป Tab ค้างคืน
  const handleSave = async (loan) => {
    const saved = await persist(loan)
    if (saved) {
      setEditingId(null)
      setTab(loan.id ? returnTab : TAB.ACTIVE)
    }
    return saved
  }

  const handleEdit = (loan) => {
    setReturnTab(tab)
    setEditingId(loan.id)
    setTab(TAB.ADD)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setTab(returnTab)
  }

  // เปลี่ยน Tab ระหว่างแก้ไข = เลิกแก้ไข (ฟอร์มกลับเป็นเพิ่มใหม่)
  const handleTabChange = (next) => {
    if (next !== TAB.ADD) setEditingId(null)
    setSaveError(null)
    setTab(next)
  }

  const handleMarkReturned = (loan, returnedDate) => persist(markReturned(loan, today, returnedDate))

  const handleUnmarkReturned = (loan) => persist(unmarkReturned(loan))

  const rememberImport = (mark) => {
    setMark(mark)
    return setImportMark(ownerId, mark)
  }

  const handleImport = async () => {
    setImporting(true)
    setImportError(null)
    const result = await importLegacyLoans(repository, legacy.loans)
    setImporting(false)
    if (result.error) {
      setImportError(result.error)
      return
    }
    setLoans((current) => [...current, ...result.loans])
    const markWarning = rememberImport(IMPORT_MARK.IMPORTED)
    const skipped = result.skippedCount > 0 ? ` ข้าม ${result.skippedCount} รายการที่ไม่ถูกต้องตามกติกา` : ''
    setImportNotice(`นำเข้าข้อมูลเดิมแล้ว ${result.importedCount} รายการ${skipped} ${markWarning ?? ''}`.trim())
  }

  const handleSkipImport = () => {
    setImportNotice(rememberImport(IMPORT_MARK.SKIPPED))
  }

  const showImportBanner =
    loadState === 'ready' && importMark === null && (legacy.loans.length > 0 || legacy.warning)

  return (
    <>
      {showImportBanner && (
        <LocalImportBanner
          count={legacy.loans.length}
          readWarning={legacy.warning}
          importing={importing}
          error={importError}
          onImport={handleImport}
          onSkip={handleSkipImport}
        />
      )}
      {importNotice && <p role="status">{importNotice}</p>}

      {loadState === 'ready' && <SummaryCards counts={counts} onSelect={handleTabChange} />}
      {saveError && <p role="alert">บันทึกไม่สำเร็จ: {saveError}</p>}

      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
        {tab === TAB.ADD ? (
          <LoanForm
            key={editingLoan?.id ?? 'new'}
            today={today}
            editingLoan={editingLoan}
            saving={saving || loadState !== 'ready'}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
          />
        ) : (
          <>
            <SearchBox value={query} onChange={setQuery} />
            {loadState === 'loading' && <p role="status">กำลังโหลดรายการ…</p>}
            {loadState === 'error' && (
              <div className="load-error" role="alert">
                <p>โหลดรายการไม่สำเร็จ: {loadError}</p>
                <button type="button" onClick={retryLoad}>
                  ลองใหม่
                </button>
              </div>
            )}
            {loadState === 'ready' && (
              <LoanList
                loans={visibleLoans}
                statuses={TAB_STATUSES[tab]}
                today={today}
                busy={saving}
                onMarkReturned={handleMarkReturned}
                onUnmarkReturned={handleUnmarkReturned}
                onEdit={handleEdit}
              />
            )}
          </>
        )}
      </div>

      <TabBar
        tab={tab}
        editing={editingLoan !== null}
        activeCount={counts[STATUS.OVERDUE] + counts[STATUS.OUTSTANDING]}
        returnedCount={counts[STATUS.RETURNED]}
        hasOverdue={counts[STATUS.OVERDUE] > 0}
        onChange={handleTabChange}
      />
    </>
  )
}

export default App
