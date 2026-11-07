import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const supabaseUrl =
    (config.public?.supabaseUrl as string) ||
    process.env.NUXT_PUBLIC_SUPABASE_URL ||
    ''
  const supabaseKey =
    (config.public?.supabaseKey as string) ||
    process.env.NUXT_PUBLIC_SUPABASE_KEY ||
    ''

  if (!supabaseUrl || !supabaseKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Kredensial Supabase belum terkonfigurasi di server runtime config.'
    })
  }

  // 1. Parse JSON Payload Terlebih Dahulu
  const body = await readBody(event).catch(() => null)

  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payload request tidak valid. Format harus berupa JSON.'
    })
  }

  // 2. Verifikasi Token TipTip (Dilewati jika simulasi internal pengujian aplikasi)
  const isSimulation = body.is_simulation === true || body.simulation === true
  const expectedToken = (config.tiptipVerificationToken as string) || process.env.TIPTIP_VERIFICATION_TOKEN
  if (expectedToken && !isSimulation) {
    const incomingToken =
      getHeader(event, 'x-tiptip-token') ||
      getHeader(event, 'x-webhook-token') ||
      getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')

    if (!incomingToken || incomingToken !== expectedToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Header token verifikasi TipTip tidak valid.'
      })
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // ============================================================================
  // KASUS A: Webhook TipTip (Event: "NEW_TIP", payload: { event, data: { name, amount, message } })
  // ============================================================================
  if (body.event === 'NEW_TIP' || body.data) {
    const tipData = body.data || body
    const donorName = (tipData.name || tipData.donor_name || 'Donatur TipTip').toString().trim()
    const amount = Number(tipData.amount || 0)
    const message = (tipData.message || '').toString().trim()

    // Ekstrak kode unik format /HSS-[A-Z0-9]{4}/ dari pesan donatur atau langsung dari parameter
    const refCodeRegex = /HSS-[A-Z0-9]{4}/i
    const match = message.match(refCodeRegex)
    const extractedRefCode = match ? match[0].toUpperCase() : (body.ref_code ? body.ref_code.toString().toUpperCase() : null)

    console.log(`[TipTip Webhook] Event: NEW_TIP, Donor: "${donorName}", Amount: ${amount}, Ref: "${extractedRefCode}"`)

    // Langkah 1: Jika ref_code ditemukan, update donasi yang memiliki ref_code tersebut menjadi 'PAID'
    if (extractedRefCode) {
      const { data: updatedDonations, error: updateError } = await supabase
        .from('donations')
        .update({
          status: 'PAID',
          donor_name: donorName !== 'Donatur TipTip' ? donorName : undefined,
          message: message || undefined
        })
        .eq('ref_code', extractedRefCode)
        .select()

      if (!updateError && updatedDonations && updatedDonations.length > 0) {
        return {
          success: true,
          method: 'matched_by_ref_code',
          ref_code: extractedRefCode,
          data: updatedDonations[0]
        }
      }
    }

    // Langkah 1b: Cek jika order_id dikirim secara langsung
    const directOrderId = body.order_id || body.id || (tipData && (tipData.order_id || tipData.id))
    if (directOrderId) {
      const { data: updatedById, error: updateIdErr } = await supabase
        .from('donations')
        .update({ status: 'PAID' })
        .eq('id', directOrderId)
        .select()

      if (!updateIdErr && updatedById && updatedById.length > 0) {
        return {
          success: true,
          method: 'matched_by_direct_order_id',
          data: updatedById[0]
        }
      }
    }

    // Langkah 2: Fallback matching jika ref_code tidak ada atau tidak cocok
    // Cari donasi PENDING dengan kecocokan donor_name & amount
    let fallbackQuery = supabase
      .from('donations')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)

    if (amount > 0) {
      fallbackQuery = fallbackQuery.eq('amount', amount)
    }

    const { data: pendingList } = await fallbackQuery

    if (pendingList && pendingList.length > 0) {
      const matchedRecord = pendingList[0]
      const { data: updatedPending, error: updatePendingErr } = await supabase
        .from('donations')
        .update({
          status: 'PAID',
          donor_name: donorName,
          message: message || matchedRecord.message
        })
        .eq('id', matchedRecord.id)
        .select()

      if (!updatePendingErr && updatedPending && updatedPending.length > 0) {
        return {
          success: true,
          method: 'matched_by_name_and_amount_fallback',
          id: matchedRecord.id,
          data: updatedPending[0]
        }
      }
    }

    // Langkah 3: Jika tidak ditemukan record pending sama sekali,
    // Ambil film aktif pertama dari database jika film_id tidak disertakan secara eksplisit
    let targetFilmId = (body.film_id || tipData.film_id || '').toString().trim()
    if (!targetFilmId) {
      const { data: activeFilms } = await supabase
        .from('films')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (activeFilms && activeFilms.length > 0) {
        targetFilmId = activeFilms[0].id
      }
    }

    if (!targetFilmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Tidak ditemukan data film aktif di database untuk mengaitkan transaksi donasi baru.'
      })
    }

    // Insert record baru langsung dengan status 'PAID' agar donasi langsung tampil di feed & riwayat
    const generatedRefCode = extractedRefCode || `HSS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const { data: newRecord, error: insertError } = await supabase
      .from('donations')
      .insert({
        donor_name: donorName,
        amount: amount > 0 ? amount : 10000,
        message: message || 'Dukungan via TipTip',
        film_id: targetFilmId,
        status: 'PAID',
        ref_code: generatedRefCode
      })
      .select()
      .single()

    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: `Gagal mencatat donasi TipTip baru ke database: ${insertError.message}`
      })
    }

    return {
      success: true,
      method: 'inserted_new_paid_record',
      data: newRecord
    }
  }

  // ============================================================================
  // KASUS B: Format Standard Gateway / Testing Simulator ({ order_id / id, status })
  // ============================================================================
  const orderId = body.order_id || body.id || body.orderId
  const refCodeParam = body.ref_code || body.refCode
  const rawStatus = (body.status || body.transaction_status || 'PAID').toString().toUpperCase()
  const isPaid = ['PAID', 'SETTLEMENT', 'SUCCESS', 'CAPTURE'].includes(rawStatus)
  const targetStatus = isPaid ? 'PAID' : rawStatus

  if (refCodeParam) {
    const { data: byRef, error: refErr } = await supabase
      .from('donations')
      .update({ status: targetStatus })
      .eq('ref_code', refCodeParam.toUpperCase())
      .select()

    if (!refErr && byRef && byRef.length > 0) {
      return {
        success: true,
        method: 'direct_ref_code_update',
        ref_code: refCodeParam,
        data: byRef[0]
      }
    }
  }

  if (orderId) {
    const { data, error } = await supabase
      .from('donations')
      .update({ status: targetStatus })
      .eq('id', orderId)
      .select()

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Gagal memperbarui database donasi: ${error.message}`
      })
    }

    if (!data || data.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Donasi dengan order_id ${orderId} tidak ditemukan.`
      })
    }

    return {
      success: true,
      order_id: orderId,
      status: targetStatus,
      data: data[0]
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Format webhook tidak dikenali. Wajib menyertakan event "NEW_TIP" atau parameter order_id/ref_code.'
  })
})
