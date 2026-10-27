/* ═══════════════════════════════════════════════════
   aQuaStock Pro — user-resolver.js
   Resolves User UUIDs to Real Human Display Names
   ═══════════════════════════════════════════════════ */

const userDirectory = new Map();
let isDirectoryLoaded = false;
let loadPromise = null;

/**
 * Memuat seluruh profil pengguna dari Supabase (id, full_name, email, role)
 */
export async function loadUserDirectory() {
  if (isDirectoryLoaded) return userDirectory;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // 1. Ambil nama user aktif dari sesi lokal terlebih dahulu
    try {
      const raw = localStorage.getItem('auth_user') || localStorage.getItem('sb-user');
      if (raw) {
        const u = JSON.parse(raw);
        const name = u.full_name || u.user_metadata?.full_name || u.name || (u.email ? u.email.split('@')[0] : 'Owner');
        if (u.id) userDirectory.set(u.id, name);
        if (u.sub) userDirectory.set(u.sub, name);
      }
    } catch (_) {}

    // 2. Ambil dari Supabase profiles jika tersedia
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.from === 'function') {
      try {
        const { data, error } = await window.supabase
          .from('profiles')
          .select('id, full_name, role, email');

        if (!error && Array.isArray(data)) {
          data.forEach(p => {
            if (p.id) {
              const displayName = p.full_name || (p.email ? p.email.split('@')[0] : 'Kasir');
              userDirectory.set(p.id, displayName);
            }
          });
        }
      } catch (_) {}
    }

    // 3. Fallback: pelajari user_id & user_email dari tabel audit_logs
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.from === 'function') {
      try {
        const { data: auditUsers } = await window.supabase
          .from('audit_logs')
          .select('user_id, user_email')
          .not('user_id', 'is', null)
          .limit(100);

        if (Array.isArray(auditUsers)) {
          auditUsers.forEach(a => {
            if (a.user_id && a.user_email && !userDirectory.has(a.user_id)) {
              const nameFromEmail = a.user_email.split('@')[0];
              userDirectory.set(a.user_id, nameFromEmail);
            }
          });
        }
      } catch (_) {}
    }

    isDirectoryLoaded = true;
    return userDirectory;
  })();

  return loadPromise;
}

/**
 * Mengubah userId / UUID menjadi nama asli pengguna yang manusiawi
 * Tidak akan pernah menampilkan potongan kode teknis UUID (seperti f130f9f5...)
 */
export function resolveUserName(userId) {
  if (!userId) return 'Admin';

  // 1. Cek di cache memori
  if (userDirectory.has(userId)) {
    return userDirectory.get(userId);
  }

  // 2. Cek apakah ini ID milik user yang sedang aktif login
  try {
    const raw = localStorage.getItem('auth_user') || localStorage.getItem('sb-user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u.id === userId || u.sub === userId) {
        const name = u.full_name || u.user_metadata?.full_name || u.name || (u.email ? u.email.split('@')[0] : 'Owner');
        userDirectory.set(userId, name);
        return name;
      }
    }
  } catch (_) {}

  // 3. Jika berupa string non-UUID (misal "David", "Kasir Budi", "Admin")
  if (typeof userId === 'string' && (!userId.includes('-') || userId.length < 20)) {
    return userId;
  }

  // 4. Jika belum termuat di cache, picu loading di latar belakang
  if (!isDirectoryLoaded) {
    loadUserDirectory().then(() => {
      // Jika ada elemen DOM yang menampilkan kasir, beri kesempatan re-render
    }).catch(() => {});
  }

  // Fallback nama ramah pengguna (bukan UUID)
  return 'Kasir';
}

if (typeof window !== 'undefined') {
  window.resolveUserName = resolveUserName;
  window.loadUserDirectory = loadUserDirectory;
  // Otomatis muat saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadUserDirectory());
  } else {
    loadUserDirectory();
  }
}
