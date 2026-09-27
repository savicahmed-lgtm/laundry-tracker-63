# PRD — Loundry Suci

## Problem Statement
Aplikasi mobile "Loundry Suci" (layanan laundry Indonesia). Login pakai nomor HP + password. Data pelanggan: No HP, Alamat, Poin. Jenis cucian (12 item): Karpet, Kaos, Kemeja, Celana, Sepatu, Gaun, Topi, Tas, Bed cover, Sprei, Helm, Boneka + jumlah. Opsi layanan: dijemput & antar ATAU diterima cabang. Tracking delivery maps dengan kurir bergerak. Status: Diterima > Lunas > Dicuci > Disetrika > Siap diambil/diantar > Selesai. Feedback: rating bintang + komentar.

## User Choices
- Pengguna: Pelanggan + Admin/Cabang
- Peta: rute & posisi kurir bergerak (simulasi real-time)
- Pembayaran: simulasi in-app
- Poin: 1 kg = 1 poin; setiap 25 poin = 1 kg gratis
- Harga: default per item
- Tema: hijau (nuansa "suci"/bersih)

## Architecture
- Frontend: Expo Router (React Native), react-query, react-native-maps (native) + stylized web fallback, @react-native-vector-icons/ionicons, Plus Jakarta Sans, green theme in `src/theme.ts`.
- Backend: FastAPI + Motor (MongoDB), JWT auth (phone+password, passlib bcrypt), role-based (customer/admin).
- Auth token stored in SecureStore via `@/src/utils/storage`.

## User Personas
1. Pelanggan — buat pesanan, bayar, lacak status + peta kurir, beri rating.
2. Admin/Cabang — lihat semua pesanan, majukan status, lihat ulasan.

## Core Requirements (static)
- Phone+password auth, register (customer only).
- Catalog 12 item + harga + berat.
- Order: pilih item & qty, opsi layanan, redemption poin, simulasi bayar.
- Tracking timeline 6 status + peta kurir bergerak + ETA.
- Poin loyalti (1kg=1pt, 25pt=1kg gratis).
- Feedback rating bintang + komentar (setelah selesai).
- Admin dashboard update status berurutan.

## Implemented (2026-06)
- [x] JWT phone auth + register + profile edit
- [x] Home: kartu poin, active order, grid 12 item
- [x] Buat pesanan + steppers + opsi layanan + redemption + ringkasan
- [x] Simulasi pembayaran (Diterima -> Lunas) + award poin
- [x] Tracking screen: timeline vertikal 6 status + peta + ETA kurir
- [x] Peta kurir bergerak (native react-native-maps, web fallback simulasi)
- [x] Feedback rating bintang + komentar
- [x] Admin dashboard: stats, filter chips, advance status, lihat ulasan
- [x] Seed admin + demo customer
- Verified: 27/27 backend tests + frontend flows (iteration 1)

## Backlog
- P1: Riwayat poin / transaksi detail; notifikasi status (butuh build device)
- P1: Alamat multiple + pilih titik peta untuk pickup
- P2: Foto cucian saat drop-off (Object Storage); estimasi waktu selesai
- P2: Filter/search pesanan admin; export laporan

## Notes
- Native maps (react-native-maps) butuh dev/production build untuk render penuh; web preview memakai peta simulasi.
