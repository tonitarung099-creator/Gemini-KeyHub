# Gemini KeyHub

Desktop manager untuk mengelola beberapa akun Google Cloud, project, dan Gemini API keys dari satu aplikasi Windows.

## Target MVP

- Login banyak akun Google dengan OAuth 2.0 resmi.
- Token refresh disimpan terenkripsi memakai Electron `safeStorage`.
- Menampilkan project Google Cloud yang dapat diakses tiap akun.
- Mengaktifkan API Keys API + Gemini API pada project yang dipilih.
- Membuat hingga 20 Gemini API key dalam sekali aksi.
- Key baru otomatis diberi API restriction ke `generativelanguage.googleapis.com`.
- List key, reveal/copy key, Copy All, dan export TXT/.env (export menyusul setelah MVP login stabil).
- Tidak melakukan rotasi akun otomatis untuk menghindari quota/rate limit.

## Keamanan

Jangan pernah commit API key, OAuth client secret, refresh token, atau file kredensial ke repository.
Aplikasi menyimpan kredensial secara lokal dan terenkripsi pada perangkat pengguna.

## Setup developer

1. Install Node.js LTS.
2. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
3. Pada Google Cloud Console buat OAuth Client bertipe **Desktop app**.
4. Buka Settings di Gemini KeyHub lalu masukkan Client ID dan Client Secret dari OAuth client tersebut.

OAuth memakai loopback redirect lokal + PKCE. Scope utama yang digunakan adalah `cloud-platform`, ditambah OpenID profile/email untuk mengidentifikasi akun.

## Build Windows

```bash
npm install
npm run typecheck
npm run dist
```

Installer akan dibuat di folder `release/`.

## Catatan Google Cloud

Pembuatan key dilakukan lewat API Keys API resmi. Operasi create key bersifat asynchronous (long-running operation).
Jumlah dan izin tetap mengikuti kebijakan, quota, dan IAM Google Cloud pada account/project terkait.
