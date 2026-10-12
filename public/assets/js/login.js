/* ═══════════════════════════════════════════════════
   aQuaStock Pro — login.js
   Logika halaman login (splash, toggle password, login handler)
   ═══════════════════════════════════════════════════ */
  // Init icons
  lucide.createIcons();

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
    lucide.createIcons();
  }

  // ═══ TOAST ═══
  function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('flex');
    }, 2500);
  }
  
    // ═══ RESET SAAT BACK/FORWARD (bfcache) ═══
  window.addEventListener('pageshow', (e) => {
    // Kalau halaman di-restore dari cache (klik back/forward)
    if (e.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
      const splash = document.getElementById('splash');
      const splashLoading = document.getElementById('splash-loading');
      const btn = document.getElementById('login-btn');
      const btnText = document.getElementById('btn-text');
      const card = document.querySelector('.login-card');

      // Sembunyikan semua splash
      if (splash) splash.remove();
      if (splashLoading) splashLoading.classList.remove('show');

      // Reset tombol
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
      if (btnText) btnText.textContent = 'Masuk';

      // Reset card (hilangkan fade-out)
      if (card) card.classList.remove('fade-out');

      // Hilangkan progress bar kalau ada
      document.querySelectorAll('.progress-bar').forEach(p => p.remove());

      // Re-init Lucide
      lucide.createIcons();
    }
  });

  // ═══ LOGIN HANDLER ═══
  function handleLogin(e) {
    e.preventDefault();

    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const card = document.querySelector('.login-card');
    const splashLoading = document.getElementById('splash-loading');

    // 1. Loading state tombol
    btn.classList.add('loading');
    btn.disabled = true;
    btnText.innerHTML = '<span class="dot-loader"><span></span><span></span><span></span></span> Memverifikasi...';

    // 2. Progress bar
    const progress = document.createElement('div');
    progress.className = 'progress-bar';
    btn.appendChild(progress);

    // 3. Sukses setelah 3 detik
    setTimeout(() => {
      btnText.innerHTML = '<span class="checkmark"><i data-lucide="check" class="w-4 h-4"></i></span> Berhasil';
      lucide.createIcons();
      progress.remove();

      // 4. Fade out card + toast
      setTimeout(() => {
        card.classList.add('fade-out');
        showToast('Login berhasil — mengalihkan...');

        // 5. Munculkan splash loading overlay
        setTimeout(() => {
          splashLoading.classList.add('show');

          // 6. Redirect setelah splash tampil 1.5 detik
          setTimeout(() => {
            window.location.href = '../dashboard/';
          }, 1500);
        }, 300);
      }, 500);
    }, 3000);
  }
