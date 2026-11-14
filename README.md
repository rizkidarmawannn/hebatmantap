# Melestarikan: Tutur Terakhir

Game puzzle kata naratif berbasis HTML5 (Web / Desktop & Mobile Browser).

Pemain duduk bersama Nenek Wati, penutur terakhir bahasa daerah (Bahasa Talu), di teras rumah panggungnya saat senja. Dengarkan ceritanya, amati gestur Nenek dan benda-benda di sekitar teras, lalu tebak dan catat minimal 15 dari 20 kata daerah ke dalam Buku Kosakata sebelum energi Nenek habis.

---

## Fitur Utama

- **10 Segmen Cerita & 20 Kata Kosakata**: Disusun terstruktur di `data/story.json` mencakup kategori benda rumah tangga, alam & hewan, tindakan, kerabat, serta perasaan & waktu. Setiap kata muncul minimal 2 kali dalam konteks cerita yang berbeda.
- **Sistem Energi & Kepercayaan**: Batas waktu sesi berbasis energi Nenek (bukan timer dingin). Kepercayaan Nenek menentukan seberapa jelas petunjuk dan gestur yang diberikan.
- **Sistem 4 Pilihan Pertanyaan**: Pemain memiliki 6 kuota pertanyaan per sesi untuk meminta petunjuk fungsi, mengulang gestur, mendalami perasaan, atau menanyakan sosok kerabat.
- **Visual Pixel-Art Teras Senja**: Render canvas responsif dengan langit senja yang bergradasi dinamis seiring menurunnya energi, bintang, kunang-kunang, rintik hujan, sprite Nenek Wati dengan animasi gestur & ekspresi, serta anak-anak desa di ending menang.
- **Audio Atmosferik Web Audio API**: Musik petikan kecapi & tiupan suling pentatonis, suara jangkrik malam, efek goresan pena, nada tebakan benar/salah yang lembut, serta batuk Nenek ketika energi di bawah 25%.
- **4 Variasi Ending**: Menang – Warisan Penuh (20/20 kata), Menang – Warisan (18–19 kata), Menang – Warisan Tipis (15–17 kata), dan Kalah – Senyap (< 15 kata).

---

## Cara Menjalankan

### Persyaratan
- Node.js (versi 16 atau lebih baru)

### Langkah-langkah
1. Clone repository:
   ```bash
   git clone https://github.com/rizkidarmawannn/hebatmantap.git
   cd hebatmantap
   ```

2. Jalankan server lokal:
   ```bash
   node server.js
   ```
   *(atau `npm start`)*

3. Buka browser di:
   ```
   http://localhost:3000
   ```

---

## Struktur Folder

```text
├── css/
│   └── style.css          # Styling UI, palet senja, aksesibilitas kontras & skala teks
├── data/
│   ├── story.json         # Konten narasi, 20 kata daerah, petunjuk, dan opsi jawaban
│   └── tuning.json        # Nilai penyeimbangan energi, kepercayaan, kuota, dan ending
├── js/
│   ├── art.js             # Pixel-art canvas renderer & generator ikon 16x16
│   ├── audio.js           # Sintesis Web Audio API (kecapi, suling, jangkrik, SFX)
│   ├── engine.js          # Logika state game, drain energi pasif, kepercayaan, tebakan
│   └── ui.js              # Controller typewriter dialog, buku kosakata, dan modal
├── index.html             # Tampilan utama web game
├── server.js              # Server static HTTP zero-dependency dengan auto-port fallback
└── package.json           # Metadata proyek
```
