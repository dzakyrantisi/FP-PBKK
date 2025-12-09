#align(center,)[= Laporan Pengembangan Tea Haven (e-commerce)]

 1. Ringkasan Umum

- Ruang lingkup: Platform e-commerce teh berbasis NestJS + Prisma (backend) dan Next.js  (frontend).
- Tujuan: Memenuhi kebutuhan MVP: autentikasi JWT, RBAC, manajemen produk seller, katalog & checkout customer, pengelolaan order, upload gambar, email notifikasi, dan UI bertema natural green.
- Hasil: Fitur inti telah selesai dan saling terhubung; backend diverifikasi lewat uji e2e Jest + Supertest, frontend diuji manual pada skenario login, katalog, cart, checkout, dan dashboard seller.
- Timelines utama:
	- Sprint 1: Fundamenta backend (schema Prisma, auth, produk dasar) + setup frontend AuthContext.
	- Sprint 2: CRUD produk lengkap dengan upload, filter katalog, cart, checkout, order seller.
	- Sprint 3: Integrasi email, polishing UI, penyesuaian gambar, dokumentasi akhir serta laporan ini.
- Catatan scope creep: Selama iterasi, branding berubah ke "Tea Haven", login dinormalisasi (lowercase email), hero landing disederhanakan tanpa ilustrasi eksternal, dan katalog statis diperbarui agar gambar konsisten.

2. Pemetaan Kebutuhan ke Implementasi

- A.1 Registrasi customer + hashing → `/auth/register`, bcrypt hash, role default CUSTOMER.
- A.2 Login + JWT (access/refresh) → `/auth/login`, `/auth/refresh`, rotasi refresh token di DB.
- A.3 RBAC & proteksi endpoint → `JwtAuthGuard` + `RolesGuard`, guard seller/customer.
- B.1 CRUD produk seller → Endpoint `/products` POST/PATCH/DELETE, `/products/:id`, `/products/seller/me`.
- B.2 Upload multi-image lokal → Multer disk storage, validasi MIME/ukuran, simpan ke `uploads/products`.
- B.3 Manajemen stok → `/products/:id/stock` ubah stok & auto nonaktif saat stok 0.
- C.1 Browse katalog + pagination → `/products` dengan meta pagination, fallback gambar.
- C.2 Search & filter → Query `search`, `category`, `minPrice`, `maxPrice`.
- C.3 Cart frontend → `CartContext` (sessionStorage), tambah/hapus/ubah qty.
- C.4 Checkout & kurangi stok → `/orders` POST, kurangi stok, simpan alamat kirim.
- C.5 Order history customer → `/orders/me` GET (token customer).
- D.1 Seller lihat pesanan → `/orders/seller` GET.
- D.2 Seller ubah status order → `/orders/:id/status` PATCH.
- E.1 Email konfirmasi order → `EmailService.sendOrderConfirmation`.
- E.2 Email notifikasi seller → `EmailService.sendSellerNotification`.
- 2.3 E2E alur wajib → `backend/test/app.e2e-spec.ts` (register→login→CRUD→checkout→status).
- UI Natural green tone → Landing, katalog, dashboard memakai palet hijau & cream.

 3. Implementasi Backend

- Autentikasi & RBAC: `AuthService` normalisasi email, hash password, rotasi refresh token. Guard JWT dan Roles memastikan seller/customer hanya mengakses endpoint sesuai peran.
- Skema Data: Prisma mendefinisikan `User`, `Product`, `ProductImage`, `Order`, `OrderItem` dengan enum `Role` dan `OrderStatus` sesuai domain e-commerce teh.
- Produk & Upload: `ProductsService` mendukung multi image melalui Multer, pembaruan deskripsi/harga, penghapusan, serta filter/pagination untuk katalog publik.
- Order Flow: Checkout membuat `Order` + `OrderItem`, mengurangi stok, memicu email konfirmasi dan notifikasi seller, serta menyimpan riwayat untuk kedua peran.
- Email: `EmailService` menggunakan transporter NodeMailer (env `.env.example`), dan dimock saat e2e.
- Error Handling: Handler Prisma memetakan P20xx ke HTTP, sehingga frontend menerima 400/404/409 yang konsisten.
- Detail endpoint penting:
	- `/auth/` mencakup register, login, refresh, logout, profile; semua DTO telah divalidasi menggunakan class-validator.
	- `/products` (GET) mendukung kombinasi parameter `search`, `category`, `minPrice`, `maxPrice`, `page`, `limit`, `sort` untuk memenuhi kebutuhan browsing customer.
	- `/products/:id/stock` dan `/products/:id/status` memastikan seller dapat melakukan penyesuaian inventori tanpa harus update keseluruhan produk.
	- `/orders` (POST) men-trigger transaksi stok dan memanggil `EmailService`; `/orders/me` dan `/orders/seller` menyajikan pagination, filter status, dan total amount.
- Pertimbangan keamanan:
	- Hash refresh token disimpan menggunakan bcrypt dengan salt 10.
	- Guard seller memastikan request multipart tidak diproses oleh customer, sehingga mengurangi potensi abuse upload.
	- Validasi MIME & ukuran menolak file bukan gambar dan file terlalu besar (>5 MB).

- Pengelolaan file:
	- Folder `uploads/products` dibuat per test untuk memudahkan pembersihan.
	- Nama file mengikuti pola timestamp + random untuk menghindari collision.
	- Endpoint `GET /uploads/` dilayani secara statis melalui NestJS untuk akses gambar di frontend.

 4. Implementasi Frontend

- State Auth: `AuthContext` menyimpan token di `sessionStorage` (per tab), menyediakan login/register/logout dan interceptor Axios dengan refresh otomatis.
- Katalog Customer: Halaman `customer/index.tsx` menampilkan hero kebun teh, kombinasi katalog statis + API, serta tombol “Add to cart”.
- Cart & Checkout: `CartContext` mengelola item, kuantitas, subtotal; checkout memanggil API dan menampilkan notifikasi.
- Dashboard Seller: `seller/products/index.tsx` menampilkan produk milik seller, daftar pesanan dengan aksi ubah status.
- UI Konsisten: Landing page, header, tombol aksi mematuhi palet natural green; hero landing telah disederhanakan tanpa ilustrasi eksternal sesuai revisi.
- Protected Route: Komponen `ProtectedRoute` memastikan halaman sensitif menunggu autentikasi sebelum render.
- Komponen utama:
	- `ProtectedRoute` dan `AuthContext` tersambung untuk redirect otomatis (customer → `/customer`, seller → `/seller/products`).
	- `ProductsContext` memuat katalog dengan fallback pada hero images dan deduplikasi ID.
	- `CartSummary`, `CartItem`, dan komponen form checkout memvalidasi stok sebelum menembak API.
	- Halaman landing memanfaatkan `next/head` untuk memuat font Playfair/Inter dan mengonfigurasi CTA sesuai perubahan terakhir (tanpa button "Explore").
- Perubahan UI penting:
	- Navigasi atas menampilkan nama pengguna dan tombol logout setelah login.
	- Hero customer diganti ke foto kebun teh real (dua URL Unsplash) agar konsisten dengan brand.
	- Katalog static cards diperbarui berulang untuk memastikan gambar minuman selalu valid, termasuk permintaan khusus menduplikasi gambar "Emerald Green" untuk "Oolong Tea".
- Aksesibilitas & responsif:
	- Button menggunakan contrast ratio memadai.
	- Grid katalog adaptif ke 1 kolom pada .
	- Semua gambar menggunakan `next/image` dengan `fill` dan `alt` deskriptif.

5. Pengujian & Kualitas

- E2E: `pnpm test:e2e` menjalankan `backend/test/app.e2e-spec.ts` menggunakan Prismock + Supertest. Skenario mencakup register → login → refresh → guard 401/403 → CRUD produk (upload, validasi MIME) → filter katalog → checkout → email → update status.
- Unit Backend: Saat ini hanya test bawaan `AppService`. Target coverage ≥70% belum tercapai (⚠) dan direkomendasikan menambah test service Auth/Products/Orders.
- Frontend Manual: Skenario login, katalog, cart, checkout, dan pengelolaan pesanan diuji manual selama pengembangan. Belum ada test otomatis (Cypress/Playwright) → masukan untuk tindak lanjut.
- Lint & Build: ESLint + TypeScript disiapkan pada kedua sisi; jalankan via `pnpm lint` bila diperlukan.
- Ringkasan hasil e2e:
	- 11 scenario utama, termasuk validasi 401 (tanpa token), 403 (role tidak sah), upload file non-image (400), filter kombinasi multi parameter, checkout memicu email, serta perubahan status order.
	- Prismock menjaga isolasi database dan memudahkan reset antar test. Direktori `uploads/` dibersihkan tiap test untuk menghindari flaky state.
	- Email service dimock sehingga test fokus pada side effect (pemanggilan method) tanpa membutuhkan SMTP nyata.
- Monitoring kualitas manual:
	- Selama iterasi terakhir, dilakukan smoke test manual pada dua browser (Chrome, Edge) untuk memastikan perubahan gambar tidak mematahkan layout.
	- Ditemukan peringatan Next.js terkait penggunaan stylesheet di `<Head>`; dicatat untuk refactor ke `_document.tsx` pada tahap berikutnya.

 6. Catatan Lingkungan

- Backend: Jalankan dengan `pnpm start:dev`. Env penting: `DATABASE_URL` (SQLite default), `JWT_SECRET`, kredensial email (`EMAIL_HOST`, dsb.), serta opsi S3 jika ingin memakai presigned URL.
- Frontend: `pnpm dev` (port 3001). `NEXT_PUBLIC_API_URL` default `http://localhost:3000`. Konfigurasi Next image membatasi host ke Unsplash untuk kestabilan gambar produk.
- Storage: Upload produk memakai disk lokal (`uploads/products`). Untuk produksi disarankan migrasi ke object storage; modul S3 sudah tersedia sebagai opsi.
- Tooling tambahan:
	- Husky/lint-staged belum diaktifkan; jika dibutuhkan, dapat ditambahkan untuk mencegah commit tanpa lint.
	- `.env.example` diperbarui dengan variabel email + JWT + port sehingga onboarding developer baru lebih cepat.
	- `pnpm-lock.yaml` memastikan konsistensi dependensi lintas lingkungan Windows/macOS.

