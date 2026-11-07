import { ref } from 'vue'
import { useSupabase } from '~/utils/supabase'
import type { Film } from '~/types'

export const useFilms = () => {
  const supabase = useSupabase()
  const films = useState<Film[]>('app_films', () => [])
  const isLoadingFilms = useState<boolean>('loading_films', () => false)

  // Ambil semua film dari database Supabase (tabel public.films)
  const fetchFilms = async (includeInactive = false): Promise<Film[]> => {
    isLoadingFilms.value = true
    try {
      let query = supabase.from('films').select('*').order('created_at', { ascending: false })

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('[useFilms] Error fetching films from database:', error.message)
        return []
      }

      films.value = (data as Film[]) || []
      return films.value
    } catch (err) {
      console.error('[useFilms] Database exception:', err)
      return []
    } finally {
      isLoadingFilms.value = false
    }
  }

  // Ambil detail satu film berdasarkan slug / id dari database
  const fetchFilmBySlug = async (slug: string): Promise<Film | null> => {
    try {
      const { data, error } = await supabase
        .from('films')
        .select('*')
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle()

      if (error) {
        console.error('[useFilms] Error fetching film detail from database:', error.message)
        return null
      }

      return data as Film
    } catch (err) {
      console.error('[useFilms] Exception fetching film by slug:', err)
      return null
    }
  }

  // Tambah Film Baru ke Database (Admin)
  const createFilm = async (filmData: Partial<Film>) => {
    const slug = filmData.slug || filmData.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'film-' + Date.now()
    const newFilm: Film = {
      id: slug,
      slug,
      title: filmData.title || '',
      year: filmData.year || '2025',
      duration: filmData.duration || '25 Menit',
      genre: filmData.genre || 'Drama / Banua',
      synopsis: filmData.synopsis || '',
      director: filmData.director || '',
      production: filmData.production || 'Komunitas Film Sineas HSS',
      youtube_video_id: filmData.youtube_video_id || '',
      poster_url: filmData.poster_url || '',
      banner_url: filmData.banner_url || '',
      min_donation: Number(filmData.min_donation) || 10000,
      is_active: filmData.is_active ?? true,
      featured: filmData.featured ?? false,
      created_at: new Date().toISOString()
    }

    const { data, error } = await supabase.from('films').insert(newFilm).select().single()
    if (error) {
      console.error('[useFilms] Error creating film in database:', error.message)
      throw error
    }

    films.value.unshift(data as Film)
    return { data, error: null }
  }

  // Update Film di Database (Admin)
  const updateFilm = async (id: string, updates: Partial<Film>) => {
    const { data, error } = await supabase
      .from('films')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[useFilms] Error updating film in database:', error.message)
      throw error
    }

    const idx = films.value.findIndex((f) => f.id === id)
    if (idx !== -1) {
      films.value[idx] = { ...films.value[idx], ...updates }
    }
    return { data, error: null }
  }

  // Hapus Film dari Database (Admin)
  const deleteFilm = async (id: string) => {
    const { error } = await supabase.from('films').delete().eq('id', id)
    if (error) {
      console.error('[useFilms] Error deleting film from database:', error.message)
      throw error
    }

    films.value = films.value.filter((f) => f.id !== id)
    return { success: true }
  }

  // Upload file foto poster langsung ke Supabase Storage (bucket: 'film-posters')
  const uploadPosterFile = async (file: File): Promise<string> => {
    // Buat nama file unik dengan timestamp & random string
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
    const filePath = `posters/${Date.now()}_${cleanFileName}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('film-posters')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      console.error('[useFilms] Error upload poster ke Supabase Storage:', error.message)
      throw error
    }

    // Dapatkan URL publik dari file yang baru di-upload
    const { data: publicUrlData } = supabase.storage
      .from('film-posters')
      .getPublicUrl(filePath)

    return publicUrlData.publicUrl
  }

  return {
    films,
    isLoadingFilms,
    fetchFilms,
    fetchFilmBySlug,
    createFilm,
    updateFilm,
    deleteFilm,
    uploadPosterFile
  }
}

export default useFilms
