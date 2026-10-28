# Kontrak API Frontend & Backend — Aquastock Pro

Dokumen ini mendefinisikan kontrak antarmuka komunikasi antara frontend (Vanilla JS) dan backend Supabase (PostgreSQL, Auth, Storage, & RPC) untuk sistem **Aquastock Pro** (Toko "Jaquris — Jatimakmur Aquarium Aksesoris, Bekasi").

---

## 1. Response Envelope Standar

Modul akses data di `public/assets/js/api/*.js` umumnya membungkus respons ke dalam format envelope JSON untuk menyederhanakan penanganan status di antarmuka pengguna. Detail tiap operasi tetap mengikuti implementasi modul dan dapat berbeda untuk helper khusus:

```typescript
interface ApiResponse<T = any> {
  ok: boolean;               // true jika operasi berhasil, false jika terjadi kegagalan
  data: T | null;            // Payload data yang diminta saat operasi sukses
  error: ApiError | null;    // Objek detail error saat terjadi kegagalan
  meta: ApiMeta;             // Metadata operasional (timestamp, sumber, paginasi)
}

interface ApiError {
  code: string;              // Kode error terprogram (machine-readable)
  message: string;           // Pesan ramah pengguna (human-readable)
  details?: any;             // Rincian validasi input, trace teknis, atau error Supabase
}

interface ApiMeta {
  timestamp: string;         // ISO 8601 string waktu respons dihasilkan
  source?: 'supabase' | 'mock' | 'network';
  total?: number;            // Total keseluruhan baris data (untuk paginasi)
  page?: number;
  limit?: number;
  [key: string]: any;
}
```

### Contoh Respons Sukses
```json
{
  "ok": true,
  "data": [
    {
      "id": "e4b6c31a-6379-4ff8-912f-7c15e8c1b920",
      "sku": "FLTR-501",
      "name": "Filter Hang-on 501",
      "brand": "Aquazonic",
      "category": "Filter",
      "category_id": 1,
      "stock": 18,
      "min_stock": 5,
      "cost_price": 65000,
      "sell_price": 85000,
      "image_url": "https://xyz.supabase.co/storage/v1/object/public/product-images/prod-123.webp",
      "created_at": "2026-10-12T04:00:00.000Z"
    }
  ],
  "error": null,
  "meta": {
    "timestamp": "2026-10-13T01:00:00.000Z",
    "source": "supabase",
    "total": 1
  }
}
```

### Contoh Respons Error
```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "FOREIGN_KEY_VIOLATION",
    "message": "Produk tidak dapat dihapus karena masih terikat dengan riwayat transaksi",
    "details": {
      "table": "transactions",
      "constraint": "transactions_product_id_fkey"
    }
  },
  "meta": {
    "timestamp": "2026-10-13T01:00:00.000Z",
    "source": "supabase"
  }
}
```

---

## 2. Katalog Endpoint Nyata (Supabase Real API)

Panggilan backend dilakukan langsung melalui SDK `@supabase/supabase-js` atau via Supabase REST API dengan header otentikasi `apikey: ANON_KEY` dan `Authorization: Bearer USER_JWT`.

### 2.1 Supabase Auth API
| Endpoint | Method | Fungsi & Payload | Akses |
|---|---|---|---|
| `/auth/v1/signup` | `POST` | Registrasi user baru: `{ email, password, data: { name } }` | Public |
| `/auth/v1/token?grant_type=password` | `POST` | Otentikasi login: `{ email, password }` | Public |
| `/auth/v1/logout` | `POST` | Mengakhiri sesi pengguna & mencabut token JWT | Authenticated |
| `/auth/v1/user` | `GET` | Memperoleh data profil user dan role saat ini | Authenticated |

### 2.2 Master Produk (`products`)
Diakses via `Api.items.*`:
- `GET /rest/v1/products?select=*,categories(name)&order=created_at.desc`: Mengambil semua produk dengan relasi nama kategori.
- `GET /rest/v1/products?id=eq.{id}&select=*`: Mengambil detail spesifik satu produk.
- `POST /rest/v1/products`: Menambah produk baru.
- `PATCH /rest/v1/products?id=eq.{id}`: Memperbarui data produk / harga / stok.
- `DELETE /rest/v1/products?id=eq.{id}`: Menghapus produk (ditolak jika memiliki transaksi terikat).

### 2.3 Transaksi Inventaris (`transactions`)
Diakses via `Api.transactions.*`:
- `GET /rest/v1/transactions?type=eq.in&select=*,products(name,sku),suppliers(name)`: Riwayat barang masuk.
- `GET /rest/v1/transactions?type=eq.out&select=*,products(name,sku),customers(name)`: Riwayat barang keluar / penjualan.
- `POST /rest/v1/transactions`: Mencatat transaksi baru.  
  *(Secara otomatis memicu database trigger untuk menambah/mengurangi kolom `stock` di tabel `products`)*.
- `DELETE /rest/v1/transactions?id=eq.{id}`: Menghapus data transaksi.

### 2.4 Master Relasi (`suppliers` & `customers`)
Diakses via `Api.suppliers.*` dan `Api.customers.*`:
- `GET /rest/v1/suppliers?select=*&order=name.asc`: Daftar supplier aktif.
- `POST /rest/v1/suppliers`: Menambah rekanan supplier baru.
- `PATCH /rest/v1/suppliers?id=eq.{id}`: Mengubah kontak / alamat supplier.
- `DELETE /rest/v1/suppliers?id=eq.{id}`: Menghapus data supplier.
- `GET /rest/v1/customers?select=*&order=name.asc`: Daftar pelanggan.
- `POST /rest/v1/customers`: Menambah data pelanggan baru.
- `PATCH /rest/v1/customers?id=eq.{id}`: Mengubah kontak / alamat pelanggan.
- `DELETE /rest/v1/customers?id=eq.{id}`: Menghapus data pelanggan.

### 2.5 Storage Object API (`product-images`)
Diakses via `Api.items.uploadImage`:
- `POST /storage/v1/object/product-images/{filename.webp}`: Mengunggah gambar produk WebP terkompresi.
- `GET /storage/v1/object/public/product-images/{filename.webp}`: Membaca publik URL gambar untuk ditampilkan pada tabel & kartu produk.
- `DELETE /storage/v1/object/product-images/{filename.webp}`: Menghapus file foto saat produk dihapus atau diganti.

### 2.6 Remote Procedure Calls (RPC)
Diakses via `Api.users.*`, `Api.po.*`, dan `Api.returns.*`:
- `POST /rest/v1/rpc/get_auth_users`:  
  Mengembalikan daftar seluruh pengguna terdaftar dari `auth.users` digabungkan dengan `public.profiles`.  
  *Otorisasi*: **Hanya Owner** (dicek via fungsi `is_owner()`).
- `POST /rest/v1/rpc/update_user_role`:  
  Menerima payload `{ target_user_id: string, new_role: 'OWNER' | 'STAFF' | 'VIEWER' }`.  
  *Otorisasi*: **Hanya Owner**. Dilindungi proteksi anti-demote diri sendiri dan validasi role yang sah.
- `POST /rest/v1/rpc/create_purchase_order_atomic`:
  Menerima payload `{ p_po: object, p_items: array }` untuk membuat header PO dan rincian item dalam 1 transaksi database atomik. Mencegah status parsial (*orphaned PO header*).
  *Otorisasi*: Authenticated staff / owner.
- `POST /rest/v1/rpc/receive_purchase_order`:
  Menerima payload `{ p_po_id: uuid }`. Memvalidasi status PO harus `'dikirim'`, mengubah status menjadi `'diterima'`, dan secara atomik mencatat mutasi barang masuk (`transactions` type `'in'` dengan referensi `po_id`) yang otomatis memicu penambahan stok produk. Dilengkapi unique constraint partial idempotency (`uq_transactions_po_product`) untuk mencegah penerimaan ganda.
  *Otorisasi*: Authenticated staff / owner.
- `POST /rest/v1/rpc/complete_return`:
  Menerima payload `{ p_return_id: uuid }`. Memvalidasi status retur harus `'proses'`, mengubah status menjadi `'selesai'`, dan mencatat mutasi `transactions` (`'out'` untuk retur `ke_supplier`, `'in'` untuk retur `dari_customer`) secara atomik. Dilindungi index `uq_transactions_return` agar tidak terjadi duplikasi mutasi.
  *Otorisasi*: Authenticated staff / owner.
- `POST /rest/v1/rpc/generate_draft_po_from_low_stock`:
  Memindai semua produk dengan `stock <= min_stock` yang belum ada dalam PO terbuka (`draft` / `dikirim`). Mengelompokkan item berdasarkan `supplier_id` produk (atau supplier fallback) dan membuat Purchase Order berstatus `draft` dengan kuantitas restock optimal `(min_stock * 2) - stock`.
  *Otorisasi*: Authenticated staff / owner.

---

## 3. Database Schema (11 Tabel PostgreSQL)

### 3.1 `profiles`
Menyimpan atribut pengguna aplikasi yang terhubung ke Supabase Auth.
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('OWNER', 'STAFF', 'VIEWER')) default 'VIEWER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.2 `categories`
Kategori klasifikasi aksesoris aquarium (Filter, Lampu, Aerator, Pakan, Substrat, Hardscape, dll.).
```sql
create table public.categories (
  id serial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);
```

### 3.3 `suppliers`
Data mitra pemasok barang inventaris Jaquris.
```sql
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.4 `customers`
Data pembeli, pelanggan grosir, dan reseller.
```sql
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.5 `products`
Katalog induk inventaris barang dagangan.
```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text,
  name text not null,
  brand text default '-',
  category_id integer references public.categories(id) on delete set null,
  stock integer not null default 0,
  min_stock integer not null default 5,
  cost_price numeric(15, 2) not null default 0,
  sell_price numeric(15, 2) not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.6 `transactions`
Catatan mutasi stok barang masuk (pembelian/restock/retur customer) dan barang keluar (penjualan/retur supplier).
```sql
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in', 'out')),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(15, 2) not null default 0,
  total_price numeric(15, 2) not null default 0,
  reference_no text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  return_id uuid references public.returns(id) on delete set null,
  channel text not null default 'Offline',
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### 3.7 `purchase_orders`
Surat Pemesanan Barang (PO) ke mitra supplier.
```sql
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  status text not null check (status in ('draft', 'dikirim', 'diterima', 'dibatalkan')) default 'draft',
  order_date date not null default current_date,
  expected_delivery date,
  received_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.8 `purchase_order_items`
Rincian kuantitas dan harga satuan barang yang dipesan pada Purchase Order.
```sql
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(15, 2) not null default 0,
  received_quantity integer not null default 0 check (received_quantity >= 0),
  created_at timestamptz not null default now()
);
```

### 3.9 `returns`
Pengelolaan pengembalian barang (retur ke supplier atau retur dari customer).
```sql
create table public.returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  type text not null check (type in ('ke_supplier', 'dari_customer')),
  product_id uuid not null references public.products(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  quantity integer not null check (quantity > 0),
  harga_satuan numeric(15, 2) not null default 0 check (harga_satuan >= 0),
  alasan text not null,
  status text not null check (status in ('draft', 'proses', 'selesai', 'ditolak')) default 'draft',
  snapshot_product_name text,
  snapshot_entity_name text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.10 `notifications`
Pemberitahuan peringatan stok kritis dan aktivitas transaksi sistem.
```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null check (type in ('warning', 'info', 'success', 'danger')) default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
```

### 3.11 `audit_logs`
Catatan jejak audit sistem yang terproteksi (append-only via internal RPC / trigger tepercaya).
```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  table_name text not null,
  record_id text,
  user_id uuid references auth.users(id) on delete set null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

---

## 4. Kebijakan Keamanan Tingkat Baris (RLS Policies)

Seluruh tabel mengaktifkan `alter table ... enable row level security;`.

| Tabel | Operasi | Role Target | Ekspresi Evaluasi (USING / WITH CHECK) |
|---|---|---|---|
| `profiles` | SELECT | authenticated | `true` (Semua user dapat melihat daftar nama & role) |
| `profiles` | UPDATE | authenticated | `public.is_owner()` OR `auth.uid() = id` (User hanya edit diri sendiri, Owner dapat ubah semua) |
| `categories` | SELECT | authenticated | `true` |
| `categories` | INSERT/UPDATE/DELETE | authenticated | `public.is_owner()` |
| `products` | SELECT | authenticated | `true` |
| `products` | INSERT/UPDATE | authenticated | `auth.role() = 'authenticated'` |
| `products` | DELETE | authenticated | `public.is_owner()` |
| `suppliers` | SELECT | authenticated | `true` |
| `suppliers` | ALL | authenticated | `auth.role() = 'authenticated'` |
| `customers` | SELECT | authenticated | `true` |
| `customers` | ALL | authenticated | `auth.role() = 'authenticated'` |
| `transactions`| SELECT/INSERT | authenticated | `true` (Semua staff dapat mencatat transaksi) |
| `transactions`| DELETE | authenticated | `public.is_owner()` (Hanya owner dapat membatalkan mutasi transaksi) |
| `purchase_orders` | SELECT/INSERT/UPDATE | authenticated | `true` |
| `purchase_orders` | DELETE | authenticated | `public.is_owner()` |
| `purchase_order_items` | SELECT/INSERT/UPDATE | authenticated | `true` |
| `purchase_order_items` | DELETE | authenticated | `public.is_owner()` |
| `returns` | SELECT/INSERT/UPDATE | authenticated | `true` |
| `returns` | DELETE | authenticated | `public.is_owner()` |
| `notifications`| SELECT/UPDATE | authenticated | `true` |
| `audit_logs` | SELECT | authenticated | `public.is_owner()` |
| `audit_logs` | INSERT/UPDATE/DELETE | authenticated | Disallow direct client mutations; hanya via `log_audit_event()` security definer |

> Skrip DDL lengkap, fungsi trigger stok otomatis, dan implementasi RPC tersedia di [setup-database.md](setup-database.md) dan folder `supabase/migrations/`.
