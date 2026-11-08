# Sineas HSS Stream (Multi-Film, Database Auth & Real Admin)

Platform web streaming film komunitas Sineas Hulu Sungai Selatan (HSS) berbasis donasi sukarela (**Pay-as-you-wish**) dengan deteksi pembayaran otomatis (**Realtime Auto-Unlock**), akun pengguna terverifikasi di database untuk menyimpan film yang didonasikan, serta **Dashboard Admin Berbasis Akun & Peran Database (Tanpa Data Dummy)**.

---

## 🔐 Sistem Autentikasi Admin Berbasis Database (Non-Dummy)

1. **Autentikasi Akun Riil**:
   - Tidak lagi menggunakan PIN atau passcode statis.
   - Admin masuk menggunakan **Email & Kata Sandi** yang terdaftar di Supabase Auth.
2. **Verifikasi Peran (`role = 'admin'`) di Database**:
   - Saat login di `/admin`, sistem mencocokkan kredensial ke Supabase Auth, kemudian langsung membaca tabel **`public.profiles`** di database.
   - Jika kolom `role` pada baris pengguna tersebut bukan `'admin'`, akses ditolak dengan pesan:
     *`Akses Ditolak: Akun "..." terdaftar sebagai "user" di database. Ubah kolom role menjadi 'admin' pada tabel profiles di database Supabase.`*
   - Jika `role === 'admin'`, sesi admin diberikan dan dashboard dimuat.
3. **Data Riil dari Database**:
   - Seluruh metrik keuangan (Total Dana Terkumpul, Total Donasi PAID, Total PENDING) dihitung langsung dari data riil tabel `donations`.
   - Seluruh daftar film di-fetch langsung dari tabel `public.films`.
   - Operasi Tambah, Edit, Hapus, dan Toggle Aktif/Nonaktif film langsung mengeksekusi operasi `INSERT`, `UPDATE`, dan `DELETE` ke database Supabase.
   - Verifikasi status donasi manual (tombol **"Set PAID"**) langsung memperbarui kolom `status` pada tabel `donations` di database.

---

## 🗄️ Cara Menetapkan Akun Menjadi Admin di Database Supabase

1. Jalankan isi script [`schema.sql`](./schema.sql) di **Supabase SQL Editor**.
2. Buat akun admin melalui menu **Daftar** di web (`/auth` atau modal navigasi), atau tambahkan user di menu **Authentication -> Users** pada Supabase Dashboard.
3. Tetapkan peran `'admin'` untuk email tersebut dengan menjalankan perintah SQL berikut:
   ```sql
   UPDATE public.profiles 
   SET role = 'admin' 
   WHERE email = 'email_admin_anda@domain.com';
   ```
4. Buka halaman `/admin` di browser dan masuk dengan email serta kata sandi tersebut.

---

## 📁 Struktur Halaman & Routing

```
pages/
├── index.vue           # / -> Katalog dan List Film Riil dari Database
├── stream/
│   └── [slug].vue      # /stream/:slug -> Pemutaran & Donasi Realtime + Cek Hak Akses Akun
├── my-films.vue        # /my-films -> Koleksi Film yang Didonasikan Pengguna (Tersimpan di Database)
├── auth.vue            # /auth -> Halaman Login & Registrasi Akun Supabase
└── admin/
    └── index.vue       # /admin -> Dashboard Admin Berbasis Akun & Role Database
```
# sineasAPP
# sineashssapp
