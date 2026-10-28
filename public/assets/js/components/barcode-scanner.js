(function () {
  const SCAN_FORMATS = ['code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'qr_code'];
  const HTML5_FORMATS = [
    'QR_CODE', 'AZTEC', 'CODABAR', 'CODE_39', 'CODE_93', 'CODE_128',
    'DATA_MATRIX', 'ITF', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'PDF_417'
  ];
  let scanner = null;
  let stream = null;
  let animationFrame = null;
  let scanInProgress = false;
  let isStopping = false;
  let libraryPromise = null;
  let scannerSession = 0;

  function setStatus(modal, message) {
    const status = modal.querySelector('#item-scanner-status');
    if (status) status.textContent = message;
  }

  function createModal() {
    document.getElementById('item-barcode-scanner')?.remove();
    const modal = document.createElement('div');
    modal.id = 'item-barcode-scanner';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md';
    modal.innerHTML = `
      <section class="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="item-scanner-title">
        <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 id="item-scanner-title" class="text-sm font-semibold text-white">Pindai Barcode Produk</h2>
            <p class="mt-0.5 text-xs text-[#A0A0A5]">Arahkan barcode ke bingkai atau ambil foto</p>
          </div>
          <button type="button" id="item-scanner-close" class="grid h-10 w-10 place-items-center rounded-xl text-[#A0A0A5] hover:bg-white/5 hover:text-white transition active:scale-90" aria-label="Tutup pemindai">
            <i data-lucide="x" class="h-5 w-5" aria-hidden="true"></i>
          </button>
        </header>
        <div class="relative bg-black min-h-64 flex items-center justify-center overflow-hidden">
          <video id="item-scanner-video" class="hidden aspect-[4/3] w-full object-cover" autoplay muted playsinline></video>
          <div id="item-scanner-reader" class="min-h-64 w-full"></div>
          <div id="item-scanner-frame" class="pointer-events-none absolute left-1/2 top-1/2 hidden h-36 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-[#32ADE6] shadow-[0_0_0_999px_rgba(0,0,0,0.35)]"></div>
        </div>
        <p id="item-scanner-status" class="px-4 py-2.5 text-center text-xs text-[#A0A0A5]" aria-live="polite">Mengaktifkan kamera…</p>
        
        <!-- Opsi Pemindaian Alternatif (Universal untuk iOS PWA & Android) -->
        <div class="p-3 bg-[#121214] border-t border-white/10 flex flex-col gap-2">
          <input type="file" id="item-scanner-file-input" accept="image/*" capture="environment" class="hidden">
          <button type="button" id="btn-scan-via-photo" class="w-full bg-[#0088CC]/20 hover:bg-[#0088CC]/30 border border-[#0088CC]/40 text-[#32ADE6] active:scale-95 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer">
            <i data-lucide="camera" class="w-4 h-4 text-[#32ADE6]"></i>
            <span>Ambil / Unggah Foto Barcode</span>
          </button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    window.refreshIcons?.(modal);
    return modal;
  }

  function loadHtml5Qrcode() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/js/vendor/html5-qrcode.min.js';
      script.onload = resolve;
      script.onerror = () => {
        libraryPromise = null;
        reject(new Error('Pustaka pemindai barcode gagal dimuat.'));
      };
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  async function stopScanner(modal) {
    scannerSession += 1;
    isStopping = true;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    modal.remove();
    document.removeEventListener('keydown', handleEscape);
    if (scanner) {
      const activeScanner = scanner;
      scanner = null;
      try {
        await activeScanner.stop();
      } catch (error) {
        console.warn('Gagal menghentikan sesi pemindai barcode:', error);
      }
      try {
        await activeScanner.clear();
      } catch (error) {
        console.warn('Gagal membersihkan pemindai barcode:', error);
      }
    }
    isStopping = false;
  }

  async function handleEscape(event) {
    if (event.key === 'Escape') {
      const modal = document.getElementById('item-barcode-scanner');
      if (modal) await stopScanner(modal);
    }
  }

  function playScanFeedback() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(100);
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (_) {}
  }

  window.playScanFeedback = playScanFeedback;

  async function finishScan(modal, value, onScan) {
    if (scanInProgress || !modal.isConnected) return;
    const barcode = String(value || '').trim();
    if (!barcode) return;
    scanInProgress = true;
    playScanFeedback();
    await stopScanner(modal);
    onScan(barcode);
  }

  async function startNativeScanner(modal, onScan, session) {
    const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
    if (session !== scannerSession || !modal.isConnected) return true;
    const formats = SCAN_FORMATS.filter((format) => supportedFormats.includes(format));
    if (!formats.length) return false;

    const cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } }
    });
    if (session !== scannerSession || !modal.isConnected) {
      cameraStream.getTracks().forEach((track) => track.stop());
      return true;
    }
    stream = cameraStream;
    const video = modal.querySelector('#item-scanner-video');
    video.classList.remove('hidden');
    modal.querySelector('#item-scanner-frame').classList.remove('hidden');
    video.srcObject = stream;
    await video.play();

    const detector = new window.BarcodeDetector({ formats });
    setStatus(modal, 'Kamera aktif. Arahkan barcode produk ke dalam bingkai.');
    const scanFrame = async () => {
      if (!stream) return;
      try {
        const results = await detector.detect(video);
        if (results.length) {
          await finishScan(modal, results[0].rawValue, onScan);
          return;
        }
      } catch (error) {
        console.warn('Pemindaian barcode belum berhasil:', error);
        setStatus(modal, 'Belum terbaca. Atur fokus kamera dan coba lagi.');
      }
      if (stream) animationFrame = requestAnimationFrame(scanFrame);
    };
    animationFrame = requestAnimationFrame(scanFrame);
    return true;
  }

  async function startFallbackScanner(modal, onScan, session) {
    await loadHtml5Qrcode();
    if (session !== scannerSession || !modal.isConnected) return;
    const formats = HTML5_FORMATS
      .map((format) => window.Html5QrcodeSupportedFormats[format])
      .filter((format) => format !== undefined);
    const scannerInstance = new window.Html5Qrcode('item-scanner-reader', { verbose: false, formatsToSupport: formats });
    scanner = scannerInstance;

    let cameraConstraints = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };
    try {
      if (typeof window.Html5Qrcode.getCameras === 'function') {
        const devices = await window.Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const back = devices.find(d => /back|belakang|rear|environment/i.test(d.label)) || devices[devices.length - 1];
          if (back && back.id) {
            cameraConstraints = {
              deviceId: { exact: back.id },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            };
          }
        }
      }
    } catch (_) {}

    const startWithConfig = async (cfg) => {
      return scannerInstance.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (width, height) => ({
            width: Math.min(Math.floor(width * 0.92), 480),
            height: Math.min(Math.floor(height * 0.42), 180)
          }),
          aspectRatio: 1.333333,
          videoConstraints: cfg
        },
        (decodedText) => finishScan(modal, decodedText, onScan),
        () => {}
      );
    };

    try {
      await startWithConfig(cameraConstraints);
    } catch (err1) {
      console.warn('Gagal start dengan kamera ID, mencoba environment constraint:', err1);
      try {
        await startWithConfig({ facingMode: 'environment' });
      } catch (err2) {
        console.warn('Gagal facingMode environment, mencoba generic user facing:', err2);
        await startWithConfig({ facingMode: 'user' });
      }
    }

    if (session !== scannerSession || !modal.isConnected) {
      if (scanner === scannerInstance) scanner = null;
      try {
        await scannerInstance.stop();
      } catch (error) {
        console.warn('Gagal menghentikan sesi pemindai barcode:', error);
      }
      try {
        await scannerInstance.clear();
      } catch (error) {
        console.warn('Gagal membersihkan pemindai barcode:', error);
      }
      return;
    }
    setStatus(modal, 'Kamera aktif. Arahkan barcode produk ke dalam bingkai.');
  }

  async function openBarcodeScanner(onScan) {
    if (typeof onScan !== 'function') throw new TypeError('Callback hasil pemindaian wajib disediakan.');
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      showToast('Pemindai kamera hanya tersedia melalui koneksi HTTPS.', 'error');
      return;
    }
    if (scanner || stream || isStopping) return;

    const modal = createModal();
    scanInProgress = false;
    const session = ++scannerSession;
    document.addEventListener('keydown', handleEscape);
    modal.querySelector('#item-scanner-close').addEventListener('click', () => stopScanner(modal));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) stopScanner(modal);
    });

    // Setup input file foto barcode (100% universal untuk semua smartphone)
    const fileInput = modal.querySelector('#item-scanner-file-input');
    const photoBtn = modal.querySelector('#btn-scan-via-photo');
    if (photoBtn && fileInput) {
      photoBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus(modal, 'Memindai foto barcode…');
        photoBtn.disabled = true;
        try {
          await loadHtml5Qrcode();
          if (scanner) {
            const activeScanner = scanner;
            scanner = null;
            try {
              await activeScanner.stop();
            } catch (error) {
              console.warn('Kamera tidak aktif saat beralih ke pemindaian foto:', error);
            }
            try {
              await activeScanner.clear();
            } catch (error) {
              console.warn('Gagal membersihkan kamera sebelum memindai foto:', error);
            }
          }
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
          }
          if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
          if (session !== scannerSession || !modal.isConnected) return;

          const formats = HTML5_FORMATS
            .map((format) => window.Html5QrcodeSupportedFormats[format])
            .filter((format) => format !== undefined);
          const photoScanner = new window.Html5Qrcode('item-scanner-reader', { verbose: false, formatsToSupport: formats });
          scanner = photoScanner;
          const decodedText = await photoScanner.scanFile(file, false);
          if (scanner === photoScanner) scanner = null;
          try {
            await photoScanner.clear();
          } catch (error) {
            console.warn('Gagal membersihkan hasil pemindaian foto:', error);
          }
          if (decodedText) await finishScan(modal, decodedText, onScan);
        } catch (err) {
          console.warn('Barcode tidak terbaca dari foto:', err);
          if (scanner) {
            try {
              await scanner.clear();
            } catch (clearError) {
              console.warn('Gagal membersihkan pemindai foto:', clearError);
            }
            scanner = null;
          }
          setStatus(modal, 'Barcode belum terbaca. Gunakan foto yang fokus, cukup terang, dan tampilkan barcode secara utuh.');
          if (typeof showToast === 'function') {
            showToast('Barcode tidak terdeteksi dari foto. Pastikan gambar fokus dan barcode terlihat utuh.', 'error');
          }
          if (session === scannerSession && modal.isConnected) {
            try {
              await startFallbackScanner(modal, onScan, session);
            } catch (restartError) {
              console.warn('Kamera tidak dapat diaktifkan kembali setelah pemindaian foto:', restartError);
              setStatus(modal, 'Foto belum terbaca dan kamera tidak dapat diaktifkan. Coba unggah foto lain atau periksa izin kamera.');
            }
          }
        } finally {
          fileInput.value = '';
          photoBtn.disabled = false;
        }
      });
    }

    try {
      await startFallbackScanner(modal, onScan, session);
    } catch (error) {
      if (session !== scannerSession || !modal.isConnected) return;
      if (typeof window.BarcodeDetector === 'function'
        && typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        try {
          if (await startNativeScanner(modal, onScan, session)) return;
        } catch (nativeError) {
          console.warn('Pemindai kamera alternatif juga gagal dijalankan:', nativeError);
        }
      }
      console.warn('Kamera langsung tidak dapat diakses, beralih ke mode foto:', error);
      setStatus(modal, 'Kamera tidak dapat diaktifkan. Periksa izin kamera, atau gunakan tombol foto di bawah.');
      const scanBtn = modal.querySelector('#btn-scan-via-photo');
      if (scanBtn) {
        scanBtn.classList.remove('bg-[#0088CC]/20', 'text-[#32ADE6]');
        scanBtn.classList.add('bg-[#0088CC]', 'text-white', 'shadow-lg', 'shadow-[#0088CC]/30');
      }
    }
  }

  // ═══════════════════════════════════════════════
  // HARDWARE USB / BLUETOOTH RAPID KEYSTROKE SCANNER
  // ═══════════════════════════════════════════════
  let buffer = '';
  let lastKeyTime = 0;
  const SCANNER_INTERVAL_MS = 50;
  const MIN_BARCODE_LENGTH = 8;

  function dispatchGlobalBarcodeScan(code) {
    if (!code) return;
    window.dispatchEvent(new CustomEvent('barcode:scanned', { detail: { barcode: code }, bubbles: true }));

    const path = window.location.pathname;
    if (path.includes('/dashboard/out')) {
      if (typeof window.handleBarcodeDetected === 'function') {
        window.handleBarcodeDetected(code);
      } else if (typeof window.addToPosCart === 'function' && Array.isArray(window.availableProducts)) {
        const found = window.availableProducts.find(p => p.barcode === code || p.sku === code);
        if (found) window.addToPosCart(found);
      }
    } else if (path.includes('/dashboard/in')) {
      if (typeof window.handleInBarcodeDetected === 'function') {
        window.handleInBarcodeDetected(code);
      }
    } else if (path.includes('/dashboard/items')) {
      const searchInput = document.getElementById('search-item');
      if (searchInput) {
        searchInput.value = code;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  window.dispatchGlobalBarcodeScan = dispatchGlobalBarcodeScan;

  document.addEventListener('keydown', function (event) {
    const activeEl = document.activeElement;
    const isRegularInput = activeEl && (
      (activeEl.tagName === 'INPUT' && !activeEl.id.includes('barcode') && !activeEl.id.includes('search')) ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    if (event.key === 'Enter') {
      if (buffer.length >= MIN_BARCODE_LENGTH) {
        const scannedCode = buffer.trim();
        buffer = '';
        if (scannedCode) {
          event.preventDefault();
          playScanFeedback();
          dispatchGlobalBarcodeScan(scannedCode);
        }
      } else {
        buffer = '';
      }
      return;
    }

    if (event.key && event.key.length === 1) {
      if (timeDiff > SCANNER_INTERVAL_MS && buffer.length > 0) {
        buffer = '';
      }
      buffer += event.key;
    }
  }, true);

  window.openItemBarcodeScanner = openBarcodeScanner;
})();
