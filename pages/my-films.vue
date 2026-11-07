<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import type { DonationRecord } from '~/types'

const { user, isAuthenticated, openAuthModal, getUserDonations } = useAuth()

const userDonations = ref<DonationRecord[]>([])
const isLoading = ref(true)

const loadUserDonations = async () => {
  if (!user.value) {
    userDonations.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    const list = await getUserDonations()
    userDonations.value = list
  } catch (err) {
    console.warn('Load user donations notice:', err)
  } finally {
    isLoading.value = false
  }
}

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
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return isoString
  }
}

watch(user, async () => {
  await loadUserDonations()
})

onMounted(async () => {
  await loadUserDonations()
})
</script>

<template>
  <div class="space-y-8 pb-16">
    <!-- Header Section -->
    <div class="border-b border-zinc-800/80 pb-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center space-x-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Koleksi Film Saya
            </h1>
          </div>
          <p class="text-xs sm:text-sm text-zinc-400">
            Daftar film independen Sineas HSS yang telah Anda apresiasi dan dapat Anda tonton ulang kapan saja.
          </p>
        </div>

        <NuxtLink
          to="/"
          class="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl self-start sm:self-auto hover:border-zinc-700 transition-colors"
        >
          <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Eksplor Film Lainnya</span>
        </NuxtLink>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- JIKA USER BELUM LOGIN                                                -->
    <!-- ==================================================================== -->
    <div
      v-if="!isAuthenticated"
      class="rounded-3xl border border-zinc-800 bg-zinc-950/70 backdrop-blur-md p-8 sm:p-14 text-center max-w-xl mx-auto space-y-6 shadow-2xl"
    >
      <div class="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/5">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

      <div class="space-y-2">
        <h3 class="text-xl sm:text-2xl font-black text-white">
          Masuk ke Akun Anda
        </h3>
        <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
          Silakan masuk atau buat akun untuk melihat daftar film yang telah Anda dukung melalui donasi Pay-as-you-wish.
        </p>
      </div>

      <div class="pt-2 flex justify-center gap-3">
        <button
          type="button"
          @click="openAuthModal('login')"
          class="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
          Masuk Sekarang
        </button>
        <button
          type="button"
          @click="openAuthModal('register')"
          class="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs border border-zinc-800 transition-colors"
        >
          Daftar Akun Baru
        </button>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- JIKA USER SUDAH LOGIN                                                -->
    <!-- ==================================================================== -->
    <div v-else class="space-y-8">
      
      <!-- Summary Stats Card -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block mb-1">
            Film Terbuka
          </span>
          <div class="text-2xl font-black text-white flex items-center space-x-2">
            <span>{{ userDonations.length }} Film</span>
            <span class="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Aktif Selamanya
            </span>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block mb-1">
            Total Apresiasi Donasi Anda
          </span>
          <div class="text-2xl font-black text-amber-400 font-mono">
            {{ formatRupiah(userDonations.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)) }}
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <span class="text-zinc-500 text-xs font-semibold uppercase tracking-wider block mb-1">
            Status Akun
          </span>
          <div class="text-xs font-medium text-zinc-300 flex items-center space-x-1.5 mt-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500" />
            <span class="truncate">{{ user.email }}</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="i in 3" :key="i" class="h-64 rounded-2xl bg-zinc-900/40 border border-zinc-800 animate-pulse" />
      </div>

      <!-- Unlocked Films List -->
      <div v-else-if="userDonations.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <article
          v-for="donation in userDonations"
          :key="donation.id"
          class="group rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden flex flex-col hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300"
        >
          <!-- Thumbnail / Poster -->
          <div class="relative aspect-video w-full overflow-hidden bg-black">
            <img
              :src="donation.films?.poster_url || donation.films?.banner_url || 'https://images.unsplash.com/photo-1509281373149-e957c6296406?q=80&w=800&auto=format&fit=crop'"
              :alt="donation.films?.title || donation.film_id"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

            <!-- Unlocked Pill -->
            <div class="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500 text-black shadow-md flex items-center space-x-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Akses Terbuka</span>
            </div>

            <span class="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-mono text-zinc-300 bg-zinc-950/80 border border-zinc-800">
              Didonasikan: {{ formatRupiah(donation.amount) }}
            </span>
          </div>

          <!-- Content Details -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                <span>{{ donation.films?.genre || 'Film Pendek' }}</span>
                <span>{{ donation.films?.year || '2025' }}</span>
              </div>

              <h3 class="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                {{ donation.films?.title || donation.film_id }}
              </h3>

              <p class="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                {{ donation.films?.synopsis || 'Terima kasih atas donasi Anda untuk mendukung karya ini.' }}
              </p>

              <!-- Personal message note if exists -->
              <div v-if="donation.message" class="mt-3 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-[11px] text-zinc-400 italic">
                Pesan Anda: "{{ donation.message }}"
              </div>
            </div>

            <!-- Action -->
            <div class="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
              <span class="text-[10px] text-zinc-500">
                Tanggal: {{ formatDate(donation.created_at) }}
              </span>

              <NuxtLink
                :to="`/stream/${donation.films?.slug || donation.film_id}`"
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-extrabold shadow-md transition-all duration-200 active:scale-95 flex items-center space-x-1.5"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
                <span>Tonton Film</span>
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State for Logged In User -->
      <div v-else class="text-center py-16 bg-zinc-950/50 rounded-3xl border border-zinc-800 space-y-4">
        <div class="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-white">Belum Ada Film yang Didonasikan</h3>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Anda belum pernah berdonasi untuk film apapun. Pilih film dari katalog kami dan dukung sineas lokal Banua.
          </p>
        </div>
        <div class="pt-2">
          <NuxtLink
            to="/"
            class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition-colors"
          >
            <span>Jelajahi Katalog Film Sekarang</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

