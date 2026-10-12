# Kontrak API Frontend & Backend — aQuaStock Pro

Dokumen ini mendefinisikan kontrak interface komunikasi standar antara frontend (Vanilla JS) dan backend (REST API) untuk sistem **aQuaStock Pro** (Toko "Jaquris — Jatimakmur Aquarium Aksesoris").

---

## 1. Filosofi & Format Respons Standar (Response Envelope)

Setiap endpoint API harus selalu mengembalikan format JSON standar dengan struktur envelope yang seragam:

```typescript
interface ApiResponse<T = any> {
  ok: boolean;               // true jika HTTP 2xx & operasi berhasil, false jika gagal
  data: T | null;            // payload data saat sukses, null saat error
  error: ApiError | null;    // objek error terstruktur saat gagal, null saat sukses
  meta?: ApiMeta;            // metadata opsional (pagination, timestamp, traceId)
}

interface ApiError {
  code: string;              // kode error terprogram (machine-readable)
  message: string;           // deskripsi error ramah pengguna (human-readable)
  details?: any;             // detail validasi form, field error, atau trace
}

interface ApiMeta {
  timestamp: string;         // ISO 8601 string
  page?: number;             // halaman aktif saat ini
  limit?: number;            // limit per halaman
  total?: number;            // total seluruh data
  [key: string]: any;
}
```

### Contoh Respons Sukses

```json
{
  "ok": true,
  "data": [
    {
      "id": "ITM-001",
      "name": "Filter Hang-on 501",
      "category": "Filter",
      "stock": 18,
      "minStock": 5,
      "unitPrice": 85000
    }
  ],
  "error": null,
  "meta": {
    "timestamp": "2026-10-12T12:00:00.000Z",
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

### Contoh Respons Error

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi input gagal",
    "details": {
      "stock": "Jumlah stok tidak boleh bernilai negatif"
    }
  },
  "meta": {
    "timestamp": "2026-10-12T12:00:00.000Z",
    "status": 422
  }
}
```

---

## 2. Standar Kode Error (Error Codes)

| Kode Error | HTTP Status | Penjelasan |
|---|---|---|
| `REQUEST_ABORTED` | 0 (Client) | Permintaan dibatalkan oleh user atau timeout via `AbortController`. |
| `NETWORK_ERROR` | 0 (Client) | Gagal terhubung ke server (offline atau server tidak aktif). |
| `BAD_REQUEST` | 400 | Format payload atau parameter URL tidak valid. |
| `UNAUTHORIZED` | 401 | Token autentikasi tidak valid atau sudah kedaluwarsa. |
| `FORBIDDEN` | 403 | User tidak memiliki izin untuk aksi terkait (mis. non-owner). |
| `NOT_FOUND` | 404 | Data yang dicari tidak ditemukan. |
| `VALIDATION_ERROR` | 422 | Validasi aturan bisnis gagal (mis. stok kurang, data duplikat). |
| `INTERNAL_SERVER_ERROR` | 500 | Kesalahan internal di server. |

---

## 3. Pembatalan Permintaan (AbortController Pattern)

Modul `api.js` mengintegrasikan `AbortController` secara native pada seluruh panggilan method API.

### Cara Penggunaan di Komponen/Halaman:

```javascript
// 1. Buat controller baru
const controller = Api.createAbortController();

// 2. Operkan sinyal pembatalan ke opsi panggilan API
Api.items.getAll({ search: 'filter' }, { signal: controller.signal })
  .then(res => {
    if (res.ok) {
      renderTable(res.data);
    } else if (res.error?.code === 'REQUEST_ABORTED') {
      console.log('Pencarian dibatalkan (debounced atau navigasi berpindah)');
    } else {
      showToast(res.error.message, 'error');
    }
  });

// 3. Batalkan request jika diperlukan (mis. user berpindah halaman atau mengetik input baru)
// controller.abort();
```

---

## 4. Katalog Endpoint & Modul Frontend (`Api.*`)

Semua endpoint berakar pada basis `/api`.

### 4.1 Autentikasi (`Api.auth`)
- `POST /api/auth/login`: `{ username, password }` → Mengembalikan token JWT dan profil pengguna.
- `POST /api/auth/logout`: Membersihkan session cookie / token.
- `GET /api/auth/me`: Mengembalikan data user yang sedang login.

### 4.2 Master Barang (`Api.items`)
- `GET /api/items`: Daftar barang (`?category=&search=&page=&limit=`).
- `GET /api/items/:id`: Detail barang spesifik.
- `POST /api/items`: Menambah barang baru.
- `PUT /api/items/:id`: Memperbarui data barang.
- `DELETE /api/items/:id`: Menghapus data barang.

### 4.3 Transaksi (`Api.transactions`)
- `GET /api/transactions/in`: Riwayat barang masuk.
- `POST /api/transactions/in`: Mencatat barang masuk baru.
- `GET /api/transactions/out`: Riwayat barang keluar.
- `POST /api/transactions/out`: Mencatat transaksi barang keluar / penjualan.

### 4.4 Purchase Order & Retur (`Api.po`, `Api.return`)
- `GET /api/po`, `POST /api/po`: Kelola PO pembelian ke supplier.
- `GET /api/return`, `POST /api/return`: Kelola retur barang rusak / komplain.

### 4.5 Master Relasi (`Api.suppliers`, `Api.customers`)
- `GET /api/suppliers`: Data supplier aquarium & aksesoris.
- `GET /api/customers`: Data pelanggan & reseller.

### 4.6 Keuangan (`Api.finance`)
- `GET /api/finance/cash`: Arus kas masuk dan keluar toko.
- `GET /api/finance/debt`: Rekapitulasi piutang customer & hutang supplier.

### 4.7 Laporan & Statistik (`Api.reports`)
- `GET /api/reports`: Data agregat penjualan, profit, chart series harian/bulanan.

### 4.8 Administrasi & Sistem (`Api.system`)
- `GET /api/system/users`: Manajemen pengguna & role (Owner, Staff, dll.).
- `GET /api/system/audit`: Audit log aktivitas transaksi & perubahan data.
- `GET /api/system/notifications`: Notifikasi stok menipis, PO jatuh tempo, dll.
- `POST /api/system/backup`: Pemicu pembuatan backup database instan.
- `GET /api/system/settings`, `POST /api/system/settings`: Konfigurasi profil toko Jaquris.

---

## 5. Mode Mocking & Transisi Backend

Secara default, `api.js` berjalan dalam **Mock Mode** (`config.mockMode = true`) sehingga frontend dapat langsung diuji dan didemokan tanpa memerlukan server backend yang sedang berjalan:

```javascript
// Beralih ke backend sungguhan saat server siap:
Api.setMockMode(false);

// Periksa status mode aktif:
console.log(Api.isMockMode());
```
