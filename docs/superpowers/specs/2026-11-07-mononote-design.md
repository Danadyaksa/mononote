# Desain Aplikasi Desktop: Mononote

**Tanggal:** 2026-11-07  
**Lokasi Projek:** `D:\Projek Aksa\mononote`  
**Stack Utama:** Tauri v2 (Rust) + React 19 + TypeScript + TipTap

---

## 1. Tujuan & Filosofi Produk

Membangun aplikasi *notepad* desktop personal untuk Windows yang ringan, cepat, dan nyaman di mata—terinspirasi dari kesederhanaan **Apple Notes di iPhone**. Aplikasi menghindari fitur berlebih (*bloat* seperti sistem folder berlapis, tabel rumit, atau *slash-command* panjang) dan berfokus penuh pada:
- Buka langsung ngetik dengan tipografi yang lega dan bersih.
- Warna ramah mata di mode terang hangat (*Warm Light*) maupun gelap elegan (*Sleek Dark*).
- Fitur **Pin ke Layar (*Always-on-Top*)** yang praktis dipakai berdampingan saat bekerja.

---

## 2. Cakupan Fitur Utama (Scope)

### 2.1 Editor Teks Esensial ala iPhone Notes
- **Baris Pertama = Judul Otomatis:** Dokumen menggunakan skema terstruktur di mana blok pertama selalu menjadi judul besar (`24px`, tebal), dan menekan `Enter` otomatis berpindah ke paragraf isi (`16px`).
- **Format Esensial Saja:** Hanya mendukung **Bold** (`Ctrl+B`), **Italic** (`Ctrl+I`), **Bullet List**, dan **Checklist Kotak Centang** interaktif.
- **Auto-Save Instan:** Perubahan teks disimpan otomatis `300ms` setelah berhenti mengetik, serta dipaksa simpan seketika (*flush*) saat pengguna berpindah catatan atau menutup jendela aplikasi.

### 2.2 Organisasi Tanpa Folder Ribet
- **Search Instan:** Satu kotak pencarian di bagian atas sidebar yang menyaring catatan secara *real-time* berdasarkan kecocokan judul maupun isi teks.
- **Pin Catatan Penting:** Catatan penting dapat disematkan agar selalu berada di grup paling atas (**Disematkan**), terpisah dari **Catatan Lainnya**. Di dalam masing-masing grup, catatan diurutkan dari waktu edit terbaru (`updated_at` menurun).
- **Aksi Cepat:** Buat catatan baru (`Ctrl+N`), sematkan/lepas sematan catatan, dan hapus catatan.

### 2.3 Jendela Sleek & Mode Pin ke Layar (*Always-on-Top*)
- **Custom Frameless Titlebar:** Menggunakan jendela tanpa bingkai bawaan Windows (`decorations: false`) dengan *titlebar* tipis yang menyatu mulus bersama warna aplikasi, mendukung geser jendela (*drag region*), *Minimize*, *Maximize/Restore*, dan *Close*.
- **Pin ke Layar + Focus Mode:**
  - Mengklik tombol **Pin Layar** mengaktifkan mode *Always-on-Top* native melalui API Tauri sehingga jendela tidak tertutup aplikasi lain.
  - Saat **Pin Layar** dinyalakan, sidebar kiri otomatis melipat (*collapse*) agar jendela berubah menjadi **1 lembar catatan ringkas**. Pengguna tetap bebas membuka/menutup sidebar secara manual kapan pun lewat tombol *Toggle Sidebar* (`Ctrl+\`).

### 2.4 Sistem Visual, Warna & Tipografi
- **Tipografi:** Menggunakan *font stack* sistem modern (`Segoe UI Variable`, `-apple-system`, `Inter`, `sans-serif`) untuk ketajaman render layar Windows.
  - Judul catatan: `24px`, `font-weight: 700`, `line-height: 1.25`, `letter-spacing: -0.02em`.
  - Isi catatan: `16px`, `font-weight: 400`, `line-height: 1.65`, lebar kolom baca maksimal `65ch` di tengah ruang editor.
- **Palet Warna Anti-Silau:**
  - **Warm Light Mode:** Editor `#FAF9F6`, Sidebar `#F2F0EB`, Teks utama `#1C1C1E`, Teks sekunder `#6E6D68`, Aksen `#D99B26`, Garis batas `rgba(28, 28, 30, 0.08)`.
  - **Sleek Dark Mode:** Editor `#18181A`, Sidebar `#121214`, Teks utama `#F2F2F7`, Teks sekunder `#8E8E93`, Aksen `#E5A93B`, Garis batas `rgba(255, 255, 255, 0.07)`.
- **Memori Preferensi:** Pilihan tema (*Light* / *Dark*) disimpan di `localStorage` (default mengikuti tema sistem saat pertama kali dibuka).

---

## 3. Arsitektur Sistem & Pemisahan Modul

Sistem dibagi menjadi unit-unit kecil dengan batas tanggung jawab yang jelas:

```
D:\Projek Aksa\mononote\
├── src-tauri/                  # Backend Native Rust (Tauri v2)
│   └── src/
│       ├── models.rs           # Tipe data Note & NoteSummary (Serialize/Deserialize)
│       ├── storage.rs          # Baca/tulis file JSON lokal + atomic write + ekstraksi judul
│       ├── commands.rs         # Handler IPC Tauri (CRUD catatan + Always-on-Top window)
│       └── lib.rs              # Registrasi plugin & Tauri builder
└── src/                        # Frontend UI (React + TypeScript)
    ├── api/
    │   └── notes.ts            # Jembatan komunikasi ke command Rust
    ├── components/
    │   ├── Titlebar.tsx        # Kontrol jendela, tema, format esensial, & tombol Pin Layar
    │   ├── Sidebar.tsx         # Input Search + daftar grup Disematkan & Catatan Lainnya
    │   └── NoteEditor.tsx      # Editor TipTap (skema Judul + Isi + Checklist)
    ├── styles/
    │   └── theme.css           # Token CSS variabel Light/Dark, tipografi, & transisi halus
    └── App.tsx                 # Koordinasi state aktif, shortcut keyboard, & auto-save
```

### 3.1 Model Data & Penyimpanan (`models.rs` & `storage.rs`)
- Setiap catatan disimpan sebagai satu file mandiri `<uuid>.json` di dalam folder data aplikasi lokal (`AppData/Roaming/com.mononote.desktop/notes/`).
- Struktur `Note`:
  - `id: String` (UUID v4)
  - `title: String` (diekstrak otomatis dari baris pertama teks; fallback `"Catatan Baru"`)
  - `preview: String` (diekstrak otomatis dari baris kedua non-kosong, dipotong maks. 90 karakter; fallback `"Belum ada teks tambahan"`)
  - `content_json: String` (dokumen JSON TipTap untuk mempertahankan format bold/italic/checklist)
  - `plain_text: String` (teks murni untuk kebutuhan pencarian cepat di sisi Rust)
  - `pinned: bool`
  - `created_at: i64` (Unix timestamp milidetik)
  - `updated_at: i64` (Unix timestamp milidetik)
- Struktur `NoteSummary` (dikirim ke Sidebar agar hemat RAM):
  - Hanya memuat `id`, `title`, `preview`, `pinned`, dan `updated_at` (tanpa `content_json` dan `plain_text`).
- **Atomic File Write:** Saat menyimpan, `storage.rs` menulis ke `<uuid>.json.tmp`, memanggil `sync_all()`, lalu mengganti file tujuan menggunakan `std::fs::rename` agar file catatan tidak pernah setengah tertulis jika listrik/sistem mati mendadak.

### 3.2 Antarmuka IPC Rust (`commands.rs`)
- `list_notes(query: Option<String>) -> Result<Vec<NoteSummary>, String>` — membaca daftar catatan, menyaring `title` dan `plain_text` secara *case-insensitive* bila `query` diisi, lalu mengurutkan (`pinned` lebih dulu, kemudian `updated_at` terbaru).
- `get_note(id: String) -> Result<Note, String>` — memuat satu catatan penuh saat dipilih di sidebar.
- `create_note() -> Result<Note, String>` — membuat catatan kosong baru dan menyimpannya ke disk.
- `save_note(id: String, content_json: String, plain_text: String) -> Result<NoteSummary, String>` — memperbarui isi catatan, menghitung ulang `title`, `preview`, dan `updated_at`, lalu mengembalikan `NoteSummary` terbaru.
- `toggle_pin_note(id: String) -> Result<NoteSummary, String>` — membalik status `pinned` tanpa mengubah `updated_at` isi catatan.
- `delete_note(id: String) -> Result<(), String>` — menghapus file `<id>.json` dari disk.
- `set_always_on_top(window: tauri::WebviewWindow, always_on_top: bool) -> Result<bool, String>` — mengatur properti *always-on-top* pada jendela aplikasi.

---

## 4. Penanganan Error & Kasus Tepi (Edge Cases)

1. **Inisialisasi Pertama Kali:** Jika aplikasi dijalankan pertama kali (belum ada riwayat inisialisasi dan folder `notes/` kosong), sistem membuat 1 catatan sambutan singkat berisi contoh judul dan *checklist* supaya pengguna langsung merasakan pengalaman mengetik tanpa layar kosong membingungkan. Penanda inisialisasi disimpan sehingga jika pengguna nantinya menghapus semua catatan, sistem tidak membuat ulang catatan sambutan melainkan menampilkan *empty state* bersih dengan tombol **"Buat Catatan Baru"**.
2. **Isolasi File Rusak:** Jika terdapat file `.json` di folder `notes/` yang rusak akibat modifikasi eksternal, `list_notes` melewati file tersebut dan mencatat peringatan ke log tanpa menggagalkan pemuatan catatan lainnya.
3. **Kegagalan Simpan:** Jika operasi disk gagal (misalnya disk penuh), teks di editor tetap aman di memori dan muncul indikator halus *"Gagal menyimpan"* dengan percobaan simpan ulang otomatis pada ketikan berikutnya.

---

## 5. Prasyarat Lingkungan & Strategi Pengujian

### 5.1 Prasyarat Build di Windows
- **Node.js v22** (sudah tersedia di PC).
- **Rust Toolchain (`rustup` + MSVC Build Tools)**: akan diperiksa/dipasang pada tahap awal rencana implementasi agar `cargo` dan `tauri` dapat mengompilasi binary `.exe` native.
- **Microsoft Edge WebView2** (sudah bawaan Windows 10/11).

### 5.2 Rencana Verifikasi
- **Unit Test Rust (`cargo test`):**
  - Menguji ekstraksi `title` dan `preview` dari teks berbagai bentuk (kosong, hanya 1 baris, banyak baris).
  - Menguji pembuatan, pembaruan *atomic*, penghapusan, pencarian *case-insensitive*, dan urutan sortir (`pinned` di atas + `updated_at` terbaru).
- **Unit Test Frontend (`vitest`):**
  - Menguji pemisahan daftar sidebar ("Disematkan" vs "Catatan Lainnya"), pemanggilan *auto-save*, perilaku otomatis melipat sidebar saat tombol *Pin Layar* diaktifkan, serta pergantian tema *Light/Dark*.
- **Uji Jalan Aplikasi (`npm run tauri dev`):**
  - Memastikan jendela *frameless*, *Always-on-Top*, *checklist*, dan ketahanan penyimpanan catatan setelah aplikasi ditutup-buka kembali berjalan mulus.
