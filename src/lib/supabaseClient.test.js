import { describe, expect, it } from 'vitest'
import { CONFIG_ERROR, SECRET_KEY_ERROR, getSupabase, readSupabaseConfig } from './supabaseClient.js'

const URL = 'https://abc.supabase.co'

describe('readSupabaseConfig', () => {
  it('ตั้งค่าครบ คืน url และ key ที่ตัดช่องว่างแล้ว', () => {
    const env = { VITE_SUPABASE_URL: ` ${URL} `, VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_x ' }
    expect(readSupabaseConfig(env)).toEqual({ config: { url: URL, key: 'sb_publishable_x' }, error: null })
  })

  it('ไม่มี url', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({
      config: null,
      error: CONFIG_ERROR,
    })
  })

  it('key ว่าง', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: '  ' }).error).toBe(CONFIG_ERROR)
  })

  it('ใส่ secret key ผิดช่อง ปฏิเสธ ไม่ให้ key หลุดไปหน้าเว็บ', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' })).toEqual({
      config: null,
      error: SECRET_KEY_ERROR,
    })
  })

  it('ใช้ชื่อ env จาก Supabase integration บน Vercel ได้ เมื่อไม่มี VITE_', () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_v' }
    expect(readSupabaseConfig(env).config).toEqual({ url: URL, key: 'sb_publishable_v' })
  })

  it('ไม่มี publishable key ใช้ anon key จาก integration แทน', () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJanon' }
    expect(readSupabaseConfig(env).config).toEqual({ url: URL, key: 'eyJanon' })
  })

  it('VITE_ มาก่อนชื่อจาก integration', () => {
    const env = {
      VITE_SUPABASE_URL: URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mine',
      NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other',
    }
    expect(readSupabaseConfig(env).config).toEqual({ url: URL, key: 'sb_publishable_mine' })
  })
})

describe('getSupabase', () => {
  it('ตั้งค่าไม่ครบ คืน error ไม่โยนข้อผิดพลาด', () => {
    expect(getSupabase({})).toEqual({ client: null, error: CONFIG_ERROR })
  })
})
