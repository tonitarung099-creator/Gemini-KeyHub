# Gemini KeyHub

Portable Windows app untuk mengelola beberapa akun Google Cloud, project, dan Gemini authorization API keys dari satu tempat.

## Fitur

- Login banyak akun Google dengan OAuth 2.0 resmi.
- **Setup OAuth otomatis** memakai helper berbasis `AnswerDotAI/gclientid`.
- Membuka Chrome khusus dengan profile terpisah untuk provisioning Google Cloud/OAuth.
- Membuat project OAuth personal yang stabil untuk akun Google yang sedang login.
- Membuat OAuth Client bertipe **Desktop app** lalu mengimpor Client ID/Secret ke Gemini KeyHub secara otomatis.
- Fallback manual melalui Import OAuth JSON.
- Refresh token disimpan terenkripsi memakai Electron `safeStorage`.
- Menampilkan project Google Cloud aktif yang dapat diakses akun.
- Membuat project Google Cloud baru langsung dari aplikasi.
- Mengaktifkan API Keys API, Gemini API, dan IAM API.
- Membuat 1–20 Gemini **authorization keys** per batch.
- Authorization key baru dibind ke service account khusus `gemini-keyhub@<project>.iam.gserviceaccount.com`.
- Jika batch berhenti di tengah, key yang sudah berhasil tetap ditampilkan.
- Key baru dibatasi ke `generativelanguage.googleapis.com`.
- Key lama tanpa service-account binding ditandai **LEGACY**.
- Test key lewat endpoint daftar model Gemini.
- Reveal, Copy, Copy All, Export TXT, dan Export .env.
- Build Windows berupa **single portable EXE**, tanpa installer.
- CI menjalankan production dependency audit, TypeScript check, helper smoke test, dan portable build.

## Setup OAuth yang direkomendasikan

1. Buka **OAuth Settings**.
2. Klik **Setup OAuth Otomatis**.
3. Gemini KeyHub membuka Chrome khusus dengan profile tersendiri.
4. Login ke akun Google yang akan menjadi pemilik project jika diminta.
5. Biarkan Chrome tetap terbuka sementara helper menyiapkan:
   - Google Cloud project,
   - OAuth app,
   - scope Google Cloud,
   - OAuth Desktop Client,
   - otorisasi akun,
   - API Cloud yang dibutuhkan.
6. Client ID/Secret dan login akun diimpor kembali ke Gemini KeyHub secara otomatis.
7. Setelah selesai, akun langsung muncul di account manager. Untuk menambahkan akun Google lain, gunakan **Tambah Akun Google**.

Chrome khusus provisioning bukan WebView Electron. Login Google tetap terjadi di browser Chrome asli.

## Jika masih muncul 401 invalid_client

Versi lama aplikasi dapat meninggalkan Client ID yang sudah tidak valid di vault Windows.

Di **OAuth Settings**:

1. Klik **Reset OAuth lama**.
2. Klik **Setup OAuth Otomatis**.
3. Selesaikan login dan consent di Chrome khusus.
4. Setelah setup selesai, akun langsung masuk ke Gemini KeyHub.

Fallback manual tetap tersedia melalui **Import OAuth JSON**.

## gclientid

Gemini KeyHub membundel helper yang menggunakan public provisioning functions dari:

`AnswerDotAI/gclientid`

Source:
https://github.com/AnswerDotAI/gclientid

License: Apache-2.0.

Attribution dan salinan lisensi ada di:

- `THIRD_PARTY_NOTICES.md`
- `third_party/gclientid/LICENSE`

Versi upstream yang dipakai oleh build dipin ke commit tertentu di GitHub Actions agar build reproducible.

## Keamanan

Jangan pernah commit API key, OAuth client secret, refresh token, atau file OAuth JSON ke repository.

Walaupun executable bersifat portable, token OAuth tetap disimpan terenkripsi per perangkat Windows menggunakan Electron `safeStorage`. File portable dapat dipindah, tetapi sesi login tidak disimpan sebagai token plaintext di samping EXE.

## Developer

Untuk UI/TypeScript:

```bash
npm install
npm run typecheck
npm run dev
```

Helper Python memerlukan `gclientid` dan dibundle oleh GitHub Actions memakai PyInstaller.

## Build portable Windows

Workflow GitHub Actions membangun helper terlebih dahulu, menjalankan self-test, lalu membundelnya ke Electron portable EXE.

Output:

```
release/Gemini-KeyHub-0.4.0-Portable.exe
```

## Batasan

Semua operasi mengikuti IAM, quota, billing, security policy, dan kebijakan Google Cloud pada akun/project terkait. Banyak API key dalam project yang sama tidak menggandakan quota project. Akun yang tidak memiliki izin membuat service account atau binding authorization key akan menerima error IAM dari Google.
