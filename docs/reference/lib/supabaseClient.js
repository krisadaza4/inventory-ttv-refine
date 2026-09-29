import { createClient } from '@supabase/supabase-js'

export const CONFIG_ERROR =
  'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase กรุณาใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_PUBLISHABLE_KEY ในไฟล์ .env.local'

// env รับเป็นพารามิเตอร์ เพื่อให้ทดสอบได้โดยไม่ต้องมีไฟล์ .env จริง
export function readSupabaseConfig(env) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) return { config: null, error: CONFIG_ERROR }
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
