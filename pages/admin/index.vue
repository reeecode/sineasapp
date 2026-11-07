<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabase } from '~/utils/supabase'
import { useFilms } from '~/composables/useFilms'
import { useAuth } from '~/composables/useAuth'
import type { Film, DonationRecord } from '~/types'

const supabase = useSupabase()
const { films, fetchFilms, createFilm, updateFilm, deleteFilm, uploadPosterFile } = useFilms()
const { user, profile, isAuthenticated, isAdmin, signIn, signOut, checkIsAdmin } = useAuth()

// Upload State
const isUploadingPoster = ref(false)

// Admin Authentication State
const adminEmail = ref('')
const adminPassword = ref('')
const showAdminPassword = ref(false)
const isLoggingIn = ref(false)
const loginError = ref('')
const isCheckingRole = ref(true)

// Navigation Tab State
const activeTab = ref<'films' | 'donations'>('films')

// Database Data State (Tanpa Data Dummy)
const allDonations = ref<DonationRecord[]>([])
const isLoadingDonations = ref(false)
const donationStatusFilter = ref<string>('ALL')

// Film Modal State (Add / Edit)
const showFilmModal = ref(false)
const isEditing = ref(false)
const editingFilmId = ref('')
const filmForm = ref<Partial<Film>>({
  title: '',
  slug: '',
  year: new Date().getFullYear().toString(),
  duration: '',
  genre: '',
  director: '',
  production: '',
  youtube_video_id: '',
  poster_url: '',
  banner_url: '',
  synopsis: '',
  min_donation: 10000,
  is_active: true,
  featured: false
})
const isSavingFilm = ref(false)
const filmModalError = ref('')

// Notification State
const toastMessage = ref('')
const showToast = ref(false)

const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 4000)
}

// ==============================================================================
// Autentikasi Admin dari Database (Supabase Auth & Tabel Profiles)
// ==============================================================================
const handleAdminLogin = async () => {
  loginError.value = ''

  if (!adminEmail.value || !adminPassword.value) {
    loginError.value = 'Email dan kata sandi admin wajib diisi.'
    return
  }

  isLoggingIn.value = true

  try {
    // 1. Login ke Supabase Auth
    const { data, error } = await signIn(adminEmail.value, adminPassword.value)

    if (error || !data?.user) {
      if (error?.message?.toLowerCase().includes('not confirmed')) {
        loginError.value = `Email "${adminEmail.value}" belum terkonfirmasi di Supabase Auth. Jalankan perintah di SQL Editor: UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${adminEmail.value}';`
      } else {
        loginError.value = error?.message || 'Email atau kata sandi tidak valid.'
      }
      return
    }

    // 2. Verifikasi Role di Database (Tabel public.profiles)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError) {
      loginError.value = `Gagal memeriksa profil admin di database: ${profileError.message}`
      await signOut()
      return
    }

    if (!profileData || profileData.role !== 'admin') {
      loginError.value = `Akses Ditolak: Akun "${data.user.email}" terdaftar sebagai "${profileData?.role || 'user'}" di database. Ubah kolom role menjadi 'admin' pada tabel profiles di database Supabase.`
      await signOut()
      return
    }

    // Berhasil sebagai admin
    triggerToast(`Selamat datang Administrator (${profileData.email})!`)
    await loadAdminData()
  } catch (err: any) {
    loginError.value = err.message || 'Terjadi kesalahan sistem saat verifikasi admin.'
    await signOut()
  } finally {
    isLoggingIn.value = false
  }
}

const handleAdminLogout = async () => {
  await signOut()
  allDonations.value = []
  triggerToast('Berhasil keluar dari sesi Administrator.')
}

// ==============================================================================
// Metrics & Statistics dari Data Riil Database
// ==============================================================================
const totalRevenue = computed(() => {
  return allDonations.value
    .filter((d) => d.status === 'PAID')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0)
})

const paidDonationsCount = computed(() => {
  return allDonations.value.filter((d) => d.status === 'PAID').length
})

const pendingDonationsCount = computed(() => {
  return allDonations.value.filter((d) => d.status === 'PENDING').length
})

const filteredDonations = computed(() => {
  if (donationStatusFilter.value === 'ALL') return allDonations.value
  return allDonations.value.filter((d) => d.status === donationStatusFilter.value)
})

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatDate = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return isoString
  }
}

// ==============================================================================
// Fetch Riil Database Data
// ==============================================================================
const loadAdminData = async () => {
  await fetchFilms(true) // include inactive films
  await fetchAllDonations()
}

const fetchAllDonations = async () => {
  isLoadingDonations.value = true
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('*, films(title)')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[Admin] Fallback fetch donations without join:', error.message)
      const { data: rawList } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false })
      allDonations.value = (rawList as DonationRecord[]) || []
    } else {
      allDonations.value = (data as DonationRecord[]) || []
    }
  } catch (err) {
    console.error('[Admin] Database error:', err)
    allDonations.value = []
  } finally {
    isLoadingDonations.value = false
  }
}

// ==============================================================================
// Film Management (Riil INSERT, UPDATE, DELETE ke Database)
// ==============================================================================
const openAddFilmModal = () => {
  isEditing.value = false
  editingFilmId.value = ''
  filmForm.value = {
    title: '',
    slug: '',
    year: new Date().getFullYear().toString(),
    duration: '',
    genre: '',
    director: '',
    production: '',
    youtube_video_id: '',
    poster_url: '',
    banner_url: '',
    synopsis: '',
    min_donation: 10000,
    is_active: true,
    featured: false
  }
  filmModalError.value = ''
  showFilmModal.value = true
}

const openEditFilmModal = (film: Film) => {
  isEditing.value = true
  editingFilmId.value = film.id
  filmForm.value = { ...film }
  filmModalError.value = ''
  showFilmModal.value = true
}

const handlePosterFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Validasi ukuran (maksimal 5 MB)
  if (file.size > 5 * 1024 * 1024) {
    filmModalError.value = 'Ukuran file foto maksimal 5 MB.'
    return
  }

  isUploadingPoster.value = true
  filmModalError.value = ''

  try {
    const publicUrl = await uploadPosterFile(file)
    filmForm.value.poster_url = publicUrl
    triggerToast('Foto poster berhasil diunggah dan disimpan di Supabase Storage!')
  } catch (err: any) {
    filmModalError.value = `Gagal mengunggah foto ke Supabase Storage: ${err.message}`
  } finally {
    isUploadingPoster.value = false
    target.value = ''
  }
}

const handleSaveFilm = async () => {
  filmModalError.value = ''

  if (!filmForm.value.title || !filmForm.value.youtube_video_id || !filmForm.value.synopsis) {
    filmModalError.value = 'Judul, YouTube Video ID, dan Sinopsis wajib diisi.'
    return
  }

  // Generate slug if empty
  if (!filmForm.value.slug) {
    filmForm.value.slug = filmForm.value.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  isSavingFilm.value = true

  try {
    if (isEditing.value) {
      await updateFilm(editingFilmId.value, filmForm.value)
      triggerToast(`Film "${filmForm.value.title}" berhasil diperbarui di database!`)
    } else {
      await createFilm({
        ...filmForm.value,
        id: filmForm.value.slug
      })
      triggerToast(`Film "${filmForm.value.title}" berhasil ditambahkan ke database!`)
    }
    showFilmModal.value = false
    await fetchFilms(true)
  } catch (err: any) {
    filmModalError.value = err.message || 'Gagal menyimpan data film ke database.'
  } finally {
    isSavingFilm.value = false
  }
}

const handleToggleFilmStatus = async (film: Film) => {
  const newStatus = !film.is_active
  try {
    await updateFilm(film.id, { is_active: newStatus })
    triggerToast(`Status film "${film.title}" diperbarui menjadi: ${newStatus ? 'Aktif' : 'Nonaktif'}`)
  } catch (err: any) {
    triggerToast(`Gagal update status: ${err.message}`)
  }
}

const handleDeleteFilm = async (film: Film) => {
  if (confirm(`Apakah Anda yakin ingin menghapus film "${film.title}" secara permanen dari database?`)) {
    try {
      await deleteFilm(film.id)
      triggerToast(`Film "${film.title}" telah dihapus dari database.`)
    } catch (err: any) {
      triggerToast(`Gagal menghapus film: ${err.message}`)
    }
  }
}

// ==============================================================================
// Verifikasi Donasi Manual Langsung ke Database (Set PAID)
// ==============================================================================
const handleSetPaid = async (donation: DonationRecord) => {
  try {
    const { error } = await supabase
      .from('donations')
      .update({ status: 'PAID' })
      .eq('id', donation.id)

    if (error) throw error

    donation.status = 'PAID'
    triggerToast(`Status donasi dari ${donation.donor_name} berhasil diverifikasi (PAID) di database!`)
  } catch (err: any) {
    triggerToast(`Gagal memperbarui status: ${err.message}`)
  }
}

// Periksa status admin saat halaman dimuat
onMounted(async () => {
  isCheckingRole.value = true
  if (user.value) {
    const verified = await checkIsAdmin()
    if (verified) {
      await loadAdminData()
    }
  }
  isCheckingRole.value = false
})

watch(isAdmin, async (newVal) => {
  if (newVal) {
    await loadAdminData()
  }
})
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Header Admin -->
    <div class="border-b border-zinc-800/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-2 mb-1">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center space-x-2">
            <span>Dashboard Administrator</span>
            <span class="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase font-mono font-bold">
              Database Terverifikasi
            </span>
          </h1>
        </div>
        <p class="text-xs text-zinc-400">
          Pengelolaan katalog film, verifikasi donasi, dan pemantauan data langsung dari database Supabase.
        </p>
      </div>

      <!-- Action Button if Admin Authorized -->
      <div v-if="isAdmin" class="flex items-center space-x-3">
        <button
          type="button"
          @click="openAddFilmModal"
          class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center space-x-1.5"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Tambah Film Baru</span>
        </button>

        <button
          type="button"
          @click="handleAdminLogout"
          class="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 text-xs font-semibold transition-colors"
        >
          Keluar Admin
        </button>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- GATE LOGIN ADMIN (DENGAN AKUN & ROLE DATABASE, BUKAN DUMMY)           -->
    <!-- ==================================================================== -->
    <div
      v-if="!isAdmin"
      class="max-w-md mx-auto my-12 rounded-3xl border border-zinc-800 bg-zinc-950/85 backdrop-blur-md p-8 text-center space-y-6 shadow-2xl"
    >
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20 font-black text-2xl">
        🛡️
      </div>

      <div class="space-y-2">
        <h3 class="text-xl font-black text-white">Login Akun Administrator</h3>
        <p class="text-xs text-zinc-400 leading-relaxed">
          Masuk dengan akun yang memiliki peran <span class="text-amber-400 font-bold font-mono">'admin'</span> pada tabel <span class="font-mono text-zinc-300">profiles</span> di database Supabase.
        </p>
      </div>

      <div v-if="loginError" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-left leading-relaxed">
        {{ loginError }}
      </div>

      <form @submit.prevent="handleAdminLogin" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-semibold text-zinc-400 mb-1">Email Administrator</label>
          <input
            v-model="adminEmail"
            type="email"
            required
            placeholder="admin@domain.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-zinc-400 mb-1">Kata Sandi</label>
          <div class="relative">
            <input
              v-model="adminPassword"
              :type="showAdminPassword ? 'text' : 'password'"
              required
              placeholder="Masukkan kata sandi..."
              class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
            <button
              type="button"
              @click="showAdminPassword = !showAdminPassword"
              tabindex="-1"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors p-1"
              :title="showAdminPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'"
            >
              <svg v-if="showAdminPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="isLoggingIn"
          class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <svg v-if="isLoggingIn" class="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Masuk sebagai Administrator</span>
        </button>

        <!-- Informasi SQL panduan aktivasi role admin di Supabase -->
        <div class="mt-4 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
          <strong class="text-zinc-200 block">Panduan Aktivasi Role Admin di Database:</strong>
          <p class="text-[10px] text-zinc-500">
            Daftarkan akun di web atau Supabase Auth, lalu jalankan query berikut di Supabase SQL Editor:
          </p>
          <code class="block font-mono text-[10px] text-amber-400 bg-black/60 p-2 rounded border border-zinc-800">
            UPDATE public.profiles SET role = 'admin' WHERE email = 'email_anda@domain.com';
          </code>
        </div>
      </form>
    </div>

    <!-- ==================================================================== -->
    <!-- DASHBOARD AKTIF (DATA RIIL DARI DATABASE)                            -->
    <!-- ==================================================================== -->
    <div v-else class="space-y-8">
      
      <!-- Admin Profile Banner -->
      <div class="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-xs">
            {{ user?.email ? user.email.charAt(0).toUpperCase() : 'A' }}
          </div>
          <div>
            <div class="text-zinc-200 font-bold flex items-center space-x-2">
              <span>{{ user?.email }}</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                Role: {{ profile?.role || 'admin' }}
              </span>
            </div>
            <div class="text-[11px] text-zinc-500">Akses Penuh Pengelolaan Database Sineas HSS</div>
          </div>
        </div>

        <button
          type="button"
          @click="loadAdminData"
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs self-start sm:self-auto transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Segarkan Data Database</span>
        </button>
      </div>

      <!-- Real Metrics Overview from Database -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-1">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
            Total Dana Terkumpul (Database)
          </span>
          <div class="text-2xl font-black text-amber-400 font-mono">
            {{ formatRupiah(totalRevenue) }}
          </div>
          <span class="text-[10px] text-zinc-400">Total donasi status PAID</span>
        </div>

        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-1">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
            Donasi Berhasil (PAID)
          </span>
          <div class="text-2xl font-black text-emerald-400 font-mono">
            {{ paidDonationsCount }}
          </div>
          <span class="text-[10px] text-zinc-400">Transaksi terverifikasi</span>
        </div>

        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-1">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
            Menunggu Pembayaran (PENDING)
          </span>
          <div class="text-2xl font-black text-amber-500 font-mono">
            {{ pendingDonationsCount }}
          </div>
          <span class="text-[10px] text-zinc-400">Transaksi belum settlement</span>
        </div>

        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-1">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">
            Total Film di Database
          </span>
          <div class="text-2xl font-black text-white font-mono">
            {{ films.length }}
          </div>
          <span class="text-[10px] text-zinc-400">Tercatat di tabel public.films</span>
        </div>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-zinc-800/80 space-x-6">
        <button
          type="button"
          @click="activeTab = 'films'"
          :class="[
            'pb-3 text-sm font-bold border-b-2 transition-all flex items-center space-x-2',
            activeTab === 'films'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span>Katalog Film Database ({{ films.length }})</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'donations'"
          :class="[
            'pb-3 text-sm font-bold border-b-2 transition-all flex items-center space-x-2',
            activeTab === 'donations'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>Log Transaksi Donasi Database ({{ allDonations.length }})</span>
        </button>
      </div>

      <!-- ================================================================== -->
      <!-- TAB 1: MANAJEMEN FILM RIIL DATABASE                                -->
      <!-- ================================================================== -->
      <div v-if="activeTab === 'films'" class="space-y-4">
        <div v-if="films.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="film in films"
            :key="film.id"
            class="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden flex flex-col justify-between"
          >
            <!-- Thumbnail & Badges -->
            <div class="relative aspect-video w-full bg-black">
              <img
                :src="film.poster_url || film.banner_url || 'https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=800&auto=format&fit=crop'"
                :alt="film.title"
                class="w-full h-full object-cover"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

              <span
                :class="[
                  'absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold border',
                  film.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                ]"
              >
                {{ film.is_active ? '● Aktif Tayang' : '○ Nonaktif' }}
              </span>

              <span v-if="film.featured" class="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black">
                Featured
              </span>
            </div>

            <!-- Content Details -->
            <div class="p-4 flex-1 space-y-2">
              <div class="flex items-center justify-between text-[11px] text-zinc-500">
                <span>{{ film.genre }}</span>
                <span>{{ film.duration }}</span>
              </div>
              <h3 class="text-base font-bold text-white line-clamp-1">
                {{ film.title }} ({{ film.year }})
              </h3>
              <p class="text-xs text-zinc-400 line-clamp-2">
                {{ film.synopsis }}
              </p>
              <div class="text-[11px] text-zinc-500 pt-1">
                YouTube ID: <span class="font-mono text-amber-400">{{ film.youtube_video_id }}</span>
              </div>
            </div>

            <!-- Actions Footer -->
            <div class="p-3 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center justify-between gap-2">
              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  @click="openEditFilmModal(film)"
                  class="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  @click="handleToggleFilmStatus(film)"
                  class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  {{ film.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
              </div>

              <div class="flex items-center space-x-1">
                <NuxtLink
                  :to="`/stream/${film.slug}`"
                  target="_blank"
                  class="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                  title="Lihat Halaman Streaming"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </NuxtLink>

                <button
                  type="button"
                  @click="handleDeleteFilm(film)"
                  class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Hapus Film"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State Tanpa Dummy -->
        <div v-else class="text-center py-16 bg-zinc-950/60 rounded-3xl border border-zinc-800 space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-600 flex items-center justify-center mx-auto">
            🎬
          </div>
          <h4 class="text-base font-bold text-white">Belum Ada Film di Database</h4>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Tabel <span class="font-mono text-amber-400">public.films</span> di database masih kosong. Tambahkan film baru menggunakan tombol di bawah atau jalankan seed data di Supabase SQL Editor.
          </p>
          <button
            type="button"
            @click="openAddFilmModal"
            class="px-4 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition-colors"
          >
            + Tambah Film Sekarang
          </button>
        </div>
      </div>

      <!-- ================================================================== -->
      <!-- TAB 2: LOG TRANSAKSI DONASI RIIL DATABASE                          -->
      <!-- ================================================================== -->
      <div v-if="activeTab === 'donations'" class="space-y-4">
        <!-- Status Filter Filter -->
        <div class="flex items-center space-x-2">
          <span class="text-xs text-zinc-400 font-semibold">Filter Status:</span>
          <button
            v-for="st in ['ALL', 'PAID', 'PENDING']"
            :key="st"
            type="button"
            @click="donationStatusFilter = st"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-bold border transition-colors',
              donationStatusFilter === st
                ? 'bg-amber-500 text-black border-amber-500'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            ]"
          >
            {{ st }}
          </button>
        </div>

        <!-- Table Container -->
        <div class="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th class="py-3 px-4">Waktu</th>
                  <th class="py-3 px-4">Donatur</th>
                  <th class="py-3 px-4">ID Film</th>
                  <th class="py-3 px-4">Nominal</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4">Pesan Donatur</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/80">
                <tr v-for="d in filteredDonations" :key="d.id" class="hover:bg-zinc-900/40">
                  <td class="py-3 px-4 font-mono text-zinc-500 whitespace-nowrap">
                    {{ formatDate(d.created_at) }}
                  </td>
                  <td class="py-3 px-4 font-bold text-zinc-200">
                    <div>{{ d.donor_name }}</div>
                    <div class="flex items-center space-x-1 mt-0.5">
                      <span v-if="d.ref_code" class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                        {{ d.ref_code }}
                      </span>
                      <span v-if="d.user_id" class="text-[10px] text-zinc-500 font-mono">UID: {{ d.user_id.slice(0, 6) }}</span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-zinc-400 font-mono">
                    {{ d.film_id }}
                  </td>
                  <td class="py-3 px-4 font-mono font-bold text-amber-400">
                    {{ formatRupiah(d.amount) }}
                  </td>
                  <td class="py-3 px-4">
                    <span
                      :class="[
                        'px-2 py-0.5 rounded text-[10px] font-bold border',
                        d.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      ]"
                    >
                      {{ d.status }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-zinc-400 max-w-xs truncate italic">
                    {{ d.message || '-' }}
                  </td>
                  <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      v-if="d.status === 'PENDING'"
                      type="button"
                      @click="handleSetPaid(d)"
                      class="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 text-emerald-400 hover:text-black font-bold text-[11px] transition-colors"
                    >
                      Set PAID
                    </button>
                    <span v-else class="text-zinc-500 text-[11px]">Terverifikasi</span>
                  </td>
                </tr>

                <tr v-if="filteredDonations.length === 0">
                  <td colspan="7" class="py-12 text-center text-zinc-500">
                    {{ isLoadingDonations ? 'Memuat data donasi dari database...' : 'Belum ada catatan transaksi donasi di database.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- MODAL TAMBAH / EDIT FILM (DATABASE)                                  -->
    <!-- ==================================================================== -->
    <Teleport to="body">
      <div
        v-if="showFilmModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      >
        <div class="relative w-full max-w-2xl rounded-3xl bg-[#121216] border border-zinc-700/80 p-6 sm:p-8 shadow-2xl space-y-5 my-8">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 class="text-lg font-black text-white">
              {{ isEditing ? 'Edit Data Film di Database' : 'Tambah Film Baru ke Database' }}
            </h3>
            <button
              type="button"
              @click="showFilmModal = false"
              class="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>

          <div v-if="filmModalError" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {{ filmModalError }}
          </div>

          <form @submit.prevent="handleSaveFilm" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-semibold text-zinc-400 mb-1">Judul Film *</label>
                <input
                  v-model="filmForm.title"
                  type="text"
                  required
                  placeholder="Contoh: Pulasit"
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label class="block font-semibold text-zinc-400 mb-1">Slug URL (ID unik di database)</label>
                <input
                  v-model="filmForm.slug"
                  type="text"
                  placeholder="judul-film-2025"
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label class="block font-semibold text-zinc-400 mb-1">YouTube Video ID (Unlisted) *</label>
                <input
                  v-model="filmForm.youtube_video_id"
                  type="text"
                  required
                  placeholder="Contoh: M7lc1UVf-VE"
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label class="block font-semibold text-zinc-400 mb-1">Tahun Rilis & Durasi</label>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="filmForm.year"
                    type="text"
                    placeholder="2025"
                    class="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                  />
                  <input
                    v-model="filmForm.duration"
                    type="text"
                    placeholder="28 Menit"
                    class="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label class="block font-semibold text-zinc-400 mb-1">Genre</label>
                <input
                  v-model="filmForm.genre"
                  type="text"
                  placeholder="Horor / Folk / Banjar"
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                />
              </div>

              <div>
                <label class="block font-semibold text-zinc-400 mb-1">Sutradara</label>
                <input
                  v-model="filmForm.director"
                  type="text"
                  placeholder="Nama Sutradara"
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                />
              </div>

              <div class="sm:col-span-2 space-y-2">
                <label class="block font-semibold text-zinc-400">
                  Foto Poster Film (Disimpan di Supabase Storage)
                </label>
                
                <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <!-- Poster Thumbnail Preview -->
                  <div class="w-20 h-28 rounded-xl bg-black border border-zinc-700/80 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600 shadow-md">
                    <img
                      v-if="filmForm.poster_url"
                      :src="filmForm.poster_url"
                      alt="Preview Poster"
                      class="w-full h-full object-cover"
                    />
                    <span v-else class="text-[9px] text-center p-1 text-zinc-500 font-medium">Belum ada foto</span>
                  </div>

                  <div class="flex-1 space-y-2 w-full">
                    <!-- File Upload Button -->
                    <div class="flex flex-wrap items-center gap-2">
                      <label class="cursor-pointer px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center space-x-1.5 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{{ isUploadingPoster ? 'Mengunggah ke Supabase...' : 'Unggah Foto dari Perangkat' }}</span>
                        <input
                          type="file"
                          accept="image/*"
                          :disabled="isUploadingPoster"
                          @change="handlePosterFileChange"
                          class="hidden"
                        />
                      </label>
                      <span v-if="isUploadingPoster" class="text-amber-400 animate-pulse text-[11px] font-medium">
                        Sedang mengunggah ke bucket Supabase...
                      </span>
                    </div>

                    <!-- Input URL (terisi otomatis saat upload, atau bisa diketik manual) -->
                    <input
                      v-model="filmForm.poster_url"
                      type="url"
                      placeholder="Atau tempel URL gambar poster (https://...)"
                      class="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 text-[11px]"
                    />
                    <p class="text-[10px] text-zinc-500">
                      File foto otomatis di-upload ke bucket <span class="text-amber-400 font-mono">film-posters</span> di Supabase Storage dan link publiknya langsung terpasang.
                    </p>
                  </div>
                </div>
              </div>

              <div class="sm:col-span-2">
                <label class="block font-semibold text-zinc-400 mb-1">Sinopsis Lengkap *</label>
                <textarea
                  v-model="filmForm.synopsis"
                  rows="3"
                  required
                  placeholder="Tulis sinopsis film..."
                  class="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white resize-none"
                />
              </div>
            </div>

            <!-- Toggles -->
            <div class="flex items-center space-x-6 pt-2">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input v-model="filmForm.is_active" type="checkbox" class="rounded text-amber-500 focus:ring-amber-500" />
                <span class="text-zinc-300 font-medium">Aktifkan di Katalog Publik</span>
              </label>

              <label class="flex items-center space-x-2 cursor-pointer">
                <input v-model="filmForm.featured" type="checkbox" class="rounded text-amber-500 focus:ring-amber-500" />
                <span class="text-zinc-300 font-medium">Jadikan Sorotan (Hero Featured)</span>
              </label>
            </div>

            <!-- Submit Button -->
            <div class="pt-4 border-t border-zinc-800 flex justify-end space-x-3">
              <button
                type="button"
                @click="showFilmModal = false"
                class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                :disabled="isSavingFilm"
                class="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-md active:scale-95 disabled:opacity-50"
              >
                {{ isSavingFilm ? 'Menyimpan ke Database...' : 'Simpan Film' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Global Toast -->
    <Teleport to="body">
      <div
        v-if="showToast"
        class="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-zinc-900 border border-amber-500/50 shadow-2xl text-white text-xs flex items-center space-x-3"
      >
        <span class="text-amber-400">✓</span>
        <span>{{ toastMessage }}</span>
      </div>
    </Teleport>
  </div>
</template>
