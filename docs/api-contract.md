# Kontrak API Frontend & Backend — aQuaStock Pro

Dokumen ini mendefinisikan kontrak antarmuka komunikasi antara frontend (Vanilla JS) dan backend Supabase (PostgreSQL, Auth, Storage, & RPC) untuk sistem **aQuaStock Pro** (Toko "Jaquris — Jatimakmur Aquarium Aksesoris, Bekasi").

---

## 1. Response Envelope Standar

Seluruh fungsi pada wrapper `api.js` membungkus hasil pemanggilan ke dalam format envelope JSON seragam untuk menyederhanakan penanganan status di antarmuka pengguna:

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
Diakses via `Api.users.*`:
- `POST /rest/v1/rpc/get_auth_users`:  
  Mengembalikan daftar seluruh pengguna terdaftar dari `auth.users` digabungkan dengan `public.profiles`.  
  *Otorisasi*: **Hanya Owner** (dicek via fungsi `is_owner()`).
- `POST /rest/v1/rpc/update_user_role`:  
  Menerima payload `{ target_user_id: string, new_role: 'OWNER' | 'STAFF' | 'VIEWER' }`.  
  *Otorisasi*: **Hanya Owner**. Dilindungi proteksi anti-demote diri sendiri dan validasi role yang sah.

---

## 3. Database Schema (7 Tabel PostgreSQL)

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
Catatan mutasi stok barang masuk (pembelian/restock) dan barang keluar (penjualan).
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
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### 3.7 `notifications`
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
| `notifications`| SELECT/UPDATE | authenticated | `true` |

> Skrip DDL lengkap, fungsi trigger stok otomatis, dan implementasi RPC tersedia di [setup-database.md](setup-database.md).
