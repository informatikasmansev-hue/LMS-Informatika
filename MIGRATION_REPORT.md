# Migration Report — GitHub Ready V1

## Audit sumber

- Frontend sumber: 2,804 baris.
- Backend sumber: 2,631 baris.
- Ditemukan 31 nama action literal yang dipanggil melalui `serverCall(...)`.
- Seluruh 31 action tersebut memiliki fungsi pasangan di `Code.gs`.
- Ditemukan hanya 2 referensi `google.script.run`: satu restore session langsung,
  dan satu di fungsi wrapper `serverCall`.
- Karena komunikasi backend sudah terpusat, migrasi dapat dilakukan dengan
  mengganti bridge tersebut tanpa menulis ulang setiap halaman fitur.

## Perubahan V1

1. CSS inline dipindah ke `frontend/assets/css/style.css`.
2. JavaScript aplikasi dipindah ke `frontend/assets/js/app.js`.
3. Konfigurasi endpoint dipindah ke `frontend/assets/js/config.js`.
4. `google.script.run` diganti dengan `fetch()` melalui `frontend/assets/js/api.js`.
5. Restore session memakai API `getCurrentUser`.
6. Logout menghapus signed session token.
7. Ditambahkan `backend/Api.gs` sebagai `doPost()` gateway.
8. Gateway memakai whitelist action.
9. Gateway memvalidasi role.
10. Gateway mengikat actor/user identity ke signed token, bukan mempercayai
    `userId` dari browser.
11. Ditambahkan GitHub Actions untuk deploy folder `frontend/` ke GitHub Pages.
12. Backend lama + Index lama dipertahankan untuk rollback selama transisi.

## Action API yang dipertahankan

### Public
- `loginUser`
- `signupUser`
- `ping`

### User
- `getCurrentUser`
- `updateProfile`
- `getCourses`
- `getCourseDetails`

### Siswa
- `enrollInCourse`
- `unenrollCourse`
- `markVideoComplete`
- `submitAssignment`
- `submitQuiz`

### Admin/Guru
- `getAdminData`
- `getAllLessonsAdmin`
- `saveLesson`
- `deleteLesson`
- `getAssignmentsByLesson`
- `saveAssignment`
- `deleteAssignment`
- `getTeacherAnalyticsData`
- `gradeAssignmentSubmit`
- `gradeAssignmentSubmitsBulk`
- `getRecapData`
- `exportRecapToSheet`
- `exportGradesToSheet`

### Admin
- `getAdminCourses`
- `saveCourse`
- `deleteCourse`
- `getTeachers`
- `saveTeacher`
- `deleteTeacher`

### Guru
- `getTeacherCourseWorkspace`
- `getTeacherAssignmentData`
- `getTeacherGradebookData`

## Temuan yang tidak diubah pada V1

### Password lama
`Code.gs` sumber masih membandingkan dan menyimpan password mengikuti format
database lama. Mengubahnya sekaligus berisiko membuat akun lama gagal login.

Rekomendasi V2:
- hash + salt;
- upgrade hash otomatis saat user berhasil login dengan password lama;
- reset/revokasi session ketika password berubah.

### Web App lama
`Code.gs` masih memiliki `doGet()` untuk menampilkan `Index.html`. Ini
dipertahankan agar URL lama tetap berfungsi sebagai rollback selama pengujian.

Setelah GitHub Pages stabil, Anda dapat memilih untuk mengubah `doGet()` menjadi
health/status endpoint atau menonaktifkan UI lama.
