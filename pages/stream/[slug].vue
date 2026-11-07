<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabase } from '~/utils/supabase'
import { useFilms } from '~/composables/useFilms'
import { useAuth } from '~/composables/useAuth'
import type { Film, DonationRecord } from '~/types'

const route = useRoute()
const slug = computed(() => (route.params.slug as string) || '')

const { fetchFilmBySlug } = useFilms()
const { user, isAuthenticated, openAuthModal, hasUnlockedFilm } = useAuth()
const supabase = useSupabase()

// Film & Player State
const film = ref<Film | null>(null)
const isLoadingFilm = ref(true)
const isLocked = ref(true)
const isAlreadyUnlockedByUser = ref(false)
const isPlayerReady = ref(false)
let ytPlayer: any = null

// Donation Form State
const instantAmounts = [10000, 25000, 50000, 100000]
const selectedAmount = ref<number>(25000)
const customAmount = ref<number | ''>('')
const donorName = ref('')
const donorMessage = ref('')
const isSubmitting = ref(false)
const formError = ref('')

// QRIS Modal & Active Order State
const config = useRuntimeConfig()
const tiptipPageUrl = computed(() => (config.public?.tiptipPageUrl as string) || 'https://tiptip.co')
const modalPaymentMethod = ref<'tiptip' | 'qris'>('tiptip')
const showQrisModal = ref(false)
const currentOrder = ref<DonationRecord | null>(null)
const isSimulatingPayment = ref(false)
const copySuccess = ref(false)
const copyRefSuccess = ref(false)
const copyMsgSuccess = ref(false)

// Helper Generator Kode Unik Ref TipTip (Format: HSS-XXXX)
const generateRefCode = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = 'HSS-'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Feed & Realtime State
const donationsList = ref<DonationRecord[]>([])
const isLoadingFeed = ref(true)
const toastMessage = ref('')
const showToast = ref(false)

let orderRealtimeChannel: any = null
let feedRealtimeChannel: any = null

// Computed Values
const finalAmount = computed<number>(() => {
  if (customAmount.value && Number(customAmount.value) > 0) {
    return Number(customAmount.value)
  }
  return selectedAmount.value || 25000
})

const qrisQrUrl = computed(() => {
  if (!currentOrder.value) return ''
  const payload = `00020101021226670016ID.CO.SINEAS-HSS.WWW01189360099900000000010215${currentOrder.value.id.slice(0, 15)}520458125303360540${currentOrder.value.amount}5802ID5910SINEAS HSS6009KANDANGAN`
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(payload)}`
})

// Helpers
const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatRelativeTime = (isoString: string): string => {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return 'Baru saja'
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    return `${diffDays} hari lalu`
  } catch {
    return 'Beberapa waktu lalu'
  }
}

const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 6000)
}

const copyOrderId = async () => {
  if (!currentOrder.value) return
  try {
    await navigator.clipboard.writeText(currentOrder.value.id)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const copyRefCode = async () => {
  if (!currentOrder.value?.ref_code) return
  try {
    await navigator.clipboard.writeText(currentOrder.value.ref_code)
    copyRefSuccess.value = true
    setTimeout(() => {
      copyRefSuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy ref code', err)
  }
}

const copyTipTipMessage = async () => {
  if (!currentOrder.value) return
  const text = `Dukungan untuk film ${film.value?.title || 'Sineas HSS'} - ${currentOrder.value.ref_code}`
  try {
    await navigator.clipboard.writeText(text)
    copyMsgSuccess.value = true
    setTimeout(() => {
      copyMsgSuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy TipTip message', err)
  }
}

const openTipTipAndCopyCode = async () => {
  if (!currentOrder.value) return
  const text = `Dukungan untuk film ${film.value?.title || 'Sineas HSS'} - ${currentOrder.value.ref_code}`
  try {
    await navigator.clipboard.writeText(text)
    copyMsgSuccess.value = true
    triggerToast(`Kode ${currentOrder.value.ref_code} tersalin! Halaman TipTip terbuka di tab baru.`)
  } catch (err) {
    console.error('Failed to copy', err)
  }

  if (typeof window !== 'undefined') {
    window.open(tiptipPageUrl.value, '_blank', 'noopener,noreferrer')
  }
}

// ==============================================================================
// YouTube Iframe API Integration
// ==============================================================================
const initYouTubePlayer = (videoId: string) => {
  if (typeof window === 'undefined') return

  const origin = window.location.origin || 'http://localhost:3000'

  const createPlayer = () => {
    if (ytPlayer && typeof ytPlayer.destroy === 'function') {
      ytPlayer.destroy()
    }

    if (!(window as any).YT || !(window as any).YT.Player) return

    ytPlayer = new (window as any).YT.Player('yt-player', {
      videoId: videoId || 'M7lc1UVf-VE',
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: origin,
        playsinline: 1
      },
      events: {
        onReady: () => {
          isPlayerReady.value = true
          if (!isLocked.value && ytPlayer) {
            try {
              ytPlayer.playVideo()
            } catch (err) {
              console.warn('Auto play notice:', err)
            }
          }
        },
        onError: (e: any) => {
          console.warn('YouTube Player error:', e)
        }
      }
    })
  }

  if ((window as any).YT && (window as any).YT.Player) {
    createPlayer()
  } else {
    (window as any).onYouTubeIframeAPIReady = () => {
      createPlayer()
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      } else {
        document.head.appendChild(tag)
      }
    }
  }
}

// ==============================================================================
// Cek Hak Akses Film User & Feed Donasi
// ==============================================================================
const checkUserAccess = async () => {
  if (!film.value) return

  if (user.value) {
    const unlocked = await hasUnlockedFilm(film.value.id, film.value.slug)
    if (unlocked) {
      isLocked.value = false
      isAlreadyUnlockedByUser.value = true
      return
    }
  }

  isLocked.value = true
  isAlreadyUnlockedByUser.value = false
}

const fetchDonationsFeed = async () => {
  if (!film.value) return
  isLoadingFeed.value = true
  try {
    const { data, error } = await supabase
      .from('donations')
      .select('*')
      .eq('film_id', film.value.id)
      .eq('status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error || !data) {
      donationsList.value = []
    } else {
      donationsList.value = data
    }
  } catch (err) {
    console.warn('Fetch feed error:', err)
  } finally {
    isLoadingFeed.value = false
  }
}

const subscribeToFeed = () => {
  if (!film.value) return
  try {
    feedRealtimeChannel = supabase
      .channel(`feed_${film.value.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donations'
        },
        (payload: any) => {
          const item = payload.new as DonationRecord
          if (item && item.film_id === film.value?.id && item.status === 'PAID') {
            const exists = donationsList.value.some((d) => d.id === item.id)
            if (!exists) {
              donationsList.value.unshift(item)
            } else {
              donationsList.value = donationsList.value.map((d) =>
                d.id === item.id ? item : d
              )
            }
          }
        }
      )
      .subscribe()
  } catch (err) {
    console.warn('Feed channel error:', err)
  }
}

// ==============================================================================
// Donasi & Realtime Auto-Unlock
// ==============================================================================
const handleSelectPreset = (amt: number) => {
  selectedAmount.value = amt
  customAmount.value = ''
}

const handleCustomInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const val = Number(target.value)
  if (val > 0) {
    customAmount.value = val
    selectedAmount.value = 0
  } else {
    customAmount.value = ''
  }
}

// Form Submission (Mengharuskan Login agar Film Tersimpan ke Akun)
const handleSubmitDonation = async () => {
  formError.value = ''

  if (!film.value) return

  // 1. Verifikasi Login: User harus login agar film yang didonasikan tersimpan di akunnya!
  if (!isAuthenticated.value) {
    openAuthModal(
      'login',
      `Silakan masuk atau buat akun terlebih dahulu agar film "${film.value.title}" tersimpan permanen di koleksi akun Anda.`,
      () => {
        // Callback setelah user berhasil login: otomatis lanjutkan submit
        handleSubmitDonation()
      }
    )
    return
  }

  if (!finalAmount.value || finalAmount.value < 1000) {
    formError.value = 'Nominal donasi minimal Rp 1.000'
    return
  }

  isSubmitting.value = true

  const generatedRefCode = generateRefCode()

  const donationData = {
    user_id: user.value.id, // Kaitkan dengan ID akun pengguna
    ref_code: generatedRefCode, // Kode unik TipTip format HSS-XXXX
    donor_name: donorName.value.trim() || user.value.user_metadata?.full_name || user.value.email?.split('@')[0] || 'Hamba Allah (Anonim)',
    amount: finalAmount.value,
    message: donorMessage.value.trim() || 'Apresiasi untuk pembuat film Banua!',
    film_id: film.value.id,
    status: 'PENDING'
  }

  try {
    const { data, error } = await supabase
      .from('donations')
      .insert(donationData)
      .select()
      .single()

    if (error) {
      console.error('Insert donation error:', error)
      formError.value = `Gagal membuat pesanan donasi di database: ${error.message}`
      return
    }

    if (!data) {
      formError.value = 'Gagal menyimpan transaksi donasi ke database.'
      return
    }

    currentOrder.value = data
    showQrisModal.value = true

    // Subscribe ke order realtime
    subscribeToOrderRealtime(data.id)
  } catch (err: any) {
    formError.value = `Terjadi kesalahan saat memproses pesanan donasi: ${err.message || err}`
    console.error('Submit donation error:', err)
  } finally {
    isSubmitting.value = false
  }
}

const subscribeToOrderRealtime = (orderId: string) => {
  if (orderRealtimeChannel) {
    supabase.removeChannel(orderRealtimeChannel)
    orderRealtimeChannel = null
  }

  try {
    orderRealtimeChannel = supabase
      .channel(`order_status_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'donations',
          filter: `id=eq.${orderId}`
        },
        (payload: any) => {
          const updated = payload.new as DonationRecord
          if (updated && updated.status === 'PAID') {
            onPaymentVerified(updated)
          }
        }
      )
      .subscribe()
  } catch (err) {
    console.warn('Realtime subscription error:', err)
  }
}

const onPaymentVerified = (paidRecord: DonationRecord) => {
  isLocked.value = false
  isAlreadyUnlockedByUser.value = true
  showQrisModal.value = false

  const exists = donationsList.value.some((d) => d.id === paidRecord.id)
  if (!exists) {
    donationsList.value.unshift(paidRecord)
  }

  triggerToast(
    `🎉 Donasi terverifikasi! Film "${film.value?.title}" kini tersimpan permanen di koleksi akun Anda.`
  )

  if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
    try {
      ytPlayer.playVideo()
    } catch (err) {
      console.warn('Play video notice:', err)
    }
  }

  if (orderRealtimeChannel) {
    supabase.removeChannel(orderRealtimeChannel)
    orderRealtimeChannel = null
  }

  donorMessage.value = ''
}

// Simulasi Webhook TipTip (Event: NEW_TIP)
const simulateInstantPayment = async () => {
  if (!currentOrder.value) return
  isSimulatingPayment.value = true

  const orderId = currentOrder.value.id
  const refCode = currentOrder.value.ref_code

  try {
    // 1. Panggil webhook server dengan payload TipTip dan parameter id/ref_code
    const res = await $fetch<{ success: boolean; data?: any }>('/api/webhook', {
      method: 'POST',
      body: {
        event: 'NEW_TIP',
        is_simulation: true,
        order_id: orderId,
        ref_code: refCode,
        data: {
          name: currentOrder.value.donor_name,
          amount: currentOrder.value.amount,
          message: `Dukungan karya perfilman Banua! ${refCode || ''}`
        }
      }
    }).catch(async (err) => {
      console.warn('Webhook notice, updating directly in database:', err)
      return null
    })

    // 2. Fail-safe update: pastikan status di database Supabase benar-benar 'PAID'
    let paidData = res?.data
    if (!paidData || paidData.status !== 'PAID') {
      const { data: directUpdated, error: directErr } = await supabase
        .from('donations')
        .update({ status: 'PAID' })
        .eq('id', orderId)
        .select()
        .single()

      if (!directErr && directUpdated) {
        paidData = directUpdated
      }
    }

    const updatedRecord: DonationRecord = paidData || {
      ...currentOrder.value,
      status: 'PAID'
    }

    setTimeout(() => {
      onPaymentVerified(updatedRecord)
      isSimulatingPayment.value = false
    }, 500)
  } catch (err) {
    console.error('Simulation error:', err)
    // Update langsung ke Supabase sebagai cadangan utama
    const { data: directUpdated } = await supabase
      .from('donations')
      .update({ status: 'PAID' })
      .eq('id', orderId)
      .select()
      .single()

    const updatedRecord: DonationRecord = directUpdated || {
      ...currentOrder.value,
      status: 'PAID'
    }
    onPaymentVerified(updatedRecord)
    isSimulatingPayment.value = false
  }
}

// Watch user login/logout state to update unlocked state
watch(user, async () => {
  await checkUserAccess()
})

onMounted(async () => {
  isLoadingFilm.value = true
  const loadedFilm = await fetchFilmBySlug(slug.value)
  film.value = loadedFilm

  if (loadedFilm) {
    initYouTubePlayer(loadedFilm.youtube_video_id)
    await checkUserAccess()
    await fetchDonationsFeed()
    subscribeToFeed()
  }
  isLoadingFilm.value = false
})

onBeforeUnmount(() => {
  if (orderRealtimeChannel) supabase.removeChannel(orderRealtimeChannel)
  if (feedRealtimeChannel) supabase.removeChannel(feedRealtimeChannel)
  if (ytPlayer && typeof ytPlayer.destroy === 'function') ytPlayer.destroy()
})
</script>

<template>
  <div v-if="film" class="space-y-8 pb-16">
    <!-- Back to Catalog Link & Title Bar -->
    <div class="flex items-center justify-between">
      <NuxtLink
        to="/"
        class="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition-colors py-1 px-2.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Kembali ke Katalog Film</span>
      </NuxtLink>

      <!-- User Unlocked Pill Banner -->
      <div
        v-if="isAlreadyUnlockedByUser"
        class="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
      >
        <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>Tersimpan di Koleksi Akun Anda</span>
      </div>
    </div>

    <!-- Main Grid: Left 2 Cols (Player & Synopsis), Right 1 Col (Donation Form & Feed) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      <!-- ==================================================================== -->
      <!-- KOLOM KIRI (Span 8): Player & Detail Film                           -->
      <!-- ==================================================================== -->
      <section class="lg:col-span-8 space-y-6">
        
        <!-- Cinema Player Container with 16:9 Aspect Ratio -->
        <div class="relative w-full rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl shadow-black/80 aspect-video group">
          
          <!-- YouTube Iframe Mounting Div -->
          <div id="yt-player" class="w-full h-full" />

          <!-- Locked Screen Overlay Layer (Active when isLocked === true) -->
          <div
            v-if="isLocked"
            class="absolute inset-0 bg-[#09090b]/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-all duration-700 z-20"
          >
            <!-- Animated Glowing Lock Icon -->
            <div class="relative mb-5">
              <div class="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
              <div class="relative w-20 h-20 rounded-2xl bg-zinc-900/90 border border-amber-500/40 flex items-center justify-center shadow-xl shadow-amber-500/10">
                <svg class="w-10 h-10 text-amber-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <!-- Locked Badge & Heading -->
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest mb-3">
              Layar Pemutaran Terkunci
            </span>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight max-w-lg mb-2">
              Apresiasi Pay-As-You-Wish
            </h2>
            <p class="text-sm sm:text-base text-zinc-400 max-w-md leading-relaxed mb-6">
              Film <span class="text-zinc-200 font-semibold">"{{ film.title }}"</span> diputar berbasis donasi sukarela. Donasi Anda akan langsung membuka pemutaran dan <span class="text-amber-400 font-medium">tersimpan permanen di akun Anda</span>.
            </p>

            <!-- Auth Hint if Not Logged In -->
            <div v-if="!isAuthenticated" class="mb-5 px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700 text-xs text-zinc-300 flex items-center space-x-2">
              <span class="text-amber-400">💡</span>
              <span>Masuk dengan akun Anda sebelum berdonasi agar film tersimpan ke koleksi.</span>
            </div>

            <!-- CTA Button -->
            <button
              type="button"
              @click="handleSubmitDonation"
              class="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold text-sm shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition-all duration-200 active:scale-95"
            >
              <span>{{ isAuthenticated ? 'Berdonasi & Buka Pemutar Film' : 'Masuk & Buka Pemutaran' }}</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <!-- Unlocked Banner Overlay Indicator (when isLocked === false) -->
          <div
            v-else
            class="absolute top-4 left-4 z-10 flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-950/80 backdrop-blur-md border border-amber-500/40 text-xs font-medium text-amber-400 shadow-lg pointer-events-none transition-opacity duration-500"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <span>Akses Terbuka • Selamat Menonton</span>
          </div>
        </div>

        <!-- Film Metadata & Synopsis Card -->
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-6 sm:p-8 space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500 text-black">
                  OFFICIAL SCREENING
                </span>
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {{ film.duration }}
                </span>
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400">
                  {{ film.genre }}
                </span>
              </div>
              <h1 class="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {{ film.title }} <span class="text-amber-500 font-light text-2xl sm:text-3xl">({{ film.year }})</span>
              </h1>
            </div>

            <!-- Community Production Badge -->
            <div class="flex items-center space-x-3 bg-zinc-950/60 border border-zinc-800 px-4 py-2.5 rounded-xl self-start sm:self-auto">
              <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                HSS
              </div>
              <div class="text-left text-xs">
                <div class="text-zinc-400">Produksi</div>
                <div class="font-semibold text-zinc-200">{{ film.production }}</div>
              </div>
            </div>
          </div>

          <!-- Synopsis Section -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center">
              <svg class="w-4 h-4 text-amber-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Sinopsis Film
            </h3>
            <p class="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
              {{ film.synopsis }}
            </p>
          </div>

          <!-- Credits Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-800/80 text-xs">
            <div>
              <span class="text-zinc-500 block">Sutradara</span>
              <span class="text-zinc-200 font-medium">{{ film.director }}</span>
            </div>
            <div>
              <span class="text-zinc-500 block">Tahun Rilis</span>
              <span class="text-zinc-200 font-medium">{{ film.year }}</span>
            </div>
            <div>
              <span class="text-zinc-500 block">Durasi</span>
              <span class="text-zinc-200 font-medium">{{ film.duration }}</span>
            </div>
            <div>
              <span class="text-zinc-500 block">Format Audio</span>
              <span class="text-zinc-200 font-medium">Dolby Atmos Surround</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ==================================================================== -->
      <!-- KOLOM KANAN (Span 4): Form Donasi & Feed Donatur                     -->
      <!-- ==================================================================== -->
      <section class="lg:col-span-4 space-y-6">
        
        <!-- Donation Card -->
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 shadow-xl relative overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 class="text-base font-bold text-white tracking-wide">
                {{ isAlreadyUnlockedByUser ? 'Koleksi Tersimpan' : 'Apresiasi Pay-As-You-Wish' }}
              </h2>
            </div>
            <span class="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Instan QRIS
            </span>
          </div>

          <!-- Info banner if already unlocked -->
          <div v-if="isAlreadyUnlockedByUser" class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 mb-4">
            <div class="flex items-center space-x-2 font-bold">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Akses Penuh Telah Terbuka</span>
            </div>
            <p class="text-zinc-300 leading-relaxed">
              Anda telah mengapresiasi film ini. Anda dapat menonton ulang kapan saja tanpa perlu membayar lagi. Jika ingin berdonasi kembali untuk mendukung kru, silakan gunakan form di bawah.
            </p>
          </div>

          <p v-else class="text-xs text-zinc-400 mb-5 leading-relaxed">
            Pilih nominal apresiasi donasi Anda. Film otomatis terbuka dan tersimpan ke akun login Anda.
          </p>

          <form @submit.prevent="handleSubmitDonation" class="space-y-4">
            
            <!-- Presets -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Pilih Nominal Donasi
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="amt in instantAmounts"
                  :key="amt"
                  type="button"
                  @click="handleSelectPreset(amt)"
                  :class="[
                    'py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center',
                    selectedAmount === amt && !customAmount
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/40'
                  ]"
                >
                  {{ formatRupiah(amt) }}
                </button>
              </div>
            </div>

            <!-- Custom Amount -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Nominal Bebas (Rp)
              </label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-zinc-500 pointer-events-none">
                  Rp
                </span>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  placeholder="Contoh: 75000"
                  :value="customAmount"
                  @input="handleCustomInput"
                  class="w-full pl-11 pr-3 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            <!-- Donor Name Input -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Nama Donatur
              </label>
              <input
                v-model="donorName"
                type="text"
                :placeholder="user ? user.user_metadata?.full_name || user.email : 'Contoh: Dian Banua'"
                maxlength="50"
                class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            <!-- Message Input -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Pesan untuk Tim Produksi
              </label>
              <textarea
                v-model="donorMessage"
                rows="2"
                placeholder="Tulis pesan apresiasi untuk para sineas..."
                maxlength="200"
                class="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors resize-none"
              />
            </div>

            <!-- Error -->
            <div v-if="formError" class="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {{ formError }}
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="isSubmitting"
              class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm tracking-wide shadow-lg shadow-amber-500/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>{{ isAlreadyUnlockedByUser ? 'Donasi Tambahan' : 'Berdonasi & Buka Film' }} ({{ formatRupiah(finalAmount) }})</span>
            </button>

            <!-- Login Requirement Notice -->
            <p v-if="!isAuthenticated" class="text-[11px] text-center text-amber-400/90 font-medium">
              🔒 Diperlukan login akun agar film tersimpan permanen di koleksi Anda.
            </p>
          </form>
        </div>

        <!-- Realtime Feed Card -->
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Apresiasi Donatur Film Ini
              </h3>
            </div>
            <span class="text-[11px] font-mono text-zinc-500">
              {{ donationsList.length }} Pendukung
            </span>
          </div>

          <!-- Feed List -->
          <div class="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <div
              v-for="donation in donationsList"
              :key="donation.id"
              class="group p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-all duration-200"
            >
              <div class="flex items-start justify-between gap-2 mb-1.5">
                <div class="flex items-center space-x-2 min-w-0">
                  <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-black font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                    {{ donation.donor_name ? donation.donor_name.charAt(0).toUpperCase() : 'A' }}
                  </div>
                  <span class="text-xs font-semibold text-zinc-200 truncate">
                    {{ donation.donor_name || 'Hamba Allah (Anonim)' }}
                  </span>
                </div>
                <span class="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                  {{ formatRupiah(donation.amount) }}
                </span>
              </div>

              <p v-if="donation.message" class="text-xs text-zinc-400 italic bg-zinc-900/60 rounded-lg p-2 border border-zinc-800/50 mt-2">
                "{{ donation.message }}"
              </p>

              <div class="flex items-center justify-end text-[10px] text-zinc-600 mt-1.5">
                <span>{{ formatRelativeTime(donation.created_at) }}</span>
              </div>
            </div>

            <!-- Empty State jika belum ada donasi di database -->
            <div v-if="donationsList.length === 0" class="text-center py-6 text-zinc-500 text-xs">
              Belum ada donasi tercatat di database untuk film ini. Jadilah pendukung pertama!
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ==================================================================== -->
    <!-- MODAL PEMBAYARAN TIPTIP & QRIS REALTIME                              -->
    <!-- ==================================================================== -->
    <Teleport to="body">
      <div
        v-if="showQrisModal && currentOrder"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      >
        <div class="relative w-full max-w-md rounded-3xl bg-[#121216] border border-zinc-700/80 p-6 sm:p-7 shadow-2xl text-center space-y-4 my-6">
          <button
            type="button"
            @click="showQrisModal = false"
            class="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Modal Header: Method Switcher -->
          <div class="flex items-center justify-between border-b border-zinc-800 pb-3 px-1">
            <div class="flex items-center space-x-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                @click="modalPaymentMethod = 'tiptip'"
                :class="[
                  'px-3 py-1.5 rounded-lg font-black transition-all flex items-center space-x-1.5',
                  modalPaymentMethod === 'tiptip'
                    ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                ]"
              >
                <span>🚀 Halaman TipTip</span>
              </button>
              <button
                type="button"
                @click="modalPaymentMethod = 'qris'"
                :class="[
                  'px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1',
                  modalPaymentMethod === 'qris'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                ]"
              >
                <span>📱 Scan QRIS</span>
              </button>
            </div>
            <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-bold">
              Auto-Detect
            </span>
          </div>

          <!-- Film & Amount Info -->
          <div>
            <p class="text-[11px] text-zinc-400 uppercase tracking-widest">Apresiasi Film {{ film.title }}</p>
            <div class="text-3xl font-black text-amber-400 mt-0.5">
              {{ formatRupiah(currentOrder.amount) }}
            </div>
          </div>

          <!-- TAB 1: METODE UTAMA TIPTIP LANGSUNG -->
          <div v-if="modalPaymentMethod === 'tiptip'" class="space-y-3.5">
            <!-- TOMBOL UTAMA BUKA TIPTIP -->
            <button
              type="button"
              @click="openTipTipAndCopyCode"
              class="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-amber-600 hover:from-red-500 hover:via-amber-400 hover:to-amber-500 text-white font-black text-sm tracking-wide shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2.5 group"
            >
              <span>🚀 Buka & Bayar di TipTip Sekarang</span>
              <svg class="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            <!-- KODE UNIK REF TIPTIP BOX -->
            <div class="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-amber-500/10 border-2 border-amber-500/50 text-center space-y-1.5 shadow-lg shadow-amber-500/5">
              <span class="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                Kode Unik Transaksi TipTip Anda:
              </span>
              <div class="text-2xl font-black font-mono tracking-widest text-white flex items-center justify-center space-x-2">
                <span class="bg-black/60 px-3.5 py-1 rounded-xl border border-amber-500/40 text-amber-300">
                  {{ currentOrder.ref_code }}
                </span>
                <button
                  type="button"
                  @click="copyRefCode"
                  class="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-extrabold hover:bg-amber-400 transition-colors shadow-sm"
                >
                  {{ copyRefSuccess ? 'Tersalin!' : 'Salin' }}
                </button>
              </div>
            </div>

            <!-- Panduan Ringkas -->
            <div class="text-left text-xs bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl space-y-2 text-zinc-300">
              <div class="flex items-center space-x-1.5 font-bold text-amber-400 text-xs">
                <span>💡</span>
                <span>Cara Membayar via TipTip:</span>
              </div>
              <ol class="list-decimal list-inside space-y-1.5 text-[11px] text-zinc-300 leading-relaxed">
                <li>Klik tombol <strong class="text-white">"Buka & Bayar di TipTip"</strong> di atas.</li>
                <li>Kode unik <strong class="text-amber-300 font-mono">{{ currentOrder.ref_code }}</strong> otomatis tersalin.</li>
                <li>Pada halaman TipTip, <strong>Tempelkan (Paste)</strong> kode ke kolom <em class="text-amber-200">Pesan</em>.</li>
                <li>Selesaikan pembayaran. Sistem otomatis mendeteksi webhook dan <strong class="text-emerald-400">membuka film seketika!</strong></li>
              </ol>

              <button
                type="button"
                @click="copyTipTipMessage"
                class="w-full mt-1 py-1.5 px-3 rounded-lg bg-zinc-950 border border-zinc-700 hover:border-amber-500 text-zinc-200 hover:text-white text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              >
                <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>{{ copyMsgSuccess ? 'Pesan + Kode Tersalin!' : 'Salin Pesan TipTip Lengkap' }}</span>
              </button>
            </div>
          </div>

          <!-- TAB 2: METODE SCAN QRIS -->
          <div v-else class="space-y-3">
            <div class="p-3 bg-white rounded-2xl inline-block shadow-inner mx-auto border border-zinc-200">
              <img
                :src="qrisQrUrl"
                alt="QRIS Donasi Sineas HSS"
                class="w-44 h-44 object-contain mx-auto"
              />
              <p class="text-[9px] font-mono text-zinc-700 mt-1 font-semibold">QRIS / GPN (BCA, GoPay, OVO, Dana, ShopeePay)</p>
            </div>
            <p class="text-[11px] text-zinc-400">
              Scan QRIS di atas menggunakan aplikasi mobile banking atau e-wallet Anda.
            </p>
          </div>

          <!-- Realtime Waiting Pulse Banner -->
          <div class="flex items-center justify-center space-x-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span class="font-medium text-[11px]">Mendengarkan Webhook TipTip secara realtime...</span>
          </div>

          <!-- Tombol Helper Simulasi Webhook TipTip -->
          <div class="pt-2 border-t border-zinc-800/80 space-y-1.5">
            <button
              type="button"
              @click="simulateInstantPayment"
              :disabled="isSimulatingPayment"
              class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs tracking-wide transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <svg v-if="isSimulatingPayment" class="animate-spin h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>⚡ Simulasi Webhook TipTip (Event: NEW_TIP)</span>
            </button>
            <p class="text-[10px] text-zinc-500">
              Mengirim payload TipTip resmi dengan kode <strong class="text-amber-400 font-mono">{{ currentOrder.ref_code }}</strong> untuk membuka film seketika.
            </p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast Notification -->
    <Teleport to="body">
      <div
        v-if="showToast"
        class="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-zinc-900 border border-amber-500/50 shadow-2xl shadow-amber-500/20 text-white text-xs flex items-center space-x-3"
      >
        <div class="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm shrink-0">
          ✓
        </div>
        <div class="flex-1 leading-snug">
          {{ toastMessage }}
        </div>
        <button @click="showToast = false" class="text-zinc-400 hover:text-white">✕</button>
      </div>
    </Teleport>
  </div>

  <!-- Loading State -->
  <div v-else-if="isLoadingFilm" class="text-center py-24 space-y-3">
    <div class="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
    <p class="text-xs text-zinc-400">Memuat detail film dari database Supabase...</p>
  </div>

  <!-- Not Found State -->
  <div v-else class="text-center py-20 bg-zinc-950/60 rounded-3xl border border-zinc-800 space-y-4 max-w-md mx-auto">
    <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-600 flex items-center justify-center mx-auto text-2xl">
      🎬
    </div>
    <h3 class="text-lg font-black text-white">Film Tidak Ditemukan</h3>
    <p class="text-xs text-zinc-400 leading-relaxed px-6">
      Film dengan slug <span class="font-mono text-amber-400 font-bold">{{ slug }}</span> belum terdaftar di tabel database <span class="font-mono text-zinc-300">public.films</span>.
    </p>
    <div class="pt-2 flex items-center justify-center gap-3">
      <NuxtLink
        to="/"
        class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
      >
        Lihat Katalog
      </NuxtLink>
      <NuxtLink
        to="/admin"
        class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold transition-colors"
      >
        + Tambah di Admin
      </NuxtLink>
    </div>
  </div>
</template>

