<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFilms } from '~/composables/useFilms'
import { useAuth } from '~/composables/useAuth'
import type { Film } from '~/types'

const { films, isLoadingFilms, fetchFilms } = useFilms()
const { user, getUserDonations } = useAuth()

const searchQuery = ref('')
const selectedGenre = ref('Semua')
const userUnlockedFilmIds = ref<Set<string>>(new Set())

const genres = ['Semua', 'Horor', 'Drama', 'Dokumenter']

// Featured Hero Film
const featuredFilm = computed<Film | null>(() => {
  if (films.value.length === 0) return null
  return films.value.find((f) => f.featured) || films.value[0]
})

// Filtered Films List
const filteredFilms = computed(() => {
  return films.value.filter((film) => {
    const matchesSearch =
      film.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      film.director.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      film.genre.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesGenre =
      selectedGenre.value === 'Semua' ||
      film.genre.toLowerCase().includes(selectedGenre.value.toLowerCase())

    return matchesSearch && matchesGenre
  })
})

const checkUserUnlockedFilms = async () => {
  if (!user.value) {
    userUnlockedFilmIds.value.clear()
    return
  }
  const donations = await getUserDonations()
  const unlocked = new Set<string>()
  donations.forEach((d) => {
    if (d.film_id) unlocked.add(d.film_id)
    if (d.films?.id) unlocked.add(d.films.id)
    if (d.films?.slug) unlocked.add(d.films.slug)
  })
  userUnlockedFilmIds.value = unlocked
}

onMounted(async () => {
  await fetchFilms()
  await checkUserUnlockedFilms()
})

// Watch auth changes
watch(user, async () => {
  await checkUserUnlockedFilms()
})
</script>

<template>
  <div class="space-y-12 pb-16">
    <!-- ==================================================================== -->
    <!-- HERO SPOTLIGHT BANNER                                                -->
    <!-- ==================================================================== -->
    <section v-if="featuredFilm" class="relative rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950">
      <!-- Background Ambient Image with Gradient Overlay -->
      <div class="absolute inset-0 z-0 pointer-events-none">
        <img
          :src="featuredFilm.banner_url || featuredFilm.poster_url"
          :alt="featuredFilm.title"
          class="w-full h-full object-cover object-center opacity-20 filter saturate-150 blur-[3px] transform scale-105"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/85 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/90 to-transparent" />
      </div>

      <!-- Spotlight Content (Struktur 2 Kolom: Kiri Detail, Kanan Foto Film) -->
      <div class="relative z-10 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        
        <!-- KOLOM KIRI (Span 7-8): Detail Film & Call-to-Action -->
        <div class="lg:col-span-7 xl:col-span-8 space-y-5">
          <!-- Badges -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-black tracking-wider uppercase shadow-md shadow-amber-500/20">
              ★ SOROTAN UTAMA PREMIERE
            </span>
            <span v-if="featuredFilm.year" class="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-zinc-700">
              {{ featuredFilm.year }}
            </span>
            <span v-if="featuredFilm.duration" class="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-zinc-700">
              {{ featuredFilm.duration }}
            </span>
            <span v-if="featuredFilm.genre" class="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
              {{ featuredFilm.genre }}
            </span>
          </div>

          <!-- Title -->
          <h1 class="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            {{ featuredFilm.title }}
          </h1>

          <!-- Synopsis -->
          <p class="text-sm sm:text-base text-zinc-300 leading-relaxed line-clamp-3">
            {{ featuredFilm.synopsis }}
          </p>

          <!-- Director / Metadata -->
          <div v-if="(featuredFilm.director && featuredFilm.director !== 'null') || (featuredFilm.production && featuredFilm.production !== 'null')" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 pt-1">
            <div v-if="featuredFilm.director && featuredFilm.director !== 'null'">
              Sutradara: <span class="text-zinc-200 font-semibold">{{ featuredFilm.director }}</span>
            </div>
            <span v-if="(featuredFilm.director && featuredFilm.director !== 'null') && (featuredFilm.production && featuredFilm.production !== 'null')">•</span>
            <div v-if="featuredFilm.production && featuredFilm.production !== 'null'">
              Produksi: <span class="text-zinc-200 font-semibold">{{ featuredFilm.production }}</span>
            </div>
          </div>

          <!-- Action CTA -->
          <div class="pt-4 flex flex-wrap items-center gap-4">
            <NuxtLink
              :to="`/stream/${featuredFilm.slug}`"
              class="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm shadow-xl shadow-amber-500/25 transition-all duration-200 active:scale-95 flex items-center space-x-2.5"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
              <span>Tonton Pemutaran Streaming</span>
            </NuxtLink>

            <!-- Status badge if user unlocked -->
            <div
              v-if="userUnlockedFilmIds.has(featuredFilm.id)"
              class="flex items-center space-x-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 rounded-2xl"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Sudah Terbuka di Koleksi Anda</span>
            </div>
          </div>
        </div>

        <!-- KOLOM KANAN (Span 4-5): Foto Film Premiere Murni (Tanpa Overlay / Badge) -->
        <div class="lg:col-span-5 xl:col-span-4 flex justify-center lg:justify-end">
            <img
              :src="featuredFilm.poster_url || featuredFilm.banner_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop'"
              :alt="featuredFilm.title"
              class="w-full h-full max-w-[300px] sm:max-w-[350px] lg:max-w-[400px] rounded-2xl object-cover shadow-2xl shadow-black/50 transition-transform duration-500 hover:scale-105" 
            />
         
        </div>
      </div>
    </section>

    <!-- ==================================================================== -->
    <!-- KATALOG FILM KOMUNITAS & FILTER                                      -->
    <!-- ==================================================================== -->
    <section class="space-y-6">
      <!-- Section Header & Filter Controls -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div class="flex items-center space-x-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight">
              Katalog Film Sineas HSS
            </h2>
          </div>
          <p class="text-xs text-zinc-400">
            Dukung karya sineas lokal Hulu Sungai Selatan dengan model apresiasi Pay-as-you-wish.
          </p>
        </div>

        <!-- Filter & Search Controls -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Genre Tabs -->
          <div class="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              v-for="genre in genres"
              :key="genre"
              type="button"
              @click="selectedGenre = genre"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                selectedGenre === genre
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              ]"
            >
              {{ genre }}
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari film atau sutradara..."
              class="w-48 sm:w-60 pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
            <svg class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Film Grid -->
      <div v-if="filteredFilms.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <article
          v-for="film in filteredFilms"
          :key="film.id"
          class="group rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden flex flex-col hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300"
        >
          <!-- Thumbnail / Poster -->
          <div class="relative aspect-video sm:aspect-[4/3] w-full overflow-hidden bg-black">
            <img
              :src="film.poster_url || film.banner_url"
              :alt="film.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

            <!-- Duration Badge -->
            <span class="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-950/80 backdrop-blur-md text-zinc-300 border border-zinc-800">
              {{ film.duration }}
            </span>

            <!-- Status Unlocked Badge -->
            <div
              v-if="userUnlockedFilmIds.has(film.id)"
              class="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-black shadow-md flex items-center space-x-1"
            >
              <span>🔓 Tersimpan</span>
            </div>
            <div
              v-else
              class="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-900/90 text-amber-400 border border-amber-500/30"
            >
              Pay-as-you-wish
            </div>

            <!-- Play Overlay on Hover -->
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <div class="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                <svg class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Card Content -->
          <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <div class="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                <span>{{ film.genre }}</span>
                <span>{{ film.year }}</span>
              </div>
              <h3 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                {{ film.title }}
              </h3>
              <p class="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                {{ film.synopsis }}
              </p>
            </div>

            <!-- Card Footer -->
            <div class="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <span class="text-[11px] text-zinc-500">
                Sutradara: <strong class="text-zinc-300 font-medium">{{ film.director && film.director !== 'null' ? film.director : '-' }}</strong>
              </span>

              <NuxtLink
                :to="`/stream/${film.slug}`"
                class="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 border border-amber-500/30 hover:border-amber-500 text-amber-400 hover:text-black text-xs font-bold transition-all duration-200"
              >
                {{ userUnlockedFilmIds.has(film.id) ? 'Tonton Ulang' : 'Buka Stream' }}
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16 bg-zinc-950/60 rounded-3xl border border-zinc-800 space-y-3">
        <svg class="w-12 h-12 text-zinc-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
        <template v-if="films.length === 0">
          <h4 class="text-base font-bold text-white">Belum Ada Film di Database</h4>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Database Anda masih kosong dan siap diisi. Silakan buka Dashboard Admin untuk menambahkan film perdana secara langsung.
          </p>
          <div class="pt-2">
            <NuxtLink
              to="/admin"
              class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
            >
              <span>+ Kelola & Tambah Film di Admin</span>
            </NuxtLink>
          </div>
        </template>
        <template v-else>
          <h4 class="text-base font-bold text-white mb-1">Tidak ada film ditemukan</h4>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Coba ganti kata kunci pencarian atau pilih kategori genre yang lain.
          </p>
        </template>
      </div>
    </section>

    <!-- ==================================================================== -->
    <!-- KOMUNITAS & PAY-AS-YOU-WISH EXPLANATION BANNER                       -->
    <!-- ==================================================================== -->
    <section class="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-10 relative overflow-hidden">
      <div class="max-w-2xl space-y-3 relative z-10">
        <span class="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
          Gerakan Sinema Banua
        </span>
        <h3 class="text-2xl sm:text-3xl font-black text-white">
          Mengapa Pay-as-you-wish?
        </h3>
        <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Kami percaya sinema lokal harus dapat diakses oleh siapa saja tanpa hambatan tiket yang kaku. Melalui model Pay-as-you-wish, setiap donasi sukarela langsung masuk ke kas produksi komunitas untuk membiayai produksi karya-karya berikutnya, sewa alat sinematografi, dan lokakarya pembuat film muda di Hulu Sungai Selatan.
        </p>
      </div>
    </section>
  </div>
</template>

