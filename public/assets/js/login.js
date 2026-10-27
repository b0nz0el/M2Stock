/* ═══════════════════════════════════════════════════
   Aquastock Pro — login.js
   Logika halaman login (splash, toggle password, login handler)
   ═══════════════════════════════════════════════════ */
  // Init icons
  if (typeof refreshIcons === 'function') {
    refreshIcons();
  } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  // ═══ SPLASH SCREEN (cuma 1x per session) ═══
  window.addEventListener('load', () => {
    const splash = document.getElementById('splash');
    if (!splash) return;

    // Kalau sudah pernah lihat splash di session ini, langsung sembunyikan
    if (sessionStorage.getItem('splashShown')) {
      splash.remove();
      return;
    }

    // Tandai sudah lihat
    sessionStorage.setItem('splashShown', 'true');

    // Tampilkan 1.8 detik, lalu fade out
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 800);
    }, 1800);
  });

  // ═══ TOGGLE PASSWORD ═══
  function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.getElementById('eye-icon');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    if (typeof refreshIcons === 'function') {
      refreshIcons();
    } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  // ═══ TOAST ═══
  let toastTimer = null;
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const toastMsg = document.getElementById('toast-msg');
    if (toastMsg) toastMsg.textContent = msg;
    const dot = toast.querySelector('span:first-child');
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full ' + (type === 'error' ? 'bg-[#FF3B30]' : type === 'info' ? 'bg-[#0088CC]' : 'bg-[#34C759]');
    }
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('flex');
    }, 3500);
  }

  // ═══ RESET SAAT BACK/FORWARD (bfcache) ═══
  window.addEventListener('pageshow', (e) => {
    if (e.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
      const splash = document.getElementById('splash');
      const splashLoading = document.getElementById('splash-loading');
      const btn = document.getElementById('login-btn');
      const btnText = document.getElementById('btn-text');
      const card = document.querySelector('.login-card');

      if (splash) splash.remove();
      if (splashLoading) splashLoading.classList.remove('show');

      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
      if (btnText) btnText.textContent = 'Masuk';
      if (card) card.classList.remove('fade-out');

      document.querySelectorAll('.progress-bar').forEach(p => p.remove());

      if (typeof refreshIcons === 'function') {
        refreshIcons();
      } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    }
  });

  // ═══ AUTO-REDIRECT JIKA SUDAH LOGIN ═══
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      let retries = 0;
      while (!window.Auth && retries < 25) {
        await new Promise(r => setTimeout(r, 40));
        retries++;
      }
      if (window.Auth && typeof window.Auth.getCurrentUser === 'function') {
        const user = await window.Auth.getCurrentUser();
        if (user) {
          window.location.replace('/dashboard/');
        }
      }
    } catch (_) {}
  });

  // ═══ AUTH HANDLER (LIVE SUPABASE LOGIN) ═══
  async function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const card = document.querySelector('.login-card');
    const splashLoading = document.getElementById('splash-loading');

    if (!email || !password) {
      showToast('Email dan kata sandi wajib diisi', 'error');
      return;
    }

    // 1. Loading state tombol
    btn.classList.add('loading');
    btn.disabled = true;
    const originalText = btnText.innerHTML;
    btnText.innerHTML = '<span class="dot-loader"><span></span><span></span><span></span></span> Memverifikasi...';

    try {
      const res = await window.Auth.login(email, password);

      if (!res.ok) {
        showToast(res.error?.message || 'Gagal memproses permintaan', 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
        btnText.innerHTML = originalText;
        return;
      }

      // 2. Tampilkan status berhasil
      btnText.innerHTML = '<span class="checkmark"><i data-lucide="check" class="w-4 h-4"></i></span> Berhasil';
      if (typeof refreshIcons === 'function') {
        refreshIcons();
      }

      // Catat Jejak Audit Login (untuk semua role: Owner & Staff)
      try {
        if (window.supabase) {
          const userObj = res.data?.user || (await window.supabase.auth.getUser())?.data?.user;
          if (userObj) {
            const userName = userObj.user_metadata?.full_name || (userObj.email ? userObj.email.split('@')[0] : 'David');
            try {
              localStorage.setItem('auth_user', JSON.stringify({
                id: userObj.id,
                email: userObj.email,
                full_name: userName,
                name: userName,
                role: userObj.user_metadata?.role || 'OWNER'
              }));
            } catch (_) {}
          }
          let clientIp = null;
          if (typeof window.getClientIp === 'function') {
            try { clientIp = await window.getClientIp(); } catch (_) {}
          }
          if (!clientIp) {
            try {
              const traceRes = await fetch('/cdn-cgi/trace', { cache: 'no-store' });
              if (traceRes.ok) {
                const match = (await traceRes.text()).match(/^ip=(.+)$/m);
                if (match && match[1]) clientIp = match[1].trim();
              }
            } catch (_) {}
          }

          window.supabase.from('audit_logs').insert([{
            user_id: userObj?.id || null,
            user_email: userObj?.email || email,
            action: 'LOGIN',
            target: 'Login ke sistem via web browser',
            ip: clientIp || null,
            created_at: new Date().toISOString()
          }]).then(() => {}).catch(() => {});
        }
      } catch (_) {}

      // 3. Fade out card + toast
      setTimeout(() => {
        if (card) card.classList.add('fade-out');
        showToast('Login berhasil — mengalihkan...');

        // 4. Splash loading overlay
        setTimeout(() => {
          if (splashLoading) splashLoading.classList.add('show');
          setTimeout(() => {
            window.location.href = '/dashboard/';
          }, 1000);
        }, 200);
      }, 300);

    } catch (err) {
      console.error('Auth submit error:', err);
      showToast('Terjadi kesalahan jaringan', 'error');
      btn.classList.remove('loading');
      btn.disabled = false;
      btnText.innerHTML = originalText;
    }
  }

  // Ekspos ke global window
  window.togglePassword = togglePassword;
  window.showToast = showToast;
  window.handleAuthSubmit = handleAuthSubmit;
  window.handleLogin = handleAuthSubmit;
