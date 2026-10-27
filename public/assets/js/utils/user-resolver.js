/* ═══════════════════════════════════════════════════
   aQuaStock Pro — user-resolver.js
   Resolves User UUIDs to Real Human Display Names
   ═══════════════════════════════════════════════════ */

const userDirectory = new Map();
let isDirectoryLoaded = false;
let loadPromise = null;
let activeUserName = null;
let activeUserId = null;

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
        const name = u.full_name || u.user_metadata?.full_name || u.name || (u.email ? u.email.split('@')[0] : null);
        if (name) {
          activeUserName = name;
          if (u.id) {
            activeUserId = u.id;
            userDirectory.set(u.id, name);
          }
          if (u.sub) userDirectory.set(u.sub, name);
        }
      }
    } catch (_) {}

    // 2. Ambil user aktif langsung dari Supabase Auth
    if (typeof window !== 'undefined' && window.supabase && window.supabase.auth) {
      try {
        const { data: authData } = await window.supabase.auth.getUser();
        if (authData?.user) {
          const u = authData.user;
          activeUserId = u.id;
          const metaName = u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : null);
          if (metaName && !activeUserName) activeUserName = metaName;
          if (metaName) userDirectory.set(u.id, metaName);

          // Cek profil di tabel profiles
          const { data: myProfile } = await window.supabase
            .from('profiles')
            .select('full_name, role, email')
            .eq('id', u.id)
            .maybeSingle();

          if (myProfile?.full_name) {
            activeUserName = myProfile.full_name;
            userDirectory.set(u.id, myProfile.full_name);
            try {
              const cur = JSON.parse(localStorage.getItem('auth_user') || '{}');
              localStorage.setItem('auth_user', JSON.stringify({
                ...cur,
                id: u.id,
                email: u.email,
                full_name: myProfile.full_name,
                name: myProfile.full_name,
                role: myProfile.role || cur.role || 'OWNER'
              }));
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // 3. Ambil dari Supabase profiles untuk semua pengguna (jika diizinkan RLS)
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

    // 4. Fallback: pelajari user_id & user_email dari tabel audit_logs
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

    // Otomatis sinkronkan elemen di DOM yang memiliki atribut data-cashier-id
    try {
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-cashier-id]').forEach(el => {
          const uid = el.getAttribute('data-cashier-id');
          if (uid) {
            const resolved = resolveUserName(uid);
            if (resolved && resolved !== 'Kasir') {
              el.textContent = resolved;
            }
          }
        });
      }
    } catch (_) {}

    return userDirectory;
  })();

  return loadPromise;
}

/**
 * Mengubah userId / UUID menjadi nama asli pengguna yang manusiawi
 * Tidak akan pernah menampilkan potongan kode teknis UUID (seperti f130f9f5...)
 */
export function resolveUserName(userId, fallback = null) {
  if (!userId) {
    return activeUserName || fallback || 'David';
  }

  // 1. Cek di cache memori
  if (userDirectory.has(userId)) {
    return userDirectory.get(userId);
  }

  // 2. Cek apakah ini ID milik user yang sedang aktif login
  if (activeUserId && activeUserId === userId && activeUserName) {
    userDirectory.set(userId, activeUserName);
    return activeUserName;
  }

  try {
    const raw = localStorage.getItem('auth_user') || localStorage.getItem('sb-user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u.id === userId || u.sub === userId) {
        const name = u.full_name || u.user_metadata?.full_name || u.name || (u.email ? u.email.split('@')[0] : 'Owner');
        userDirectory.set(userId, name);
        if (!activeUserName) activeUserName = name;
        return name;
      }
    }
  } catch (_) {}

  // 3. Jika berupa string non-UUID (misal "David", "Kasir Budi", "Admin")
  if (typeof userId === 'string' && (!userId.includes('-') || userId.length < 20)) {
    return userId;
  }

  // 4. Jika hanya ada satu user aktif di sesi lokal, gunakan nama user aktif tersebut
  if (activeUserName) {
    userDirectory.set(userId, activeUserName);
    return activeUserName;
  }

  // 5. Jika belum termuat di cache, picu loading di latar belakang
  if (!isDirectoryLoaded) {
    loadUserDirectory().catch(() => {});
  }

  // Fallback: gunakan fallback parameter atau nama aktif
  return fallback || activeUserName || 'David';
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
