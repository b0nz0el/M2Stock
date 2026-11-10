import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const outJsCode = fs.readFileSync(path.join(rootDir, 'public/dashboard/out.js'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'public/dashboard/index.html'), 'utf-8');

describe('Opsi A: Optimasi Alur Pesanan Marketplace & Opsi C: Struk Kasir / Invoice PDF', () => {

  describe('UI Layout & Element Verification', () => {
    it('memiliki dropdown filter channel pada tabel barang keluar', () => {
      expect(indexHtml).toContain('id="filter-out-channel"');
      expect(indexHtml).toContain('onchange="filterOutChannel(this.value)"');
      expect(indexHtml).toContain('<option value="Shopee">Shopee</option>');
      expect(indexHtml).toContain('<option value="Tokopedia">Tokopedia</option>');
      expect(indexHtml).toContain('<option value="TikTok">TikTok Shop</option>');
    });

    it('memiliki chip deteksi kurir dan notice escrow marketplace pada modal POS', () => {
      expect(indexHtml).toContain('id="pos-courier-detected"');
      expect(indexHtml).toContain('id="pos-marketplace-escrow-notice"');
      expect(indexHtml).toContain('oninput="handlePosTrackingInputChange()"');
    });

    it('memiliki tab filter channel pada modal packing list gudang', () => {
      expect(indexHtml).toContain('id="packing-channel-tabs"');
      expect(indexHtml).toContain("onclick=\"filterPackingChannel('Shopee')\"");
      expect(indexHtml).toContain("onclick=\"filterPackingChannel('Tokopedia')\"");
      expect(indexHtml).toContain("onclick=\"filterPackingChannel('TikTok')\"");
    });

    it('memiliki tombol WhatsApp share dan cetak Invoice PDF pada modal struk thermal', () => {
      expect(indexHtml).toContain('id="btn-receipt-whatsapp"');
      expect(indexHtml).toContain('onclick="shareReceiptViaWhatsApp()"');
      expect(indexHtml).toContain('id="btn-receipt-invoice-pdf"');
      expect(indexHtml).toContain('onclick="printCurrentReceiptAsInvoicePDF()"');
    });
  });

  describe('Deteksi Otomatis Kurir (Courier Detection)', () => {
    it('mengidentifikasi kurir Shopee Express (SPX), J&T, Tokopedia, TikTok, SiCepat, JNE, Anteraja', () => {
      expect(outJsCode).toContain('function detectCourierFromTracking(trackingNumber)');
      
      const evalFn = new Function(`${outJsCode}; return detectCourierFromTracking;`)();
      
      const spx = evalFn('SPXID04829182910');
      expect(spx).not.toBeNull();
      expect(spx.code).toBe('SPX');
      expect(spx.name).toContain('Shopee Express');

      const jnt = evalFn('TJNT123456789');
      expect(jnt).not.toBeNull();
      expect(jnt.code).toBe('J&T');

      const tkp = evalFn('TKP01-99882233');
      expect(tkp).not.toBeNull();

      const tiktok = evalFn('TTS772819283');
      expect(tiktok).not.toBeNull();
      expect(tiktok.code).toBe('TIKTOK');

      const sicepat = evalFn('004281928391');
      expect(sicepat).not.toBeNull();
      expect(sicepat.code).toBe('SICEPAT');

      const jne = evalFn('SOCAG0019283910');
      expect(jne).not.toBeNull();
      expect(jne.code).toBe('JNE');

      const anteraja = evalFn('1000992837192');
      expect(anteraja).not.toBeNull();
      expect(anteraja.code).toBe('ANTERAJA');

      expect(evalFn('')).toBeNull();
      expect(evalFn(null)).toBeNull();
    });
  });

  describe('Kalkulator Terbilang Rupiah', () => {
    it('menerjemahkan angka nominal menjadi ejaan terbilang bahasa Indonesia standar', () => {
      expect(outJsCode).toContain('function terbilang(n)');
      
      const evalTerbilang = new Function(`${outJsCode}; return terbilang;`)();

      expect(evalTerbilang(0)).toBe('Nol');
      expect(evalTerbilang(150000)).toBe('Seratus Lima Puluh Ribu');
      expect(evalTerbilang(2750000)).toBe('Dua Juta Tujuh Ratus Lima Puluh Ribu');
      expect(evalTerbilang(11500)).toBe('Sebelas Ribu Lima Ratus');
    });
  });

  describe('Invoice PDF & WhatsApp Share Handlers', () => {
    it('menghasilkan HTML Invoice A4 dengan header, metadata, tabel item, dan terbilang', () => {
      expect(outJsCode).toContain('function generateInvoicePrintHTML(inv)');
      expect(outJsCode).toContain('function printInvoicePDF(txIdOrBatch)');
      expect(outJsCode).toContain('function printCurrentReceiptAsInvoicePDF()');
      expect(outJsCode).toContain('function shareReceiptViaWhatsApp()');

      const evalGen = new Function(`${outJsCode}; return generateInvoicePrintHTML;`)();
      const html = evalGen({
        invoice_no: 'INV-20261110-001',
        date: '10 Nov 2026 04:00',
        customer: 'Budi Santoso',
        customer_phone: '08123456789',
        cashier: 'Admin',
        channel: 'Shopee',
        tracking: 'SPXID00123984',
        method: 'Transfer',
        status: 'LUNAS',
        items: [
          { name: 'Aquarium 60cm', qty: 1, price: 150000, total: 150000 },
          { name: 'Filter Hang-on', qty: 2, price: 50000, total: 100000 }
        ],
        subtotal: 250000,
        discount: 10000,
        tax: 0,
        total: 240000,
        paid: 240000,
        change: 0
      });

      expect(html).toContain('INVOICE PENJUALAN');
      expect(html).toContain('INV-20261110-001');
      expect(html).toContain('Budi Santoso');
      expect(html).toContain('Shopee');
      expect(html).toContain('SPXID00123984');
      expect(html).toContain('Aquarium 60cm');
      expect(html).toContain('Filter Hang-on');
      expect(html).toContain('Dua Ratus Empat Puluh Ribu Rupiah');
      expect(html).toContain('Tanda Terima / Pelanggan');
      expect(html).toContain('Hormat Kami');
    });

    it('mengekspor fungsi window yang dibutuhkan', () => {
      expect(outJsCode).toContain('window.detectCourierFromTracking = detectCourierFromTracking;');
      expect(outJsCode).toContain('window.handlePosTrackingInputChange = handlePosTrackingInputChange;');
      expect(outJsCode).toContain('window.filterOutChannel = filterOutChannel;');
      expect(outJsCode).toContain('window.filterPackingChannel = filterPackingChannel;');
      expect(outJsCode).toContain('window.printInvoicePDF = printInvoicePDF;');
      expect(outJsCode).toContain('window.printCurrentReceiptAsInvoicePDF = printCurrentReceiptAsInvoicePDF;');
      expect(outJsCode).toContain('window.shareReceiptViaWhatsApp = shareReceiptViaWhatsApp;');
    });
  });

  describe('Filter Packing List Per Marketplace Channel', () => {
    it('mendukung filter channel pada packing list', () => {
      expect(outJsCode).toContain('function filterPackingChannel(channel)');
      expect(outJsCode).toContain('currentPackingFilterChannel');
    });
  });
});

