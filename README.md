# Gemini KeyHub

Portable Windows app untuk mengelola beberapa akun Google Cloud, project, dan Gemini API keys dari satu tempat.

## Fitur

- Login banyak akun Google dengan OAuth 2.0 resmi.
- OAuth memakai **system browser + loopback 127.0.0.1**, sesuai pola aplikasi desktop Google.
- Import file OAuth JSON agar tidak perlu copy-paste Client ID/Secret.
- Refresh token disimpan terenkripsi memakai Electron `safeStorage`.
- Menampilkan semua project Google Cloud aktif yang dapat diakses akun.
- Membuat project Google Cloud baru langsung dari aplikasi.
- Mengaktifkan API Keys API + Gemini API.
- Membuat 1–20 Gemini API key per batch.
- Jika batch berhenti di tengah, key yang sudah berhasil tetap ditampilkan.
- Key baru otomatis dibatasi ke `generativelanguage.googleapis.com`.
- Test key lewat endpoint daftar model Gemini (tanpa generate content).
- Reveal, Copy, Copy All, Export TXT, dan Export .env.
- Build Windows berupa **single portable EXE**, tanpa installer.

## Memperbaiki error 401 invalid_client

Jika halaman Google menampilkan:

```
Error 401: invalid_client
The OAuth client was not found
```

berarti OAuth Client ID yang digunakan tidak valid, sudah dihapus, atau bukan konfigurasi yang benar.

Cara yang disarankan:

1. Buka **OAuth Settings** di Gemini KeyHub.
2. Klik **Buka Google**.
3. Di Google Cloud Console buat OAuth Client ID dengan Application type **Desktop app**.
4. Download file JSON client tersebut.
5. Kembali ke Gemini KeyHub lalu klik **Import OAuth JSON**.
6. Klik **Tambah Akun Google**.

> Jangan membuat login Google di WebView/Electron embedded browser. Google OAuth dapat menolak embedded user-agent. Gemini KeyHub membuka browser default Windows untuk proses login lalu menerima callback kembali di localhost.

## Keamanan

Jangan pernah commit API key, OAuth client secret, refresh token, atau file OAuth JSON ke repository.

Walaupun executable bersifat portable, token OAuth tetap disimpan terenkripsi per perangkat Windows. Ini mencegah file token polos ikut berpindah bersama EXE.

## Developer

```bash
npm install
npm run typecheck
npm run dev
```

## Build portable Windows

```bash
npm install
npm run typecheck
npm run dist
```

Output:

```
release/Gemini-KeyHub-0.2.0-Portable.exe
```

## Batasan

Semua operasi tetap mengikuti IAM, quota, billing, dan kebijakan Google Cloud pada akun/project terkait. Banyak API key dalam project yang sama tidak menggandakan quota project.
