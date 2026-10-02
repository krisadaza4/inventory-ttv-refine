import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// รหัสเวอร์ชันของ build นี้: Vercel ใช้ commit SHA, ที่อื่นใช้เวลาที่ build
// ฝังในโค้ด (__APP_VERSION__) และเขียน version.json ให้แอปที่เปิดค้างไว้ตรวจว่ามีเวอร์ชันใหม่
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || Date.now().toString(36)

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
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
})
