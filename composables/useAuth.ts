import { ref, computed } from 'vue'
import { useSupabase } from '~/utils/supabase'
import type { DonationRecord, UserProfile } from '~/types'

export const useAuth = () => {
  const supabase = useSupabase()

  // Global shared state across components
  const user = useState<any>('auth_user', () => null)
  const profile = useState<UserProfile | null>('auth_profile', () => null)
  const isAuthLoading = useState<boolean>('auth_loading', () => false)
  const isAuthInitialized = useState<boolean>('auth_initialized', () => false)

  // Global Auth Modal controls
  const showAuthModal = useState<boolean>('show_auth_modal', () => false)
  const authModalMode = useState<'login' | 'register'>('auth_modal_mode', () => 'login')
  const authPromptMessage = useState<string>('auth_prompt_msg', () => '')
  const pendingAuthAction = useState<(() => void) | null>('pending_auth_action', () => null)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const userEmail = computed(() => user.value?.email || profile.value?.email || '')
  const userName = computed(() => {
    return (
      profile.value?.full_name ||
      user.value?.user_metadata?.full_name ||
      user.value?.email?.split('@')[0] ||
      'Pengguna'
    )
  })

  // Fetch profil dari database Supabase (tabel public.profiles)
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error || !data) {
        // Jika profil belum ada, coba buatkan profil dasar di database
        if (user.value) {
          const newProfile: UserProfile = {
            id: userId,
            email: user.value.email || '',
            full_name: user.value.user_metadata?.full_name || user.value.email?.split('@')[0] || '',
            role: (user.value.user_metadata?.role === 'admin') ? 'admin' : 'user'
          }
          await supabase.from('profiles').insert(newProfile).select().maybeSingle()
          profile.value = newProfile
          return newProfile
        }
        return null
      }

      profile.value = data as UserProfile
      return data as UserProfile
    } catch (err) {
      console.warn('[useAuth] Fetch profile database error:', err)
      return null
    }
  }

  // Inisialisasi Auth State dari Supabase
  const initAuth = async () => {
    if (isAuthInitialized.value || !import.meta.client) return

    try {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) {
        user.value = data.session.user
        await fetchProfile(data.session.user.id)
      }

      // Listen perubahan status login / logout secara realtime
      supabase.auth.onAuthStateChange(async (_event, session) => {
        user.value = session?.user || null
        if (session?.user) {
          await fetchProfile(session.user.id)
          if (pendingAuthAction.value) {
            const action = pendingAuthAction.value
            pendingAuthAction.value = null
            action()
          }
        } else {
          profile.value = null
        }
      })
    } catch (err) {
      console.warn('[useAuth] Session fetch error:', err)
    } finally {
      isAuthInitialized.value = true
    }
  }

  // Login dengan Email & Password langsung ke Supabase Auth & Database
  const signIn = async (email: string, pass: string) => {
    isAuthLoading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass
      })

      if (error) {
        return { data: null, error }
      }

      user.value = data.user
      if (data.user) {
        await fetchProfile(data.user.id)
      }

      closeAuthModal()
      return { data, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    } finally {
      isAuthLoading.value = false
    }
  }

  // Registrasi Akun Baru ke Supabase Auth
  const signUp = async (email: string, pass: string, fullName: string) => {
    isAuthLoading.value = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      })

      if (error) {
        return { data: null, error }
      }

      if (data?.user) {
        user.value = data.user
        await fetchProfile(data.user.id)
      }

      closeAuthModal()
      return { data, error: null }
    } catch (err: any) {
      return { data: null, error: err }
    } finally {
      isAuthLoading.value = false
    }
  }

  // Logout dari Supabase
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Logout notice:', err)
    } finally {
      user.value = null
      profile.value = null
    }
  }

  // Cek apakah user saat ini memiliki role 'admin' di database
  const checkIsAdmin = async (): Promise<boolean> => {
    if (!user.value) return false
    if (profile.value) {
      return profile.value.role === 'admin'
    }
    const prof = await fetchProfile(user.value.id)
    return prof?.role === 'admin'
  }

  // Modal Auth Controls
  const openAuthModal = (mode: 'login' | 'register' = 'login', message = '', onAuthDone?: () => void) => {
    authModalMode.value = mode
    authPromptMessage.value = message
    if (onAuthDone) {
      pendingAuthAction.value = onAuthDone
    }
    showAuthModal.value = true
  }

  const closeAuthModal = () => {
    showAuthModal.value = false
    authPromptMessage.value = ''
  }

  // Cek apakah user saat ini telah memiliki akses (donasi PAID) untuk film tertentu di database
  const hasUnlockedFilm = async (filmId: string, filmSlug?: string): Promise<boolean> => {
    if (!user.value || !filmId) return false

    try {
      let query = supabase
        .from('donations')
        .select('id')
        .eq('user_id', user.value.id)
        .eq('status', 'PAID')

      if (filmSlug && filmSlug !== filmId) {
        query = query.or(`film_id.eq.${filmId},film_id.eq.${filmSlug}`)
      } else {
        query = query.eq('film_id', filmId)
      }

      const { data, error } = await query.limit(1)

      if (error || !data) return false
      return data.length > 0
    } catch (err) {
      console.warn('Check unlocked film error:', err)
      return false
    }
  }

  // Ambil semua film yang telah didonasikan oleh user saat ini dari database
  const getUserDonations = async (): Promise<DonationRecord[]> => {
    if (!user.value) return []

    try {
      // 1. Coba query PostgREST relasi foreign key
      const { data, error } = await supabase
        .from('donations')
        .select(`
          id,
          user_id,
          film_id,
          donor_name,
          amount,
          message,
          status,
          created_at,
          films (*)
        `)
        .eq('user_id', user.value.id)
        .eq('status', 'PAID')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        return data as unknown as DonationRecord[]
      }

      // 2. Fallback aman: jika relasi foreign key belum terindeks cache PostgREST,
      // ambil donasi langsung dan hubungkan dengan tabel films secara manual
      const { data: rawDonations, error: rawError } = await supabase
        .from('donations')
        .select('*')
        .eq('user_id', user.value.id)
        .eq('status', 'PAID')
        .order('created_at', { ascending: false })

      if (rawError || !rawDonations || rawDonations.length === 0) {
        return []
      }

      const filmIds = [...new Set(rawDonations.map((d) => d.film_id).filter(Boolean))]
      if (filmIds.length === 0) {
        return rawDonations as DonationRecord[]
      }

      const { data: filmsList } = await supabase
        .from('films')
        .select('*')
        .in('id', filmIds)

      const filmsMap = new Map((filmsList || []).map((f) => [f.id, f]))
      return rawDonations.map((d) => ({
        ...d,
        films: filmsMap.get(d.film_id) || null
      })) as DonationRecord[]
    } catch (err) {
      console.warn('Fetch user donations error:', err)
      return []
    }
  }

  return {
    user,
    profile,
    isAdmin,
    isAuthenticated,
    userEmail,
    userName,
    isAuthLoading,
    showAuthModal,
    authModalMode,
    authPromptMessage,
    initAuth,
    signIn,
    signUp,
    signOut,
    checkIsAdmin,
    fetchProfile,
    openAuthModal,
    closeAuthModal,
    hasUnlockedFilm,
    getUserDonations
  }
}

export default useAuth
