import { createClient } from '@supabase/supabase-js'

export const CONFIG_ERROR =
  'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_PUBLISHABLE_KEY ในไฟล์ .env.local'

export const SECRET_KEY_ERROR =
  'VITE_SUPABASE_PUBLISHABLE_KEY เป็น secret key ห้ามใช้ในหน้าเว็บ กรุณาใช้ publishable key (sb_publishable_)'

// ชื่อ env ที่ยอมรับ เรียงตามลำดับที่ใช้ก่อน: ของโปรเจกต์ (VITE_) แล้วค่อยชื่อที่ Supabase integration บน Vercel ใส่ให้เอง
const URL_KEYS = ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']
const KEY_KEYS = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

function firstSet(env, names) {
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) return value
  }
  return undefined
}

// env รับเป็นพารามิเตอร์ เพื่อให้ทดสอบได้โดยไม่ต้องมีไฟล์ .env จริง
export function readSupabaseConfig(env) {
  const url = firstSet(env, URL_KEYS)
  const key = firstSet(env, KEY_KEYS)
  if (!url || !key) return { config: null, error: CONFIG_ERROR }
  // กันใส่ secret key ผิดช่อง ซึ่งจะถูก build ติดไปกับหน้าเว็บ
  if (key.startsWith('sb_secret_')) return { config: null, error: SECRET_KEY_ERROR }
  return { config: { url, key }, error: null }
}

let cached = null

// สร้าง client ครั้งเดียวต่อหน้า คืน { client, error } ไม่โยนข้อผิดพลาด
export function getSupabase(env = import.meta.env) {
  if (cached) return cached
  const { config, error } = readSupabaseConfig(env)
  if (error) return { client: null, error }
  cached = { client: createClient(config.url, config.key), error: null }
  return cached
}
