export interface Film {
  id: string
  slug: string
  title: string
  year: string
  duration: string
  genre: string
  synopsis: string
  director: string
  production: string
  youtube_video_id: string
  poster_url?: string
  banner_url?: string
  min_donation: number
  is_active: boolean
  featured?: boolean
  created_at?: string
}

export interface DonationRecord {
  id: string
  ref_code?: string | null
  user_id?: string | null
  film_id: string
  donor_name: string
  amount: number
  message: string | null
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | string
  created_at: string
  // Virtual / joined fields
  films?: Film | null
  profiles?: {
    email?: string
    full_name?: string
  } | null
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: 'user' | 'admin'
  created_at?: string
  updated_at?: string
}
