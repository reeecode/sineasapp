import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface DonationRecord {
  id: string
  ref_code?: string | null
  donor_name: string
  amount: number
  message: string | null
  film_id: string
  status: 'PENDING' | 'PAID' | 'FAILED' | string
  created_at: string
}

/**
 * Generator Kode Unik Ref TipTip (Format: HSS-XXXX)
 * Menghasilkan kode unik contoh: HSS-4821, HSS-7F3A
 */
export const generateRefCode = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = 'HSS-'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

let supabaseInstance: SupabaseClient | null = null

/**
 * Singleton Supabase Client Helper / Composable
 * Menginisialisasi client menggunakan runtimeConfig Nuxt 3.
 * Menjaga instance tunggal pada client-side agar koneksi Realtime WebSocket tetap stabil.
 */
export const useSupabase = (): SupabaseClient => {
  // Gunakan existing instance jika sudah diinisialisasi di client
  if (import.meta.client && supabaseInstance) {
    return supabaseInstance
  }

  const config = useRuntimeConfig()
  const supabaseUrl = (config.public.supabaseUrl as string) || (process.env.NUXT_PUBLIC_SUPABASE_URL as string) || ''
  const supabaseKey = (config.public.supabaseKey as string) || (process.env.NUXT_PUBLIC_SUPABASE_KEY as string) || ''

  if (!supabaseUrl || !supabaseKey) {
    if (import.meta.client) {
      console.warn(
        '[Supabase] Warning: supabaseUrl atau supabaseKey belum diset. Pastikan NUXT_PUBLIC_SUPABASE_URL dan NUXT_PUBLIC_SUPABASE_KEY tersedia di .env'
      )
    }
  }

  const client = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key',
    {
      auth: {
        persistSession: import.meta.client,
        autoRefreshToken: import.meta.client,
        detectSessionInUrl: import.meta.client
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  )

  if (import.meta.client) {
    supabaseInstance = client
  }

  return client
}

export default useSupabase

