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
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm';
    modal.innerHTML = `
      <section class="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="item-scanner-title">
        <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 id="item-scanner-title" class="text-sm font-semibold text-white">Pindai Barcode Produk</h2>
            <p class="mt-0.5 text-xs text-[#A0A0A5]">Arahkan barcode ke dalam bingkai</p>
          </div>
          <button type="button" id="item-scanner-close" class="grid h-10 w-10 place-items-center rounded-xl text-[#A0A0A5] hover:bg-white/5 hover:text-white" aria-label="Tutup pemindai">
            <i data-lucide="x" class="h-5 w-5" aria-hidden="true"></i>
          </button>
        </header>
        <div class="relative bg-black">
          <video id="item-scanner-video" class="hidden aspect-[4/3] w-full object-cover" autoplay muted playsinline></video>
          <div id="item-scanner-reader" class="min-h-64 w-full"></div>
          <div id="item-scanner-frame" class="pointer-events-none absolute left-1/2 top-1/2 hidden h-36 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-[#32ADE6] shadow-[0_0_0_999px_rgba(0,0,0,0.28)]"></div>
        </div>
        <p id="item-scanner-status" class="px-4 py-3 text-center text-xs text-[#A0A0A5]" aria-live="polite">Mengaktifkan kamera…</p>
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
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
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
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
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
    await scannerInstance.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      (decodedText) => finishScan(modal, decodedText, onScan),
      () => {}
    );
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

    try {
      if (typeof window.BarcodeDetector === 'function'
        && typeof window.BarcodeDetector.getSupportedFormats === 'function'
        && await startNativeScanner(modal, onScan, session)) return;
      await startFallbackScanner(modal, onScan, session);
    } catch (error) {
      if (session !== scannerSession || !modal.isConnected) return;
      console.error('Gagal memulai pemindai barcode produk:', error);
      const message = error.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser.'
        : error.message || 'Kamera tidak dapat diaktifkan.';
      await stopScanner(modal);
      showToast(message, 'error');
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
