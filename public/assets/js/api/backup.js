/* ═══════════════════════════════════════════════════
   aQuaStock Pro — api/backup.js
   Layer API untuk Backup, Export/Import & Backup Logs
   Integrasi backup dengan Supabase
   ═══════════════════════════════════════════════════ */

import { supabase } from '../supabase-client.js';
import { formatResponse, handleError } from './_client.js';

export const BACKUP_TABLES = [
  { id: 'products', name: 'Barang / Produk' },
  { id: 'categories', name: 'Kategori Barang' },
  { id: 'transactions', name: 'Transaksi Penjualan' },
  { id: 'customers', name: 'Customer / Pelanggan' },
  { id: 'suppliers', name: 'Supplier / Pemasok' },
  { id: 'cash_flow', name: 'Arus Kas (Cash Flow)' },
  { id: 'debts', name: 'Hutang & Piutang' },
  { id: 'returns', name: 'Retur Barang' },
  { id: 'purchase_orders', name: 'Purchase Order' },
  { id: 'purchase_order_items', name: 'Item Purchase Order' }
];

export const backup = {
  /**
   * Mengambil riwayat log backup dari tabel backup_logs
   */
  async getLogs({ page = 1, limit = 20 } = {}) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from('backup_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return formatResponse({
        ok: true,
        data: data || [],
        meta: {
          page: Number(page),
          limit: Number(limit),
          total: count || (data ? data.length : 0),
          totalPages: count ? Math.max(1, Math.ceil(count / limit)) : 1
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Mencatat aktivitas backup (export atau import) ke tabel backup_logs
   */
  async log({ action, scope, file_name = '', records_count = 0 }) {
    try {
      let userId = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          userId = authData.user.id;
        }
      } catch (_) {}

      const payload = {
        action: action.toLowerCase(),
        scope: scope || 'all',
        file_name: file_name || '-',
        records_count: Number(records_count) || 0,
        user_id: userId,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('backup_logs')
        .insert([payload])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return formatResponse({ ok: true, data });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Export SEMUA data tabel ke format JSON tunggal
   */
  async exportAllJSON() {
    try {
      const backupData = {};
      let totalRecords = 0;

      for (const t of BACKUP_TABLES) {
        const { data, error } = await supabase
          .from(t.id)
          .select('*');

        if (error) {
          console.warn(`[BackupApi] Gagal membaca tabel ${t.id}:`, error.message);
          backupData[t.id] = [];
        } else {
          backupData[t.id] = data || [];
          totalRecords += (data || []).length;
        }
      }

      const timestamp = new Date().toISOString();
      const exportPayload = {
        meta: {
          app: 'aQuaStock Pro',
          version: '3.0',
          created_at: timestamp,
          total_records: totalRecords,
          tables: Object.keys(backupData)
        },
        data: backupData
      };

      const fileName = `aquastock_backup_all_${timestamp.slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;

      // Log ke backup_logs
      await this.log({
        action: 'export',
        scope: 'all',
        file_name: fileName,
        records_count: totalRecords
      });

      return formatResponse({
        ok: true,
        data: {
          payload: exportPayload,
          fileName: fileName,
          totalRecords: totalRecords
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Export satu tabel tertentu ke format CSV
   */
  async exportTableCSV(tableId) {
    try {
      const validTable = BACKUP_TABLES.find(t => t.id === tableId);
      if (!validTable) {
        throw new Error(`Tabel "${tableId}" tidak dikenali untuk export.`);
      }

      const { data, error } = await supabase
        .from(tableId)
        .select('*');

      if (error) {
        throw error;
      }

      const records = data || [];
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `aquastock_${tableId}_${timestamp}.csv`;

      // Generate CSV string
      let csvContent = '';
      if (records.length > 0) {
        const headers = Object.keys(records[0]);
        const rows = records.map(row =>
          headers.map(field => {
            const val = row[field];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',')
        );
        csvContent = [headers.join(','), ...rows].join('\r\n');
      } else {
        csvContent = 'No data available';
      }

      // Log ke backup_logs
      await this.log({
        action: 'export',
        scope: tableId,
        file_name: fileName,
        records_count: records.length
      });

      return formatResponse({
        ok: true,
        data: {
          csv: csvContent,
          fileName: fileName,
          recordsCount: records.length,
          tableName: validTable.name
        }
      });
    } catch (err) {
      return handleError(err);
    }
  },

  /**
   * Import / restore data dari file JSON
   */
  async importJSON(parsedData, fileName = 'backup.json') {
    try {
      if (!parsedData || typeof parsedData !== 'object') {
        throw new Error('Format file backup JSON tidak valid.');
      }

      // Format backup aQuaStock memiliki properti .data atau merupakan objek key-value tabel langsung
      const tablesData = parsedData.data && typeof parsedData.data === 'object'
        ? parsedData.data
        : parsedData;

      let totalImported = 0;
      const details = {};

      for (const t of BACKUP_TABLES) {
        const rows = tablesData[t.id];
        if (Array.isArray(rows) && rows.length > 0) {
          try {
            // Upsert / insert ke tabel target Supabase
            const { error } = await supabase
              .from(t.id)
              .upsert(rows);

            if (error) {
              console.warn(`[BackupApi] Gagal restore tabel ${t.id}:`, error.message);
              details[t.id] = { count: 0, status: 'error', message: error.message };
            } else {
              totalImported += rows.length;
              details[t.id] = { count: rows.length, status: 'success' };
            }
          } catch (upsertErr) {
            console.warn(`[BackupApi] Exception restore tabel ${t.id}:`, upsertErr);
            details[t.id] = { count: 0, status: 'error', message: upsertErr.message };
          }
        }
      }

      // Log aktivitas import
      await this.log({
        action: 'import',
        scope: 'all',
        file_name: fileName,
        records_count: totalImported
      });

      return formatResponse({
        ok: true,
        data: {
          totalImported,
          details,
          fileName
        }
      });
    } catch (err) {
      return handleError(err);
    }
  }
};
