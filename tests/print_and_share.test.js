import { describe, expect, it } from 'vitest';

describe('Print and Share Features (Fase B)', () => {
  describe('Purchase Order WhatsApp Formatter', () => {
    function generatePOWhatsAppText(item) {
      if (!item) return '';
      const supplierName = item.supplier_nama || item.catatan?.replace('Supplier: ', '') || 'Supplier Mitra';
      const noPO = item.no_po || '-';
      const tanggalPO = item.tanggal || '-';
      const total = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.total || 0);
      const items = item.items || item.purchase_order_items || [];

      let text = `*SURAT PESANAN PEMBELIAN BARANG (PURCHASE ORDER)*\n`;
      text += `*Toko Jaquris Aquarium & Aksesoris, Bekasi*\n`;
      text += `-----------------------------------------------\n`;
      text += `*No. PO:* ${noPO}\n`;
      text += `*Tanggal:* ${tanggalPO}\n`;
      text += `*Kepada:* ${supplierName}\n`;
      text += `*Status:* ${(item.status || 'draft').toUpperCase()}\n\n`;
      text += `*Rincian Pesanan:*\n`;

      if (items.length === 0) {
        text += `- (Pesanan inventori standar)\n`;
      } else {
        items.forEach((it, idx) => {
          const pName = it.product_name || it.products?.name || ('Produk #' + it.product_id);
          const qty = it.qty || 1;
          const harga = it.harga || it.unit_price || 0;
          const subtotal = qty * harga;
          const formattedHarga = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(harga);
          const formattedSub = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(subtotal);
          text += `${idx + 1}. ${pName} (${qty} unit) @ ${formattedHarga} = ${formattedSub}\n`;
        });
      }

      text += `\n*TOTAL NILAI PO:* ${total}\n`;
      if (item.catatan) {
        text += `*Catatan:* ${item.catatan}\n`;
      }
      text += `-----------------------------------------------\n`;
      text += `Mohon konfirmasi ketersediaan barang. Terima kasih! 🙏`;

      return text;
    }

    it('membuat format teks WhatsApp PO yang rapi dan terstruktur', () => {
      const mockPO = {
        no_po: 'PO-202610-001',
        tanggal: '2026-10-16',
        supplier_nama: 'PT. Aquascaping Indonesia',
        status: 'draft',
        catatan: 'Kirim via kurir toko sebelum jam 17:00 WIB',
        total: 1075000,
        items: [
          { product_name: 'Filter Hang-On 501', qty: 10, harga: 65000 },
          { product_name: 'Lampu LED RGB 30cm', qty: 5, harga: 85000 }
        ]
      };

      const result = generatePOWhatsAppText(mockPO);

      expect(result).toContain('*SURAT PESANAN PEMBELIAN BARANG (PURCHASE ORDER)*');
      expect(result).toContain('*No. PO:* PO-202610-001');
      expect(result).toContain('*Kepada:* PT. Aquascaping Indonesia');
      expect(result).toContain('1. Filter Hang-On 501 (10 unit)');
      expect(result).toContain('2. Lampu LED RGB 30cm (5 unit)');
      expect(result).toContain('*Catatan:* Kirim via kurir toko sebelum jam 17:00 WIB');
      expect(result).toContain('Mohon konfirmasi ketersediaan barang.');
    });
  });

  describe('Tanda Terima Retur WhatsApp Formatter', () => {
    function generateReturnWhatsAppText(item) {
      if (!item) return '';
      const noRetur = item.no_retur || '-';
      const tanggalRetur = item.tanggal || '-';
      const tipeText = item.tipe === 'ke_supplier' ? 'Retur ke Supplier' : 'Retur dari Pelanggan';
      const statusText = (item.status || 'diproses').toUpperCase();
      const partyName = item.supplier_nama || item.customer_nama || (item.tipe === 'ke_supplier' ? 'Supplier' : 'Pelanggan');
      const prodName = item.product_name || 'Produk';
      const qty = item.qty || 1;
      const harga = item.harga_satuan || 0;
      const total = qty * harga;
      const formattedTotal = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total);

      let text = `*BUKTI TANDA TERIMA RETUR BARANG*\n`;
      text += `*Toko Jaquris Aquarium & Aksesoris, Bekasi*\n`;
      text += `-----------------------------------------------\n`;
      text += `*No. Retur:* ${noRetur}\n`;
      text += `*Tanggal:* ${tanggalRetur}\n`;
      text += `*Jenis:* ${tipeText}\n`;
      text += `*Pihak Terkait:* ${partyName}\n`;
      text += `*Status:* ${statusText}\n\n`;
      text += `*Rincian Barang Diretur:*\n`;
      text += `- Barang: ${prodName}\n`;
      text += `- Jumlah: ${qty} unit\n`;
      text += `- Nilai/Refund: ${formattedTotal}\n`;
      text += `- Alasan: ${item.alasan || '-'}\n`;
      text += `-----------------------------------------------\n`;
      text += `Dokumen bukti resmi toko Jaquris Aquarium. Terima kasih. 🙏`;

      return text;
    }

    it('membuat format teks WhatsApp retur resmi yang jelas', () => {
      const mockReturn = {
        no_retur: 'RT-202610-005',
        tanggal: '2026-10-16',
        tipe: 'ke_supplier',
        supplier_nama: 'Distributor Pakan Ikan',
        status: 'selesai',
        product_name: 'Pelet Ikan Discus 100gr',
        qty: 12,
        harga_satuan: 25000,
        alasan: 'Segel kemasan bocor saat pengiriman distributor'
      };

      const result = generateReturnWhatsAppText(mockReturn);

      expect(result).toContain('*BUKTI TANDA TERIMA RETUR BARANG*');
      expect(result).toContain('*No. Retur:* RT-202610-005');
      expect(result).toContain('*Jenis:* Retur ke Supplier');
      expect(result).toContain('*Status:* SELESAI');
      expect(result).toContain('- Barang: Pelet Ikan Discus 100gr');
      expect(result).toContain('- Jumlah: 12 unit');
      expect(result).toContain('Segel kemasan bocor');
    });
  });

  describe('Kalkulasi Struk Kasir Thermal', () => {
    function calculateChange(total, paid) {
      return Math.max(0, paid - total);
    }

    it('menghitung kembalian uang kasir dengan tepat', () => {
      const total = 175000;
      const bayar = 200000;
      const kembali = calculateChange(total, bayar);

      expect(kembali).toBe(25000);
    });

    it('mengembalikan 0 jika uang yang dibayarkan pas atau kurang', () => {
      expect(calculateChange(100000, 100000)).toBe(0);
      expect(calculateChange(100000, 80000)).toBe(0);
    });
  });
});

