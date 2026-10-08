import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// รหัสเวอร์ชันของ build นี้: Vercel ใช้ commit SHA, ที่อื่นใช้เวลาที่ build
// ฝังในโค้ด (__APP_VERSION__) และเขียน version.json ให้แอปที่เปิดค้างไว้ตรวจว่ามีเวอร์ชันใหม่
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || Date.now().toString(36)

// เลขเวอร์ชันที่แสดงใต้ชื่อโปรแกรม (เช่น 1.0.1) มาจาก package.json แก้ที่นั่นเมื่อออกเวอร์ชันใหม่
const APP_RELEASE = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

// แยกไลบรารีใหญ่ที่ไม่ค่อยเปลี่ยน (React, Supabase) เป็นไฟล์ของตัวเอง
// deploy ใหม่แล้วเบราว์เซอร์ยังใช้ไฟล์ที่ cache ไว้ได้ โหลดใหม่เฉพาะโค้ดของแอป
const VENDOR_GROUPS = [
  { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
]

function versionFile() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFile()],
  // NEXT_PUBLIC_ = ชื่อที่ Supabase integration บน Vercel ใส่ให้ (เป็นค่าสาธารณะอยู่แล้ว) ห้ามเพิ่ม prefix ที่มี secret
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_RELEASE__: JSON.stringify(APP_RELEASE),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: VENDOR_GROUPS },
      },
    },
  },
})
