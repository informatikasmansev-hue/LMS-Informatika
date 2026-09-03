# LMS INFORMATIKA SMANSEV — GitHub Ready V1

Paket ini memisahkan frontend LMS dan backend Google Apps Script tanpa mengubah
alur fitur utama. Frontend dapat di-host di GitHub Pages, sedangkan Google Sheets
tetap diakses melalui Google Apps Script.

## Struktur

```text
LMS_SMANSEV_GitHub_Ready_V1/
├── frontend/
│   ├── index.html
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── config.js
│           ├── api.js
│           └── app.js
├── backend/
│   ├── Code.gs
│   ├── Api.gs
│   ├── Index.html        # versi lama untuk rollback/transisi
│   └── appsscript.json
├── .github/workflows/pages.yml
├── .gitignore
└── MIGRATION_REPORT.md
```

## Arsitektur

```text
GitHub Pages (frontend)
        |
        | POST JSON via fetch()
        v
Google Apps Script Web App /exec
        |
        | signed session token + role validation
        v
Code.gs
        |
        v
Google Sheets
```

## A. Deploy backend Google Apps Script

1. Buka project Apps Script LMS yang sekarang.
2. Pertahankan `Code.gs` dan `Index.html`.
3. Tambahkan file script baru bernama `Api.gs`.
4. Salin isi `backend/Api.gs`.
5. Pastikan kode tersimpan.
6. Deploy > Manage deployments.
7. Buat deployment Web app baru / edit deployment.
8. Jalankan sebagai pemilik script.
9. Atur akses agar frontend GitHub Pages dapat memanggil Web App sesuai kebijakan
   akun Google Workspace Anda.
10. Salin URL deployment yang berakhiran `/exec`.

`Api.gs` otomatis membuat `LMS_API_SECRET` di Script Properties ketika session
pertama dibuat. Secret tidak perlu ditaruh di GitHub.

> Penting: gunakan URL `/exec`, bukan URL development `/dev`.

## B. Hubungkan frontend ke backend

Edit:

`frontend/assets/js/config.js`

Ganti:

```js
API_URL: 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_EXEC_URL_HERE'
```

menjadi URL Web App Anda, misalnya:

```js
API_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'
```

URL deployment bukan password/secret. Jangan menaruh password, token privat,
atau secret lain di file frontend.

## C. Test lokal sebelum GitHub

Karena frontend memakai `fetch()`, jalankan melalui web server lokal, jangan
hanya double-click `index.html`.

Contoh Python:

```bash
cd frontend
python -m http.server 8080
```

Buka:

```text
http://localhost:8080
```

Test minimal:

1. Login Admin.
2. Login Guru.
3. Login Siswa.
4. Katalog Course.
5. Teacher Course Workspace.
6. Quiz.
7. Pengumpulan tugas.
8. Penilaian tunggal dan massal.
9. Gradebook.
10. Rekap/Analitik.

## D. Upload ke GitHub

```bash
git init
git add .
git commit -m "GitHub Ready V1"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPOSITORY.git
git push -u origin main
```

Workflow `.github/workflows/pages.yml` akan men-deploy isi folder `frontend`
ke GitHub Pages.

Di repository GitHub:

Settings > Pages > Source > GitHub Actions

## E. Optional: gunakan clasp untuk backend

Anda dapat mengelola `backend/` dengan clasp. Hubungkan folder backend ke project
Apps Script Anda, lalu push perubahan backend melalui clasp. Simpan konfigurasi
lokal yang tidak ingin dipublikasikan di file yang diabaikan Git.

## Session dan keamanan

Gateway V1 menggunakan signed session token HMAC-SHA256 dengan masa berlaku 8 jam.
Token disimpan pada `localStorage` browser. Backend memvalidasi token, role, dan
mengganti parameter actor/user ID dengan user ID dari token sebelum menjalankan
fungsi lama.

Ini mengurangi risiko pemalsuan `userId` dari frontend setelah LMS dipindahkan
ke GitHub Pages.

## Catatan keamanan lanjutan

Database lama masih menyimpan password berdasarkan skema asli LMS. V1 sengaja
tidak mengubah format password agar akun yang sekarang tidak rusak. Tahap
hardening berikutnya sebaiknya memigrasikan password ke hash + salt secara
backward-compatible.

## Rollback

`backend/Index.html` adalah salinan frontend lama yang masih menggunakan
`google.script.run`. Selama `Code.gs` lama tetap menggunakan `doGet()`, URL
Google Apps Script lama masih dapat dipakai sebagai jalur rollback saat GitHub
Pages sedang diuji.


## Endpoint aktif

Paket ini sudah dikonfigurasi menggunakan deployment Google Apps Script berikut:

```text
https://script.google.com/macros/s/AKfycbzjvtX0K6nECsqLSGgOnySqB0D11OYr1EPGCqouwEM0Jt0_vat-rRuxFomutmPCk0iY/exec
```

Jika Anda membuat deployment baru di kemudian hari, perbarui
`frontend/assets/js/config.js`.
