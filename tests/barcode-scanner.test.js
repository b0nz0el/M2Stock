import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const scannerScript = readFileSync(resolve(process.cwd(), 'public/assets/js/components/barcode-scanner.js'), 'utf8');

describe('Barcode camera and photo scanner', () => {
  afterEach(() => {
    document.getElementById('item-barcode-scanner')?.remove();
    delete window.Html5Qrcode;
    delete window.Html5QrcodeSupportedFormats;
    delete window.BarcodeDetector;
    delete window.isSecureContext;
    delete window.showToast;
    document.body.innerHTML = '';
  });

  it('stops the live camera before decoding a photo and returns its barcode', async () => {
    const calls = [];
    let activeCameraScanner;

    class MockHtml5Qrcode {
      static getCameras = vi.fn().mockResolvedValue([{ id: 'rear-camera', label: 'Back Camera' }]);

      constructor(elementId, config) {
        this.elementId = elementId;
        this.config = config;
        this.running = false;
        activeCameraScanner = this;
      }

      start = vi.fn(async (_camera, config, onDecode) => {
        this.running = true;
        this.onDecode = onDecode;
        this.scanConfig = config;
        calls.push('camera-start');
      });

      stop = vi.fn(async () => {
        calls.push('camera-stop');
        this.running = false;
      });

      clear = vi.fn(async () => {
        calls.push('clear');
      });

      scanFile = vi.fn(async (_file, showImage) => {
        calls.push('photo-scan');
        expect(this.running).toBe(false);
        expect(showImage).toBe(false);
        return '0123456789012';
      });
    }

    window.Html5Qrcode = MockHtml5Qrcode;
    window.Html5QrcodeSupportedFormats = Object.fromEntries(
      ['QR_CODE', 'AZTEC', 'CODABAR', 'CODE_39', 'CODE_93', 'CODE_128', 'DATA_MATRIX', 'ITF', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'PDF_417']
        .map((format) => [format, format])
    );
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const detectedBarcode = vi.fn();

    window.eval(scannerScript);
    window.openItemBarcodeScanner(detectedBarcode);
    await vi.waitFor(() => expect(activeCameraScanner.start).toHaveBeenCalledOnce());
    expect(activeCameraScanner.scanConfig.videoConstraints.deviceId.exact).toBe('rear-camera');
    expect(activeCameraScanner.scanConfig.qrbox(400, 300)).toEqual({ width: 368, height: 126 });

    const fileInput = document.getElementById('item-scanner-file-input');
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['barcode photo'], 'barcode.jpg', { type: 'image/jpeg' })]
    });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(detectedBarcode).toHaveBeenCalledWith('0123456789012'));

    expect(calls.indexOf('camera-stop')).toBeLessThan(calls.indexOf('photo-scan'));
    expect(detectedBarcode).toHaveBeenCalledOnce();
    expect(document.getElementById('item-barcode-scanner')).toBeNull();
  });
});
