<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

const {
  user,
  isAuthenticated,
  isAdmin,
  userName,
  showAuthModal,
  authModalMode,
  authPromptMessage,
  isAuthLoading,
  initAuth,
  signIn,
  signUp,
  signOut,
  openAuthModal,
  closeAuthModal
} = useAuth()

// Modal Form State
const authEmail = ref('')
const authPassword = ref('')
const authFullName = ref('')
const authError = ref('')
const authSuccess = ref('')
const showPassword = ref(false)

const handleModalAuth = async () => {
  authError.value = ''
  authSuccess.value = ''

  if (!authEmail.value || !authPassword.value) {
    authError.value = 'Email dan kata sandi wajib diisi.'
    return
  }

  if (authPassword.value.length < 6) {
    authError.value = 'Kata sandi minimal 6 karakter.'
    return
  }

  if (authModalMode.value === 'login') {
    const { error } = await signIn(authEmail.value, authPassword.value)
    if (error) {
      if (error.message?.toLowerCase().includes('not confirmed')) {
        authError.value = `Email "${authEmail.value}" belum terkonfirmasi di Supabase Auth. Jalankan perintah di SQL Editor: UPDATE auth.users SET email_confirmed_at = now() WHERE email = '${authEmail.value}';`
      } else {
        authError.value = error.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.'
      }
    } else {
      authSuccess.value = 'Berhasil masuk!'
    }
  } else {
    if (!authFullName.value.trim()) {
      authError.value = 'Nama lengkap wajib diisi.'
      return
    }

    const { error } = await signUp(authEmail.value, authPassword.value, authFullName.value)
    if (error) {
      if (error.message?.toLowerCase().includes('rate limit')) {
        authError.value = 'Batas kirim email verifikasi Supabase terlampaui. Silakan nonaktifkan "Confirm email" di Supabase Dashboard (Authentication > Providers > Email).'
      } else {
        authError.value = error.message || 'Pendaftaran gagal.'
      }
    } else {
      authSuccess.value = 'Akun berhasil dibuat! Silakan masuk.'
    }
  }
}

onMounted(() => {
  initAuth()
})
</script>

<template>
  <div class="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-amber-500 selection:text-black flex flex-col justify-between">
    <!-- Ambient Cinema Lighting -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="absolute -top-40 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[130px]" />
      <div class="absolute top-1/3 -right-40 w-96 h-96 bg-amber-600/5 rounded-full blur-[150px]" />
      <div class="absolute bottom-10 left-1/3 w-80 h-80 bg-zinc-800/20 rounded-full blur-[120px]" />
    </div>

    <!-- ==================================================================== -->
    <!-- GLOBAL NAVBAR                                                        -->
    <!-- ==================================================================== -->
    <header class="relative z-30 border-b border-zinc-800/80 bg-[#09090b]/85 backdrop-blur-md sticky top-0">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <!-- Brand Logo -->
        <NuxtLink to="/" class="flex items-center space-x-3 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <svg class="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="text-lg font-black tracking-tight text-white">SINEAS</span>
              <span class="text-lg font-black text-amber-500">HSS</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 uppercase tracking-widest">
                STREAM
              </span>
            </div>
            <p class="text-[10px] text-zinc-400 hidden sm:block">Komunitas Film Hulu Sungai Selatan</p>
          </div>
        </NuxtLink>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center space-x-1 text-xs font-semibold">
          <NuxtLink
            to="/"
            exact-active-class="bg-zinc-800 text-amber-400 font-bold border-zinc-700"
            class="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 border border-transparent transition-all"
          >
            🎬 Katalog Film
          </NuxtLink>

          <NuxtLink
            to="/my-films"
            exact-active-class="bg-zinc-800 text-amber-400 font-bold border-zinc-700"
            class="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 border border-transparent transition-all flex items-center space-x-1.5"
          >
            <span>🎟️ Film Saya</span>
            <span v-if="isAuthenticated" class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </NuxtLink>

          <NuxtLink
            to="/admin"
            exact-active-class="bg-zinc-800 text-amber-400 font-bold border-zinc-700"
            class="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 border border-transparent transition-all flex items-center space-x-1.5"
          >
            <span>⚡ Admin</span>
            <span v-if="isAdmin" class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-black">
              ADMIN
            </span>
          </NuxtLink>
        </nav>

        <!-- Auth Controls -->
        <div class="flex items-center space-x-3 text-xs">
          <!-- Logged In State -->
          <div v-if="isAuthenticated" class="flex items-center space-x-3">
            <NuxtLink
              to="/my-films"
              class="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-colors"
            >
              <div class="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
                {{ userName.charAt(0).toUpperCase() }}
              </div>
              <span class="truncate max-w-[120px] font-medium">{{ userName }}</span>
            </NuxtLink>

            <button
              type="button"
              @click="signOut"
              class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 text-xs font-semibold transition-colors"
            >
              Keluar
            </button>
          </div>

          <!-- Logged Out State -->
          <div v-else class="flex items-center space-x-2">
            <button
              type="button"
              @click="openAuthModal('login')"
              class="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white font-semibold transition-colors"
            >
              Masuk
            </button>
            <button
              type="button"
              @click="openAuthModal('register')"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              Daftar
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ==================================================================== -->
    <!-- MAIN ROUTER VIEW (<NuxtPage />)                                      -->
    <!-- ==================================================================== -->
    <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full">
      <NuxtPage />
    </main>

    <!-- ==================================================================== -->
    <!-- GLOBAL FOOTER                                                        -->
    <!-- ==================================================================== -->
    <footer class="relative z-10 border-t border-zinc-900 bg-zinc-950/80 py-8 text-xs text-zinc-500">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center space-x-2">
          <span class="font-bold text-zinc-300">Sineas HSS Stream</span>
          <span>•</span>
          <span>Platform Pemutaran Film Komunitas Pay-as-you-wish</span>
        </div>
        <div>
          <span>Hulu Sungai Selatan, Kalimantan Selatan © {{ new Date().getFullYear() }}</span>
        </div>
      </div>
    </footer>

    <!-- ==================================================================== -->
    <!-- GLOBAL AUTH MODAL (LOGIN & REGISTER KE DATABASE SUPABASE)            -->
    <!-- ==================================================================== -->
    <Teleport to="body">
      <div
        v-if="showAuthModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <div class="relative w-full max-w-sm rounded-3xl bg-[#121216] border border-zinc-700/80 p-6 sm:p-7 shadow-2xl space-y-5">
          <!-- Close Button -->
          <button
            type="button"
            @click="closeAuthModal"
            class="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800"
          >
            ✕
          </button>

          <!-- Modal Header -->
          <div class="text-center space-y-1">
            <h3 class="text-lg font-black text-white">
              {{ authModalMode === 'login' ? 'Masuk ke Akun Anda' : 'Daftar Akun Baru' }}
            </h3>
            <p v-if="authPromptMessage" class="text-xs text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              {{ authPromptMessage }}
            </p>
            <p v-else class="text-xs text-zinc-400">
              Simpan film yang Anda donasikan di database dan tonton kapan saja tanpa batas.
            </p>
          </div>

          <!-- Switcher -->
          <div class="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 text-xs font-bold">
            <button
              type="button"
              @click="authModalMode = 'login'; authError = ''; authSuccess = ''"
              :class="[
                'flex-1 py-1.5 rounded-lg transition-all',
                authModalMode === 'login' ? 'bg-amber-500 text-black' : 'text-zinc-400'
              ]"
            >
              Masuk
            </button>
            <button
              type="button"
              @click="authModalMode = 'register'; authError = ''; authSuccess = ''"
              :class="[
                'flex-1 py-1.5 rounded-lg transition-all',
                authModalMode === 'register' ? 'bg-amber-500 text-black' : 'text-zinc-400'
              ]"
            >
              Daftar
            </button>
          </div>

          <!-- Alerts -->
          <div v-if="authError" class="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {{ authError }}
          </div>
          <div v-if="authSuccess" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            {{ authSuccess }}
          </div>

          <!-- Form -->
          <form @submit.prevent="handleModalAuth" class="space-y-3.5 text-xs">
            <div v-if="authModalMode === 'register'">
              <label class="block font-semibold text-zinc-400 mb-1">Nama Lengkap</label>
              <input
                v-model="authFullName"
                type="text"
                required
                placeholder="Dian Banua"
                class="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label class="block font-semibold text-zinc-400 mb-1">Alamat Email</label>
              <input
                v-model="authEmail"
                type="email"
                required
                placeholder="nama@email.com"
                class="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label class="block font-semibold text-zinc-400 mb-1">Kata Sandi</label>
              <div class="relative">
                <input
                  v-model="authPassword"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  placeholder="Minimal 6 karakter"
                  class="w-full pl-3 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  tabindex="-1"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-amber-400 transition-colors p-1"
                  :title="showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'"
                >
                  <!-- Eye Open -->
                  <svg v-if="showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <!-- Eye Slash -->
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="isAuthLoading"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              {{ authModalMode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun Baru' }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
