# ARK RECORDS v1.1.0 — Retro Future

Patch untuk ARK RECORDS v1.0.1. Salin seluruh isi ZIP ini ke folder proyek lama,
sejajar dengan index.html, dan ganti file yang namanya sama. Ini patch, bukan
proyek mandiri. File config.js, auth-config.js, drive.js, dan core.js lama tetap
dipakai. Client ID, scope Google, dan format data Drive tidak berubah.

## Tampilan baru

- Font Pixelify Sans lokal untuk judul, tombol, navigasi dan label. Isian dan
  catatan memakai monospace agar teks panjang tetap mudah dibaca.
- Panel terminal bersudut tegas, garis grid, aksen neon, efek scanline halus.
- Animasi masuk halaman, kartu bertahap, dialog dan indikator proses.
- Sorotan hover, garis kartu yang memanjang, feedback tekan tombol.
- Tema gelap menjadi bawaan untuk browser yang belum memilih tema. Preferensi
  lama tetap dipertahankan. Jika masih terang: Pengaturan → Tema → Gelap.
- Tampilan HP memakai navigasi ringkas; tombol tetap dapat disentuh.

## Fitur tambahan

1. **Menu cepat**: tombol di header atau Ctrl+K / Cmd+K. Buka tambah orang,
   pencarian, asisten, atau pengaturan. Tab/Enter/Esc juga berfungsi.
2. **Kartu / Daftar**: ubah susunan daftar orang, tersimpan sebagai preferensi
   browser. Filter, pencarian dan urutan tetap berlaku.
3. **Ringkasan arsip**: jumlah profil, media asli dan kenangan pada beranda.
   Angka berasal dari data yang sudah dimuat dari Drive, bukan data contoh.
4. **Warna neon**: Cyan / Terminal, Amber / Arcade, Violet / Orbit.
5. **Animasi & efek layar**: aktif/nonaktif di Pengaturan. Preferensi kurangi
   gerakan dari sistem operasi selalu dihormati, termasuk saat efek dipilih aktif.

Tidak ada suara otomatis, video latar, pelacak, atau server tambahan.
Tidak ada fitur baru yang mengubah atau menghapus arsip.

## Memasang dan push lewat terminal VS Code

1. Buka folder repo lama, lalu salin isi patch ke dalamnya (bukan ZIP-nya).
2. Pastikan folder assets/fonts ikut disalin: berisi font dan lisensinya.
3. Jalankan:

```powershell
git status
git add app.js i18n.js index.html retro.css assets/fonts package.json package-lock.json tests/ui.mjs TESTING.md UPDATE-v1.1.0.md
git diff --cached --stat
git commit -m "Add retro futuristic pixel interface"
git push origin main
```

Jika branch bukan main, sesuaikan. Jangan force push jika terjadi error.
Tunggu deployment GitHub Pages selesai. Buka website dengan tambahan `?v=110`
sebelum hash, misalnya `https://asdena.github.io/ark-records/?v=110`.
Versi di halaman koneksi/Pengaturan harus v1.1.0.

Jika font belum berubah, cek bahwa `assets/fonts/PixelifySans.ttf` dan `retro.css`
ada di repo, lalu muat ulang. Jangan mengganti config.js dengan file kosong.

## Pengujian

13 unit/integration tests dan tes DOM diperluas lulus. Tes DOM memeriksa menu
cepat, akses formulir dari menu, shortcut keyboard, ringkasan arsip, susunan daftar,
serta penyimpanan preferensi warna/efek; alur login lama juga tetap diuji.

Pemeriksaan visual browser tidak tersedia di lingkungan pembuat patch: unduhan
browser pengujian tidak dapat diakses. DOM bukan pengujian layout atau codec.
Perlu cek manual setelah deploy: desktop dan Chrome Android, dark/light, ketiga
warna, tampilan daftar, buka/tutup dialog, efek off, dan pengaturan reduced motion.
Login Google/Drive asli tidak dijalankan ulang; mekanismenya tidak diubah.

## Font

Pixelify Sans © 2021 The Pixelify Sans Project Authors.
SIL Open Font License 1.1 disertakan di assets/fonts/OFL.txt.
Sumber: https://github.com/google/fonts/tree/main/ofl/pixelifysans
Font disajikan dari repo sendiri, tanpa permintaan font ke Google saat pemakaian.
