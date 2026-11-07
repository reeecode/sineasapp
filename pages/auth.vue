<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { isAuthenticated, signIn, signUp, isAuthLoading } = useAuth()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const fullName = ref('')
const errorMessage = ref('')
const successMessage = ref('')

if (isAuthenticated.value) {
  router.push((route.query.redirect as string) || '/')
}

const handleAuth = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan kata sandi wajib diisi.'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Kata sandi minimal 6 karakter.'
    return
  }

  if (mode.value === 'login') {
    const { error } = await signIn(email.value, password.value)
    if (error) {
      errorMessage.value = error.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.'
    } else {
      successMessage.value = 'Login berhasil! Mengalihkan...'
      setTimeout(() => {
        router.push((route.query.redirect as string) || '/')
      }, 700)
    }
  } else {
    if (!fullName.value.trim()) {
      errorMessage.value = 'Nama lengkap wajib diisi.'
      return
    }

    const { error } = await signUp(email.value, password.value, fullName.value)
    if (error) {
      errorMessage.value = error.message || 'Pendaftaran gagal. Silakan coba kembali.'
    } else {
      successMessage.value = 'Akun berhasil dibuat! Silakan cek email Anda jika verifikasi aktif, atau langsung masuk.'
      setTimeout(() => {
        router.push((route.query.redirect as string) || '/')
      }, 900)
    }
  }
}
</script>

<template>
  <div class="min-h-[75vh] flex items-center justify-center py-10 px-4">
    <div class="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-md p-6 sm:p-8 shadow-2xl space-y-6">
      
      <!-- Brand Header -->
      <div class="text-center space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 text-black font-black text-xl">
          🎬
        </div>
        <h1 class="text-2xl font-black text-white tracking-tight">
          SINEAS <span class="text-amber-500">HSS</span>
        </h1>
        <p class="text-xs text-zinc-400">
          Masuk dengan akun terdaftar untuk menyimpan film yang Anda donasikan di database.
        </p>
      </div>

      <!-- Mode Switcher Tabs -->
      <div class="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1">
        <button
          type="button"
          @click="mode = 'login'; errorMessage = ''; successMessage = ''"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
            mode === 'login' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
          ]"
        >
          Masuk ke Akun
        </button>
        <button
          type="button"
          @click="mode = 'register'; errorMessage = ''; successMessage = ''"
          :class="[
            'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
            mode === 'register' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
          ]"
        >
          Daftar Akun Baru
        </button>
      </div>

      <!-- Alerts -->
      <div v-if="errorMessage" class="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
        {{ successMessage }}
      </div>

      <!-- Form Inputs -->
      <form @submit.prevent="handleAuth" class="space-y-4">
        <div v-if="mode === 'register'">
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Nama Lengkap
          </label>
          <input
            v-model="fullName"
            type="text"
            required
            placeholder="Contoh: Dian Banua"
            class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Alamat Email
          </label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="nama@email.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Kata Sandi
          </label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="Minimal 6 karakter"
            class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          :disabled="isAuthLoading"
          class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <svg v-if="isAuthLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>{{ mode === 'login' ? 'Masuk Sekarang' : 'Daftar Akun Baru' }}</span>
        </button>
      </form>
    </div>
  </div>
</template>
