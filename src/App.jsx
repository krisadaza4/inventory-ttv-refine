import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import AppShell from './components/AppShell.jsx'
import HistoryPage from './components/HistoryPage.jsx'
import LoginForm from './components/LoginForm.jsx'
import ManagePage from './components/ManagePage.jsx'
import MonthlySalesPage from './components/MonthlySalesPage.jsx'
import MovementPage from './components/MovementPage.jsx'
import ProductsPage from './components/ProductsPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import { APP_NAME, APP_SUBTITLE, ThemeToggle } from './components/TitleBar.jsx'
import { toIsoDate } from './lib/dateFormat.js'
import { PAGE, getMenu } from './lib/menu.js'
import { LOGO_SIDE, checkImageFile, resizeImage } from './lib/productImages.js'
import { createRepository } from './lib/repositories.js'
import { canManageProducts } from './lib/roles.js'
import { getSupabase } from './lib/supabaseClient.js'
import { ERROR_MESSAGE, toThaiError } from './lib/supabaseErrors.js'
import { getInitialTheme, saveTheme, toggleTheme } from './lib/theme.js'

// หน้าก่อนเข้าโปรแกรม: เข้าสู่ระบบ, กำลังตรวจ, ตั้งค่าไม่ครบ, ไม่มี profile
function Gate({ children, theme, onToggleTheme }) {
  return (
    <div className="gate">
      <div className="gate-box">
        <div className="gate-brand">
          <h1>{APP_NAME}</h1>
          <p>{APP_SUBTITLE}</p>
        </div>
        {children}
        <p className="gate-note">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </p>
      </div>
    </div>
  )
}

function GateMessage({ title, children }) {
  return (
    <div className="panel">
      <div className="panel-head">{title}</div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

function App() {
  const { client, error: configError } = getSupabase()
  const repository = useMemo(() => (client ? createRepository(client) : null), [client])
  // undefined = กำลังตรวจ session, null = ยังไม่เข้าสู่ระบบ
  const [session, setSession] = useState(client ? undefined : null)
  const [theme, setTheme] = useState(() =>
    getInitialTheme(undefined, window.matchMedia('(prefers-color-scheme: dark)').matches),
  )
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(null)

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

  // ออกจากระบบเฉพาะเบราว์เซอร์นี้ ล้าง session ทันทีเพื่อล้างข้อมูลออกจาก state
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

  const gateProps = { theme, onToggleTheme: handleToggleTheme }

  if (configError) {
    return (
      <Gate {...gateProps}>
        <GateMessage title="ตั้งค่าไม่ครบ">
          <p className="alert" role="alert">
            {configError}
          </p>
        </GateMessage>
      </Gate>
    )
  }

  if (session === undefined) {
    return (
      <Gate {...gateProps}>
        <GateMessage title="กรุณารอสักครู่">
          <p role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
        </GateMessage>
      </Gate>
    )
  }

  if (session === null) {
    return (
      <Gate {...gateProps}>
        <LoginForm auth={client.auth} />
      </Gate>
    )
  }

  // key ตามผู้ใช้: เปลี่ยนบัญชีหรือออกจากระบบแล้ว state เดิมถูกล้างทั้งหมด
  return (
    <SignedIn
      key={session.user.id}
      userId={session.user.id}
      repository={repository}
      gateProps={gateProps}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      signingOut={signingOut}
      signOutError={signOutError}
      onSignOut={handleSignOut}
    />
  )
}

// เข้าสู่ระบบแล้ว: โหลด profile ก่อน ไม่มี profile = ยังไม่ได้กำหนดบทบาท
function SignedIn({ userId, repository, gateProps, theme, onToggleTheme, signingOut, signOutError, onSignOut }) {
  // undefined = กำลังโหลด
  const [profile, setProfile] = useState(undefined)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // ไม่ใช้ผลที่มาช้าหลังออกจากระบบหรือกดลองใหม่ไปแล้ว
  useEffect(() => {
    let active = true
    repository.getMyProfile(userId).then(({ profile: loaded, error }) => {
      if (!active) return
      setLoadError(error)
      setProfile(error ? undefined : loaded)
    })
    return () => {
      active = false
    }
  }, [repository, userId, attempt])

  const retry = () => {
    setLoadError(null)
    setAttempt((n) => n + 1)
  }

  const signOutButton = (
    <button type="button" className="btn" onClick={onSignOut} disabled={signingOut}>
      {signingOut ? 'กำลังออก…' : 'ออกจากระบบ'}
    </button>
  )

  if (loadError) {
    return (
      <Gate {...gateProps}>
        <GateMessage title="โหลดข้อมูลผู้ใช้ไม่สำเร็จ">
          <p className="alert" role="alert">
            {loadError}
          </p>
          <button type="button" className="btn primary" onClick={retry}>
            ลองใหม่
          </button>{' '}
          {signOutButton}
        </GateMessage>
      </Gate>
    )
  }

  if (profile === undefined) {
    return (
      <Gate {...gateProps}>
        <GateMessage title="กรุณารอสักครู่">
          <p role="status">กำลังโหลดข้อมูลผู้ใช้…</p>
        </GateMessage>
      </Gate>
    )
  }

  if (profile === null) {
    return (
      <Gate {...gateProps}>
        <GateMessage title="ยังเข้าใช้งานไม่ได้">
          {signOutError && (
            <p className="alert" role="alert">
              {signOutError}
            </p>
          )}
          <p>{ERROR_MESSAGE.NO_PROFILE}</p>
          {signOutButton}
        </GateMessage>
      </Gate>
    )
  }

  return (
    <Workspace
      profile={profile}
      repository={repository}
      theme={theme}
      onToggleTheme={onToggleTheme}
      signingOut={signingOut}
      signOutError={signOutError}
      onSignOut={onSignOut}
    />
  )
}

// หน้าโปรแกรมหลัก: โหลดสินค้าครั้งเดียวแล้วใช้ร่วมกันทุกหน้า
function Workspace({ profile, repository, theme, onToggleTheme, signingOut, signOutError, onSignOut }) {
  const [page, setPage] = useState(PAGE.PRODUCTS)
  // รวมสินค้าที่ปิดใช้งาน (ใช้ในหน้าจัดการสินค้า) หน้าอื่นใช้เฉพาะที่เปิดใช้งาน
  const [allProducts, setAllProducts] = useState([])
  // 'loading' | 'ready' | 'error'
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // กดรับเข้า/เบิกออกจากตารางสินค้า: หน้ารับเข้า / เบิกออก (T4.4) เลือกสินค้าและประเภทไว้ให้
  const [moveIntent, setMoveIntent] = useState(null)
  // { [imagePath]: signed URL } ขอใหม่ทุกครั้งที่โหลดสินค้า (ลิงก์ใช้ได้ 1 ชั่วโมง)
  const [imageUrls, setImageUrls] = useState({})
  // โลโก้ร้าน (null = ยังไม่ตั้ง)
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState(null)

  useEffect(() => {
    let active = true
    repository.getLogoUrl().then(({ url }) => {
      if (active) setLogoUrl(url)
    })
    return () => {
      active = false
    }
  }, [repository])

  const handleLogo = async (file) => {
    const problem = checkImageFile(file)
    if (problem) {
      setLogoError(problem)
      return
    }
    setLogoBusy(true)
    setLogoError(null)
    try {
      const { error } = await repository.uploadLogo(await resizeImage(file, LOGO_SIDE))
      if (error) setLogoError(error)
      else setLogoUrl((await repository.getLogoUrl()).url)
    } catch (thrown) {
      setLogoError(thrown.message)
    } finally {
      setLogoBusy(false)
    }
  }

  useEffect(() => {
    const paths = allProducts.map((p) => p.imagePath).filter(Boolean)
    if (paths.length === 0) return undefined
    let active = true
    repository.signImageUrls(paths).then(({ urls }) => {
      if (active) setImageUrls(urls)
    })
    return () => {
      active = false
    }
  }, [repository, allProducts])

  useEffect(() => {
    let active = true
    repository.listProducts({ includeInactive: true }).then(({ products: loaded, error }) => {
      if (!active) return
      if (error) {
        setLoadError(error)
        setLoadState('error')
      } else {
        setAllProducts(loaded)
        setLoadState('ready')
      }
    })
    return () => {
      active = false
    }
  }, [repository, attempt])

  const reloadProducts = () => {
    setLoadState('loading')
    setAttempt((n) => n + 1)
  }

  const handleMove = (product, type) => {
    // seq ทำให้กดซ้ำสินค้าเดิมแล้วฟอร์มเริ่มใหม่
    setMoveIntent((current) => ({ productId: product.id, type, seq: (current?.seq ?? 0) + 1 }))
    setPage(PAGE.MOVE)
  }

  // หน้าที่บทบาทนี้เปิดไม่ได้ (เช่น staff) กลับไปหน้าแรก
  const allowed = getMenu(profile.role).some((group) => group.items.some((item) => item.page === page))
  const currentPage = allowed ? page : PAGE.PRODUCTS
  const products = allProducts.filter((p) => p.active)
  const today = toIsoDate(new Date())

  return (
    <AppShell
      titleBar={{
        profile,
        theme,
        onToggleTheme,
        signingOut,
        onSignOut,
        onHome: () => setPage(PAGE.PRODUCTS),
        logo: { url: logoUrl, canChange: canManageProducts(profile.role), busy: logoBusy, onPick: handleLogo },
      }}
      sidebar={<Sidebar role={profile.role} page={currentPage} onChange={setPage} />}
      statusBar={{
        connected: loadState !== 'error',
        productCount: loadState === 'ready' ? products.length : null,
        today,
      }}
    >
      {signOutError && (
        <p className="alert" role="alert">
          {signOutError}
        </p>
      )}
      {logoError && (
        <p className="alert" role="alert">
          เปลี่ยนโลโก้ไม่สำเร็จ: {logoError}
        </p>
      )}
      {currentPage === PAGE.PRODUCTS && (
        <ProductsPage
          products={products}
          imageUrls={imageUrls}
          loadState={loadState}
          loadError={loadError}
          onRetry={reloadProducts}
          onMove={handleMove}
        />
      )}
      {currentPage === PAGE.MOVE && (
        <MovementPage
          key={moveIntent?.seq ?? 0}
          products={products}
          imageUrls={imageUrls}
          loadState={loadState}
          role={profile.role}
          today={today}
          intent={moveIntent}
          repository={repository}
          onSaved={reloadProducts}
        />
      )}
      {currentPage === PAGE.MANAGE && (
        <ManagePage
          allProducts={allProducts}
          imageUrls={imageUrls}
          loadState={loadState}
          loadError={loadError}
          onRetry={reloadProducts}
          repository={repository}
          onChanged={reloadProducts}
        />
      )}
      {currentPage === PAGE.HISTORY && <HistoryPage allProducts={allProducts} repository={repository} />}
      {currentPage === PAGE.SALES && (
        <MonthlySalesPage allProducts={allProducts} imageUrls={imageUrls} loadState={loadState} repository={repository} />
      )}
    </AppShell>
  )
}

export default App
