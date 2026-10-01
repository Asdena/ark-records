# ARK RECORDS — Web

Arsip pribadi untuk mengingat orang yang kamu kenal. Website statis, tanpa backend
berbayar, tanpa database pihak ketiga. Data dan media berada di Google Drive milik
pengguna melalui OAuth dan scope `drive.appdata`.

## Mulai

Baca **SETUP.html** (bisa dibuka langsung untuk membaca panduan).
Upload isi folder ini ke repo GitHub publik, aktifkan Pages dari branch `main`, root.
Aplikasi harus dibuka melalui HTTPS atau localhost, bukan `file://`.
Isi Google OAuth Client ID di halaman awal atau `config.js`. Jangan masukkan
client secret, password, atau token ke kode. Batasi OAuth Testing ke akunmu.
Repo/push/penerbitan dilakukan pengguna, sesuai permintaan.

## Yang diimplementasikan

- Beranda, daftar orang, profil, tambah/edit/hapus; hanya nama wajib.
- Kontak, pekerjaan, organisasi, sekolah, ulang tahun, hubungan, minat,
  likes/dislikes, tag, catatan, akun sosial tanpa batas tetap, kenangan.
- Pencarian tanpa membedakan kapital, filter tag/hubungan, tiga pilihan urutan.
- Foto profil, banyak foto/video, kamera melalui picker HP, caption, thumbnail,
  penampil media; berkas asli disimpan di Drive.
- Asisten deterministik EN/ID dengan hasil dari arsip, bukan model AI eksternal.
- Tema system/light/dark, antarmuka Indonesia/English.
- Backup lengkap data dan media; impor menambahkan salinan, tidak menimpa data.
- Versi immutable per profil; konflik antardua perangkat tidak dibuang diam-diam.
- Lock/sign-out yang membersihkan memori sesi, statistik ruang ARK, cleanup.

## Perubahan dari spesifikasi Android

Tidak ada APK, Room, biometric/PIN aplikasi, backend, atau akun aplikasi tambahan.
Login/otorisasi ditangani Google. Core saat ini online, bukan offline-first.
Data diletakkan di `appDataFolder` privat (tersembunyi dari My Drive biasa) untuk
menghindari pembagian file tanpa sengaja. Halaman/kode tetap publik di GitHub Pages.
Penghapusan permanen riwayat/media dilakukan terpisah lewat cleanup setelah konfirmasi.

## Menjalankan lokal dan tes

Memerlukan Python 3 untuk server lokal, Node.js 22+ untuk tes. Tidak ada dependency
runtime atau proses build/bundler. Dependency dev happy-dom hanya untuk tes DOM opsional.

```
python3 -m http.server 4173 --bind 127.0.0.1
```

Buka `http://127.0.0.1:4173`, dan tambahkan origin itu ke Google OAuth jika ingin
menguji koneksi. Untuk tes otomatis:

```
npm test
# Opsional, pemeriksaan integrasi DOM:
npm ci
npm run test:ui
```

Unit/integration tests menggunakan HTTP Drive simulasi; akun pengguna tidak diakses.
Baca **TESTING.md** untuk hasil dan checklist akun/perangkat nyata yang belum diuji.

## Struktur

- `index.html`, `style.css`, `app.js`: tampilan dan alur.
- `core.js`: validasi, pencarian, parser, resolusi revisi.
- `drive.js`: OAuth-token authenticated Drive calls dan revisi.
- `i18n.js`: label Indonesia/English.
- `config.js`: satu konfigurasi OAuth publik.
- `SETUP.html`: petunjuk pemilik akun.
- `tests/`: tes Node, tidak dikirim ke layanan lain.

## Batas dan privasi

50 MB per media; backup maksimal 100 MB (termasuk base64). Backup menyimpan media
asli tetapi thumbnail dibuat ulang saat impor. Video memakai pemutar browser;
kompatibilitas codec berbeda antarperangkat. Backup bukan ZIP Android dan tidak
dienkripsi. Simpan file backup secara privat.

Tidak ada penyimpanan permanen arsip/token di localStorage, service worker,
analitik, SDK iklan, font eksternal, atau backend. localStorage hanya untuk Client
ID publik, bahasa, dan tema. Token Google hanya di memori. CSP membatasi resource.
Data Drive bergantung pada keamanan akun Google, bukan enkripsi end-to-end ARK.
Mengunci ARK tidak sign out dari akun Google browser atau revoke consent.

Sinkronisasi saat login, muat ulang, dan sebelum/sesudah simpan. Tidak real time.
Jangan cleanup ketika ada draf belum disimpan pada perangkat lain: cleanup membuang
media yang belum direferensikan profil. Immutable revisions menjaga konflik,
bukan transaksi lintas profil. Jika impor terputus, sebagian salinan dapat tersimpan;
aplikasi melaporkan ini tanpa menghapus data lama. API throttling tidak diulang
secara agresif: coba lagi setelah jeda. Untuk arsip besar, diperlukan indeks dan
backup streaming di versi lanjutan.

Tidak ada domain atau layanan berbayar yang dibeli/dihubungkan oleh proyek ini.
