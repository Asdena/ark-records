# ARK RECORDS v1.0.1 — login PC / Android

## Cara memasang patch

ZIP ini hanya berisi file pembaruan. Salin isinya ke folder proyek lama yang
memiliki index.html; setujui penggantian file. Jangan membuat subfolder baru untuk
file aplikasi. ZIP tidak menyertakan config.js: Client ID milikmu tetap dipakai.
Tidak ada perubahan format arsip Drive, proyek Google, atau scope.

## Apa yang diperbaiki

- Form setup tidak muncul jika Client ID sudah valid.
- Status membedakan Client ID dari website dan Client ID lokal browser saja.
- config.js dimuat dengan URL baru saat membuka halaman, agar versi cache lama
  tidak terus terpakai. index.html memakai entry app.js?v=1.0.1.
- Login menunggu library Google siap, penting untuk koneksi HP yang lebih lambat.
- Tidak memaksa pemilihan akun setiap kali membuka halaman; Google tetap dapat
  meminta pemilihan akun/izin sesuai sesi browser.
- Pembatalan/popup diblokir memberi pesan dan memungkinkan percobaan ulang.
- Tombol sambungkan kembali saat sesi habis juga tersedia di formulir edit.

Login PC tidak otomatis menjadi login Android. Client ID mengidentifikasi aplikasi,
bukan sesi akun atau password. Tiap browser perlu memberi akses menggunakan akun
Google yang sama. Pada model website statis ini, token hanya ada di memori halaman;
reload/penutupan halaman dapat meminta koneksi ulang. Patch tidak menjanjikan login
permanen atau login lintas perangkat tanpa persetujuan Google.

## Pastikan Client ID benar-benar dipublikasikan

Di config.js milikmu bentuknya harus tetap:

```js
export const config = {
  googleClientId: "CLIENT_ID_MILIKMU.apps.googleusercontent.com"
};
```

Gunakan Client ID/proyek yang sama yang sudah berfungsi di PC. Jangan membuat
proyek Google baru: appDataFolder terikat aplikasi/proyek dan akun yang digunakan.
Tombol Simpan konfigurasi pada website hanya menyimpan di browser itu; tombol
tersebut tidak mengedit file GitHub atau menyinkronkan konfigurasi ke HP.

Setelah push dan Pages selesai deploy:

1. Buka URL Pages yang sama di Chrome Android (bukan browser dalam WhatsApp/Instagram).
2. Halaman koneksi harus menunjukkan v1.0.1 dan "Koneksi sudah disiapkan".
3. Pilih "Buka arsip dengan Google" dan akun Google yang sama dengan PC.
4. Jika masih diminta mengisi Client ID, buka URL website ditambah
   `config.js?check=101` setelah path repo, misalnya
   `https://USERNAME.github.io/ark-records/config.js?check=101`.
   Pastikan nilainya bukan string kosong dan sama seperti di PC.
5. Jika v1.0.1 belum terlihat, periksa deployment GitHub Pages dan muat ulang
   halaman. Untuk diagnosis, buka link dengan tambahan `?v=101` sebelum hash.
6. Pastikan origin OAuth sesuai domain Pages (tanpa path repo), Drive API aktif,
   dan email kamu termasuk Test users. Jangan menambahkan domain Android: browser
   HP memakai origin website yang sama.

Jika setelah memilih akun tetap gagal, catat pesan Google persis atau ambil
screenshot. Patch ini belum diuji terhadap URL deployment dan akun Google milikmu.

## Git push dari terminal Visual Studio Code

### Jika folder proyek sudah merupakan Git repository

1. VS Code → File → Open Folder → pilih folder proyek yang berisi index.html.
2. Terminal → New Terminal. Periksa repo dan branch:

```sh
git status
git remote -v
git branch --show-current
```

3. Setelah menyalin patch, periksa perubahan, lalu buat commit:

```sh
git diff --stat
git add app.js auth-config.js i18n.js index.html config.js package.json package-lock.json tests/ui.mjs tests/auth-config.test.mjs TESTING.md UPDATE-v1.0.1.md
git diff --cached --stat
git commit -m "Fix Google login setup on mobile"
```

4. Jika branch pada langkah 2 adalah main dan remote bernama origin:

```sh
git push -u origin main
```

Ganti main bila branch-mu berbeda. Branch Pages di Settings → Pages harus sesuai
branch tempat aplikasi disimpan. Login GitHub lewat browser jika terminal memintanya.

### Jika muncul "not a git repository" (repo online sudah ada)

Clone repo yang sudah kamu buat ke folder baru agar riwayat GitHub tetap terjaga:

```sh
git clone https://github.com/USERNAME/NAMA-REPO.git
cd NAMA-REPO
```

Ganti USERNAME/NAMA-REPO. Buka folder hasil clone di VS Code, lalu salin file patch
ke situ. Pastikan config.js dari repo masih memiliki Client ID kamu. Lanjutkan
perintah add, commit, dan push di atas. Jangan jalankan git init di folder lain
untuk menimpa riwayat repo yang sudah ada.

### Jika Git belum mengenal nama/email pembuat commit

Isi identitas untuk repo ini saja, lalu ulangi commit:

```sh
git config user.name "Nama Kamu"
git config user.email "EMAIL_GITHUB_KAMU"
```

Bisa memakai alamat noreply dari pengaturan email GitHub.

### Jika push ditolak karena repo online lebih baru

Sesudah perubahan lokal di-commit, jalankan:

```sh
git pull --rebase origin main
```

Jika berhasil, ulangi push. Jika ada konflik, jangan force push: selesaikan file
konflik lalu git add dan git rebase --continue, atau git rebase --abort untuk
membatalkan rebase dan kembali ke commit lokal. Branch main di contoh harus
sesuai branch-mu.

## Verifikasi yang sudah dijalankan

13 tes Node lulus, termasuk konfigurasi browser baru, prioritas config.js,
konfigurasi lokal, serta konfigurasi rusak. Tes DOM lulus untuk Google script lambat,
form setup tersembunyi, prompt Google, alur arsip, dan keluar akun.
Ini tes simulasi. Login nyata/CSP/popup Chrome Android belum diuji di perangkatmu.

Referensi:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository
