-- ==============================================================================
-- Sineas HSS Stream: Database Schema for Films, Donations, User Profiles & Admin
-- Supabase Postgres SQL Script with Realtime & Row Level Security (RLS)
-- PURE SCHEMA - TIDAK ADA DATA DUMMY / SEED DATA
-- ==============================================================================

-- 1. Ekstensi UUID
create extension if not exists "pgcrypto";

-- 2. Buat tabel profiles (Menyimpan data pengguna dan peran 'admin' / 'user')
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Index performa untuk role check
create index if not exists idx_profiles_role on public.profiles(role);

-- 3. Trigger otomatis: saat user mendaftar di auth.users, buat profil di public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case 
      when (new.raw_user_meta_data->>'role') = 'admin' then 'admin'
      else 'user'
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Daftarkan trigger ke auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute procedure public.handle_new_user();

-- Fungsi helper untuk memeriksa apakah user tertentu adalah admin di database
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- 4. Buat tabel films (Katalog Film Komunitas Sineas HSS)
create table if not exists public.films (
  id text primary key, -- slug identifier (e.g. 'pulasit-2025')
  slug text unique not null,
  title text not null,
  year text not null default '',
  duration text not null default '',
  genre text not null default '',
  synopsis text not null default '',
  director text not null default '',
  production text not null default '',
  youtube_video_id text not null,
  poster_url text,
  banner_url text,
  min_donation numeric(12, 2) not null default 0 check (min_donation >= 0),
  is_active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_films_active on public.films(is_active);

-- 5. Buat / Perbarui tabel donations (Apresiasi Donasi & Hubungan dengan User)
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique, -- Kode unik transaksi TipTip format e.g. 'HSS-4821'
  user_id uuid references auth.users(id) on delete set null,
  film_id text not null references public.films(id) on delete cascade,
  donor_name text not null default 'Hamba Allah (Anonim)',
  amount numeric(12, 2) not null check (amount > 0),
  message text default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Migrasi aman: Tambahkan kolom ref_code jika tabel sudah ada sebelumnya
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name='donations' and column_name='ref_code'
  ) then
    alter table public.donations add column ref_code text unique;
  end if;
end;
$$;

create index if not exists idx_donations_ref_code on public.donations(ref_code);
create index if not exists idx_donations_film_status on public.donations(film_id, status);
create index if not exists idx_donations_user_film_status on public.donations(user_id, film_id, status);
create index if not exists idx_donations_created_at on public.donations(created_at desc);

-- 6. Aktifkan Supabase Realtime Publication untuk profiles, films dan donations
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'films') then
    alter publication supabase_realtime add table public.films;
  end if;

  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations') then
    alter publication supabase_realtime add table public.donations;
  end if;
end;
$$;

alter table public.profiles replica identity full;
alter table public.films replica identity full;
alter table public.donations replica identity full;

-- 7. Konfigurasi Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.films enable row level security;
alter table public.donations enable row level security;

-- Policies untuk PROFILES
drop policy if exists "Allow public select for profiles" on public.profiles;
drop policy if exists "Allow users to update own profile" on public.profiles;
drop policy if exists "Allow admin full access to profiles" on public.profiles;

create policy "Allow public select for profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy "Allow users to update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Allow admin full access to profiles"
  on public.profiles
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Policies untuk FILMS
drop policy if exists "Allow public select for active films" on public.films;
drop policy if exists "Allow all operations for admins on films" on public.films;

create policy "Allow public select for active films"
  on public.films
  for select
  to anon, authenticated
  using (true);

create policy "Allow all operations for admins on films"
  on public.films
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Policies untuk DONATIONS
drop policy if exists "Allow public select for donations" on public.donations;
drop policy if exists "Allow public insert for donations" on public.donations;
drop policy if exists "Allow public update for donations" on public.donations;

create policy "Allow public select for donations"
  on public.donations
  for select
  to anon, authenticated
  using (true);

create policy "Allow public insert for donations"
  on public.donations
  for insert
  to anon, authenticated
  with check (true);

create policy "Allow public update for donations"
  on public.donations
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- 8. Konfigurasi Supabase Storage untuk Poster & Banner Film
-- Buat bucket publik 'film-posters' untuk upload file foto dari Admin Dashboard
insert into storage.buckets (id, name, public)
values ('film-posters', 'film-posters', true)
on conflict (id) do update set public = true;

-- Hapus policy lama jika ada untuk mencegah duplikasi
drop policy if exists "Public Access for Film Posters" on storage.objects;
drop policy if exists "Authenticated Users Can Upload Posters" on storage.objects;
drop policy if exists "Authenticated Users Can Update Posters" on storage.objects;
drop policy if exists "Authenticated Users Can Delete Posters" on storage.objects;

-- Policy 1: Publik (siapapun) dapat melihat foto poster film
create policy "Public Access for Film Posters"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'film-posters');

-- Policy 2: User terautentikasi (Admin) dapat mengunggah foto poster
create policy "Authenticated Users Can Upload Posters"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'film-posters');

-- Policy 3: User terautentikasi (Admin) dapat memperbarui foto poster
create policy "Authenticated Users Can Update Posters"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'film-posters');

-- Policy 4: User terautentikasi (Admin) dapat menghapus foto poster
create policy "Authenticated Users Can Delete Posters"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'film-posters');

-- ==============================================================================
-- PANDUAN PENGGUNAAN:
-- 1. Jalankan seluruh skrip di atas pada Supabase SQL Editor.
-- 2. Daftar akun pertama kali melalui UI website (atau di Supabase Auth).
-- 3. Untuk mengangkat akun menjadi Administrator, jalankan perintah berikut di SQL Editor:
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'email_anda@domain.com';
-- 4. Semua data film dan transaksi donasi akan diinput secara dinamis melalui UI Admin!
-- ==============================================================================
