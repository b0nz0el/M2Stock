/* ═══════════════════════════════════════════════════
   aQuaStock Pro — offline-sync.js
   Local-First IndexedDB Offline Catalog & POS Queue Engine
   ═══════════════════════════════════════════════════ */

(function () {
  const DB_NAME = 'aquastock-offline-db';
  const DB_VERSION = 1;
  let dbInstance = null;
  let isSyncing = false;

  function openDatabase() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('catalog')) {
          const store = db.createObjectStore('catalog', { keyPath: 'id' });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('sku', 'sku', { unique: false });
        }
        if (!db.objectStoreNames.contains('pos_queue')) {
          db.createObjectStore('pos_queue', { keyPath: 'client_id' });
        }
      };

      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };

      request.onerror = (e) => {
        console.warn('[OfflineSync] IndexedDB open error:', e.target.error);
        resolve(null);
      };
    });
  }

  async function cacheCatalog(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction('catalog', 'readwrite');
      const store = tx.objectStore('catalog');
      items.forEach((item) => {
        if (item && item.id) {
          store.put(item);
        }
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function getCachedCatalog() {
    const db = await openDatabase();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('catalog', 'readonly');
      const store = tx.objectStore('catalog');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function enqueuePosTransaction(txData) {
    const db = await openDatabase();
    const entry = {
      client_id: 'off_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      ...txData,
      status: 'pending'
    };

    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction('pos_queue', 'readwrite');
        tx.objectStore('pos_queue').put(entry);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }

    updateStatusUI();
    return entry;
  }

  async function getPendingQueue() {
    const db = await openDatabase();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction('pos_queue', 'readonly');
      const store = tx.objectStore('pos_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function removeQueueItem(clientId) {
    const db = await openDatabase();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('pos_queue', 'readwrite');
      tx.objectStore('pos_queue').delete(clientId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function syncPendingTransactions() {
    if (isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const queue = await getPendingQueue();
    if (!queue || queue.length === 0) {
      updateStatusUI();
      return;
    }

    isSyncing = true;
    updateStatusUI();

    let syncedCount = 0;
    for (const item of queue) {
      try {
        if (typeof Api !== 'undefined' && Api.transactions && typeof Api.transactions.createBatchOut === 'function') {
          const res = await Api.transactions.createBatchOut(item.items, {
            channel: item.channel || 'Offline',
            customer_id: item.customer_id || null,
            payment_method: item.payment_method || 'Cash',
            note: (item.note || '') + ' [Sync Offline: ' + item.client_id + ']'
          });
          if (res && res.ok) {
            await removeQueueItem(item.client_id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.warn('[OfflineSync] Gagal memproses item queue:', item.client_id, err);
      }
    }

    isSyncing = false;
    updateStatusUI();

    if (syncedCount > 0 && typeof showToast === 'function') {
      showToast(`✓ ${syncedCount} transaksi kasir offline berhasil disinkronkan ke cloud`, 'success');
    }
  }

  function getStatus() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    if (isSyncing) return 'syncing';
    return 'online';
  }

  function updateStatusUI() {
    let pill = document.getElementById('connection-status-pill');
    if (!pill) {
      const header = document.querySelector('header');
      if (header) {
        const wrap = header.querySelector('.ml-auto') || header;
        pill = document.createElement('div');
        pill.id = 'connection-status-pill';
        pill.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition';
        wrap.prepend(pill);
      }
    }
    if (!pill) return;

    const status = getStatus();
    if (status === 'offline') {
      pill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-[#FF9500]/15 text-[#FF9500] border-[#FF9500]/30';
      pill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse"></span><span>Mode Kasir Offline</span>';
    } else if (status === 'syncing') {
      pill.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-[#0088CC]/15 text-[#32ADE6] border-[#0088CC]/30';
      pill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-[#32ADE6] animate-ping"></span><span>Menyinkronkan...</span>';
    } else {
      pill.className = 'hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-white/5 text-[#A0A0A5] border-white/5';
      pill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-[#34C759]"></span><span>Cloud Terhubung</span>';
    }
  }

  window.OfflineSync = {
    openDatabase,
    cacheCatalog,
    getCachedCatalog,
    enqueuePosTransaction,
    getPendingQueue,
    syncPendingTransactions,
    getStatus,
    updateStatusUI
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      updateStatusUI();
      if (typeof showToast === 'function') showToast('Koneksi internet kembali normal.', 'info');
      syncPendingTransactions();
    });

    window.addEventListener('offline', () => {
      updateStatusUI();
      if (typeof showToast === 'function') showToast('Anda offline. Mode kasir lokal aktif otomatis.', 'warning');
    });

    document.addEventListener('DOMContentLoaded', () => {
      openDatabase().then(() => {
        updateStatusUI();
        syncPendingTransactions();
      });
    });
  }
})();

