# Panduan Setup Database Supabase — Aquastock Pro

Dokumen ini berisi SQL bootstrap lama dan panduan migrasi untuk basis data **Aquastock Pro**. Skema berkembang terus: file SQL di `supabase/migrations/` adalah perubahan berurutan yang harus diterapkan setelah bootstrap pada instalasi baru. Jangan menjalankan hanya blok bootstrap lalu menganggap schema produksi sudah lengkap.

---

## Langkah Setup Cepat

1. Buat proyek Supabase terpisah untuk staging/pengembangan; jangan uji setup atau restore langsung di produksi.
2. Untuk instalasi baru, terapkan bootstrap SQL di bawah pada database kosong.
3. Terapkan seluruh file `supabase/migrations/*.sql` sesuai urutan nama/tanggal. Bila menggunakan Supabase CLI, tautkan project yang benar dan gunakan `supabase db push`; tinjau terlebih dahulu migrasi pending dan hasilnya.
4. Untuk project yang sudah berjalan, jalankan hanya migrasi yang belum diterapkan sesuai riwayat database; jangan mengulang bootstrap secara buta.
5. Konfigurasikan bucket Storage, Auth, RLS, dan kredensial sesuai checklist deployment. Jangan nonaktifkan konfirmasi email di produksi.

## Matriks Hak Akses

| Modul | OWNER | STAFF | VIEWER |
|---|---|---|---|
| Dashboard | Penuh | Penuh | Baca saja |
| Master Barang, Barang Masuk/Keluar, POS | Penuh | Buat, baca, ubah | Tidak ada akses |
| Purchase Order dan Retur | Penuh | Buat, baca, ubah | Baca saja |
| Supplier, Customer, Kas, Hutang/Piutang | Penuh | Buat, baca, ubah | Tidak ada akses |
| Laporan | Penuh | Tidak ada akses | Tidak ada akses |
| Manajemen Pengguna, Audit Log, Backup, Pengaturan | Penuh | Baca saja | Tidak ada akses |

Perubahan hak akses diberlakukan oleh `20261103_z_rbac_matrix.sql` pada RLS/RPC dan oleh route guard/UI. Terapkan migrasi setelah migrasi keamanan `20261103_security_hardening.sql`.

Saldo akibat barang masuk/keluar berubah melalui trigger database; frontend tidak melakukan fallback update stok. Penyesuaian stok fisik dicatat terpisah pada `stock_adjustments` dan diproses atomik melalui `perform_stock_opname`, sehingga tidak muncul sebagai penjualan/barang keluar. Terapkan migrasi `20261029_stock_adjustment_ledger.sql` setelah `20261028_inventory_single_stock_trigger.sql`, lalu `20261103_stock_opname_owner_only.sql`. Riwayat dan koreksi stok fisik hanya dapat diakses OWNER; pembatasan ditegakkan oleh UI, RLS, RPC, dan hak kolom database. INSERT produk baru memakai default stok database 0; perubahan stok berikutnya harus melalui transaksi atau RPC Stock Opname.

Pastikan migrasi inventori dan sinkronisasi skema transaksi telah diterapkan berurutan, termasuk `20261028_inventory_single_stock_trigger.sql`, lalu verifikasi trigger `trg_transaction_stock_update` ada dan enabled sebelum mencatat transaksi. Migrasi trigger tersebut aman dijalankan ulang, membersihkan trigger stok lama `trg_transactions_auto_stock`/fungsi stok legacy, dan tidak mengubah saldo yang telah tercatat.

Fitur edit harga online massal membutuhkan migrasi `20261103_product_online_price.sql`. Migrasi ini menambahkan `products.online_sell_price` dan mengisi harga online produk yang sudah ada menjadi harga beli +25%; persentase markup online selanjutnya diturunkan dari harga jual online dan harga beli.

Sinkronisasi ikon dan tautan marketplace lintas perangkat membutuhkan migrasi `20261028_product_channel_link.sql`, yang menambahkan `products.channel` dan `products.channel_link`. Jika data channel lama hanya tersimpan di browser, buka Master Barang sekali pada perangkat tempat data tersebut dibuat setelah kolom tersedia agar aplikasi dapat memindahkannya ke Supabase.

---

## Skrip Bootstrap SQL Awal

> **Cakupan backup aplikasi:** JSON export/import pada menu Backup adalah upsert subset tabel aplikasi; bukan backup lengkap PostgreSQL/Supabase, tidak menyertakan akun Auth, dan tidak menghapus data target yang tidak ada di file. Proses beberapa tabel tidak atomik. Gunakan backup provider/PITR dan ikuti recovery drill staging di [deployment.md](deployment.md) sebelum mengandalkannya untuk disaster recovery.

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Aquastock Pro — Master Database Setup Script
-- Target Database: PostgreSQL 15+ (Supabase)
-- ═══════════════════════════════════════════════════════════════════

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════
-- 2. TABEL-TABEL UTAMA (8 TABEL)
-- ═══════════════════════════════════════════════════════════════════

-- 2.1 Profiles (Terikat ke auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Pengguna',
  role text not null check (role in ('OWNER', 'STAFF', 'VIEWER')) default 'VIEWER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.2 Kategori Produk
create table if not exists public.categories (
  id serial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 2.2a Satuan Stok Produk
create table if not exists public.units (
  id serial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create unique index if not exists units_name_case_insensitive_unique_idx
  on public.units (lower(name));

insert into public.units (name) values ('pcs')
on conflict do nothing;

-- 2.3 Master Data Supplier
create table if not exists public.suppliers (
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

-- 2.4 Master Data Customer
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.5 Master Produk (Katalog Inventaris)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text,
  name text not null,
  brand text default '-',
  category_id integer references public.categories(id) on delete set null,
  unit_id integer not null default 1 references public.units(id) on delete restrict,
  stock integer not null default 0,
  min_stock integer not null default 5,
  cost_price numeric(15, 2) not null default 0,
  sell_price numeric(15, 2) not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_barcode_unique_idx
  on public.products (barcode)
  where barcode is not null and barcode <> '';

-- 2.6 Transaksi Barang Masuk & Keluar
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in', 'out')),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(15, 2) not null default 0,
  total_price numeric(15, 2) not null default 0,
  reference_no text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null default 'Offline',
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 2.7 Notifikasi Sistem
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null check (type in ('warning', 'info', 'success', 'danger')) default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. FUNCTIONS & STORED PROCEDURES (KEAMANAN & LOGIKA BISNIS)
-- ═══════════════════════════════════════════════════════════════════

-- 3.1 Fungsi Pemeriksa Hak Akses Owner (Security Definer)
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'OWNER'
  );
$$;

-- 3.2 Trigger Otomatis Pembuat Profil saat User Mendaftar di Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count integer;
  assigned_role text;
begin
  select count(*) into user_count from public.profiles;
  -- Pengguna pertama yang terdaftar otomatis menjadi OWNER, lainnya VIEWER
  if user_count = 0 then
    assigned_role := 'OWNER';
  else
    assigned_role := 'VIEWER';
  end if;

  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.3 Trigger Penyesuaian Saldo Stok Otomatis saat Transaksi Terjadi
create or replace function public.handle_transaction_stock_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  if TG_OP = 'INSERT' then
    if new.type = 'in' then
      update public.products
      set stock = stock + new.quantity,
          updated_at = now()
      where id = new.product_id;
    else
      update public.products
      set stock = stock - new.quantity,
          updated_at = now()
      where id = new.product_id
        and stock >= new.quantity;
      get diagnostics updated_rows = row_count;
      if updated_rows = 0 then
        raise exception 'Stok tidak mencukupi untuk transaksi keluar'
          using errcode = '23514';
      end if;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.type = 'in' then
      update public.products
      set stock = stock - old.quantity,
          updated_at = now()
      where id = old.product_id
        and stock >= old.quantity;
      get diagnostics updated_rows = row_count;
      if updated_rows = 0 then
        raise exception 'Transaksi masuk tidak dapat dibatalkan karena stok sudah terpakai'
          using errcode = '23514';
      end if;
    else
      update public.products
      set stock = stock + old.quantity,
          updated_at = now()
      where id = old.product_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_transaction_stock_update on public.transactions;
create trigger trg_transaction_stock_update
  after insert or delete on public.transactions
  for each row execute function public.handle_transaction_stock_update();

-- 3.4 RPC: get_auth_users (Daftar Pengguna Sistem untuk Owner & Staff)
create or replace function public.get_auth_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and upper(role) in ('OWNER', 'STAFF')
  ) then
    raise exception 'Akses ditolak: Hanya Owner atau Staff yang berhak melihat daftar pengguna.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(to_jsonb(p)->>'full_name', to_jsonb(p)->>'name', split_part(u.email, '@', 1))::text as full_name,
    coalesce(p.role, 'VIEWER')::text as role,
    u.last_sign_in_at,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

-- 3.5 RPC: update_user_role (Ubah Role Pengguna)
create or replace function public.update_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_count integer;
  normalized_role text := upper(trim(new_role));
begin
  if not public.is_owner() then
    raise exception 'Akses ditolak: Hanya Owner yang berhak memperbarui role pengguna.';
  end if;

  if normalized_role is null or normalized_role not in ('OWNER', 'STAFF', 'VIEWER') then
    raise exception 'Nilai role tidak valid. Pilihan: OWNER, STAFF, VIEWER.';
  end if;

  -- Lindungi agar tidak terjadi ketiadaan Owner dalam sistem
  if auth.uid() = target_user_id and normalized_role != 'OWNER' then
    select count(*) into owner_count from public.profiles where upper(role) = 'OWNER';
    if owner_count <= 1 then
      raise exception 'Tidak dapat menurunkan role: Sistem harus memiliki minimal satu Owner aktif.';
    end if;
  end if;

  update public.profiles
  set role = normalized_role,
      updated_at = now()
  where id = target_user_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS) & POLICIES
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;

-- 4.1 Profiles
create policy "profiles_select_auth" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_owner_only" on public.profiles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 4.2 Categories
create policy "categories_select_auth" on public.categories
  for select to authenticated using (true);

create policy "categories_modify_owner" on public.categories
  for all to authenticated using (public.is_owner());

-- 4.2a Units
alter table public.units enable row level security;

create policy "units_select_auth" on public.units
  for select to authenticated using (true);

create policy "units_modify_owner" on public.units
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- 4.3 Products
create policy "products_select_auth" on public.products
  for select to authenticated using (true);

create policy "products_insert_update_auth" on public.products
  for insert to authenticated with check (true);

create policy "products_update_auth" on public.products
  for update to authenticated using (true);

create policy "products_delete_owner" on public.products
  for delete to authenticated using (public.is_owner());

-- 4.4 Suppliers & Customers
create policy "suppliers_all_auth" on public.suppliers
  for all to authenticated using (true);

create policy "customers_all_auth" on public.customers
  for all to authenticated using (true);

-- 4.5 Transactions
create policy "transactions_select_auth" on public.transactions
  for select to authenticated using (true);

create policy "transactions_insert_auth" on public.transactions
  for insert to authenticated with check (true);

create policy "transactions_delete_owner" on public.transactions
  for delete to authenticated using (public.is_owner());

-- 4.6 Notifications
create policy "notifications_all_auth" on public.notifications
  for all to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════════
-- 5. STORAGE BUCKET CONFIGURATION & POLICIES
-- ═══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "storage_public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "storage_auth_insert_product_images" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

create policy "storage_auth_update_product_images" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

create policy "storage_auth_delete_product_images" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ═══════════════════════════════════════════════════════════════════
-- 6. DATA AWAL (SEED DATA UNTUK TOKO JAQURIS)
-- ═══════════════════════════════════════════════════════════════════

-- 6.1 Kategori Baku
insert into public.categories (id, name) values
  (1, 'Filter'),
  (2, 'Lampu LED'),
  (3, 'Aerator'),
  (4, 'Substrat & Pasir'),
  (5, 'Hardscape (Batu & Kayu)'),
  (6, 'Pakan Ikan'),
  (7, 'Obat & Vitamin'),
  (8, 'Aksesoris & Selang')
on conflict (name) do nothing;

-- 6.2 Contoh Supplier Awal
insert into public.suppliers (name, contact_name, phone, email, address, is_active) values
  ('CV Aquazonic Indonesia', 'Bpk. Hendra', '0812-3456-7890', 'hendra@aquazonic.id', 'Komp. Pergudangan Daan Mogot, Jakarta Barat', true),
  ('PT Sinar Bahari Bekasi', 'Ibu Ratna', '0813-9876-5432', 'sales@sinarbahari.co.id', 'Jl. Sultan Agung No. 45, Medan Satria, Bekasi', true),
  ('Toko Substrat Alam Sentosa', 'Bpk. Budi', '0857-1122-3344', 'budi@substrat.id', 'Jl. Raya Bogor KM 28, Cimanggis, Depok', true)
on conflict do nothing;

-- 6.3 Contoh Customer Awal
insert into public.customers (name, phone, email, address, notes) values
  ('Toko Ikan Hias Pondok Gede', '0812-9988-7766', 'pondokgede@ikan.local', 'Jl. Raya Jatiwaringin No. 12, Bekasi', 'Pelanggan reseller rutin'),
  ('Aquascape Bekasi Timur', '0856-4433-2211', 'timur.aqua@gmail.com', 'Ruko Blue Oasis No. 8, Bekasi Timur', 'Pembayaran termin 14 hari'),
  ('Bpk. Andi Wijaya (Retail)', '0878-1234-5678', 'andi.w@gmail.com', 'Perum Jatimakmur Indah Blok B3, Bekasi', 'Konsumen langsung')
on conflict do nothing;

-- 6.4 Contoh Produk Awal
insert into public.products (sku, name, brand, category_id, stock, min_stock, cost_price, sell_price) values
  ('FLTR-501', 'Filter Hang-on 501 Slim', 'Aquazonic', 1, 18, 5, 65000, 85000),
  ('LAMP-60W', 'Lampu LED Aquascape Pro 60cm WRGB', 'Chihiros Replica', 2, 12, 4, 320000, 450000),
  ('AER-ACDC', 'Pompa Udara Baterai AC/DC 2 Lubang', 'Recent', 3, 9, 3, 95000, 135000),
  ('SUB-SIL1', 'Pasir Silika Hitam Halus 1kg', 'Local', 4, 54, 10, 7500, 12000),
  ('SEI-RYU1', 'Batu Seiryu Stone Pilihan per Kg', 'Import', 5, 25, 5, 22000, 35000),
  ('PAKN-FLK', 'Pakan Ikan Tropis Flake Premium 100g', 'Tetra', 6, 30, 8, 38000, 52000),
  ('OBAT-BLU', 'Obat Biru / Methylene Blue 100ml', 'Rid-All', 7, 24, 6, 8500, 15000)
on conflict (sku) do nothing;
```
