  let currentItems = [];
  let itemToDeleteId = null;
  let categoriesData = [];
  let unitsData = [];
  let isSubmittingItem = false;

  async function loadCategories() {
    if (typeof window.supabase === 'undefined') return;
    try {
      const [categoryResult, unitResult] = await Promise.all([
        window.supabase.from('categories').select('id, name').order('name'),
        window.supabase.from('units').select('id, name').order('name')
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (unitResult.error) throw unitResult.error;
      categoriesData = categoryResult.data || [];
      unitsData = unitResult.data || [];

      // 1. Dropdown Form Tambah/Edit
      const select = document.getElementById('item-category');
      if (select) {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Umum (Tanpa Kategori)</option>';
        if (categoriesData.length > 0) {
          categoriesData.forEach(function (cat) {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
          });
        }
        if (currentVal) select.value = currentVal;
      }

      const unitSelect = document.getElementById('item-unit');
      if (unitSelect) {
        const currentUnit = unitSelect.value;
        unitSelect.innerHTML = '';
        unitsData.forEach(function (unit) {
          const option = document.createElement('option');
          option.value = unit.id;
          option.textContent = unit.name;
          unitSelect.appendChild(option);
        });
        if (currentUnit && unitsData.some(unit => String(unit.id) === currentUnit)) {
          unitSelect.value = currentUnit;
        } else {
          const defaultUnit = unitsData.find(unit => unit.name.toLowerCase() === 'pcs') || unitsData[0];
          if (defaultUnit) unitSelect.value = String(defaultUnit.id);
        }
      }

      // 2. Dropdown Filter Toolbar
      const filterSelect = document.getElementById('filter-category');
      if (filterSelect) {
        const filterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Semua Kategori</option>';
        if (categoriesData.length > 0) {
          categoriesData.forEach(function (cat) {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            filterSelect.appendChild(opt);
          });
        }
        if (filterVal) filterSelect.value = filterVal;
      }

      // 3. Dropdown Supplier Form Tambah
      const supSelect = document.getElementById('item-supplier-id');
      if (supSelect && typeof Api !== 'undefined' && Api.suppliers?.getAll) {
        try {
          const supRes = await Api.suppliers.getAll();
          if (supRes.ok && Array.isArray(supRes.data)) {
            const currentSup = supSelect.value;
            supSelect.innerHTML = '<option value="">Umum / Saldo Awal Toko</option>';
            supRes.data.forEach(function (s) {
              const opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.name;
              supSelect.appendChild(opt);
            });
            if (currentSup) supSelect.value = currentSup;
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error('Gagal memuat kategori dan satuan:', e);
      if (typeof showToast === 'function') {
        showToast('Kategori atau satuan gagal dimuat. Periksa koneksi dan migrasi database.', 'error');
      }
    }
  }

  let productPhotos = []; // array of { id, type: 'existing'|'new', url?: string, blob?: Blob, previewUrl: string, sizeText?: string }
  let isImageChanged = false;
  const MAX_PRODUCT_PHOTOS = 6;

  function parseProductImages(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (_) {}
      }
      if (trimmed.includes('|||')) {
        return trimmed.split('|||').map(s => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
    return [];
  }

  function renderPhotoGallery() {
    const container = document.getElementById('product-gallery-container');
    const badge = document.getElementById('photo-count-badge');
    const hiddenPreview = document.getElementById('item-image-preview');
    const hiddenPlaceholder = document.getElementById('item-image-placeholder');
    const hiddenRemoveBtn = document.getElementById('btn-remove-photo');
    const hiddenUrlInput = document.getElementById('item-image-url');

    if (badge) {
      badge.textContent = `(${productPhotos.length}/${MAX_PRODUCT_PHOTOS})`;
    }

    // Sinkronkan ke input legacy untuk backward compatibility
    if (hiddenUrlInput) {
      const existingUrls = productPhotos.filter(p => p.url).map(p => p.url);
      hiddenUrlInput.value = existingUrls[0] || (productPhotos[0]?.previewUrl || '');
    }
    if (hiddenPreview) {
      if (productPhotos.length > 0) {
        hiddenPreview.src = productPhotos[0].previewUrl;
        hiddenPreview.classList.remove('hidden');
      } else {
        hiddenPreview.src = '';
        hiddenPreview.classList.add('hidden');
      }
    }
    if (hiddenPlaceholder) {
      if (productPhotos.length > 0) {
        hiddenPlaceholder.classList.add('hidden');
      } else {
        hiddenPlaceholder.classList.remove('hidden');
      }
    }
    if (hiddenRemoveBtn) {
      if (productPhotos.length > 0) {
        hiddenRemoveBtn.classList.remove('hidden');
      } else {
        hiddenRemoveBtn.classList.add('hidden');
      }
    }

    if (!container) return;

    if (productPhotos.length === 0) {
      container.innerHTML = `
        <div class="w-full flex flex-col items-center justify-center p-4 border border-dashed border-white/15 rounded-xl text-center bg-black/20">
          <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#A0A0A5] mb-1.5">
            <i data-lucide="image" class="w-5 h-5 opacity-60"></i>
          </div>
          <p class="text-xs font-medium text-white/80">Belum ada foto produk</p>
          <p class="text-[11px] text-[#A0A0A5] mt-0.5">Ambil kamera atau pilih hingga ${MAX_PRODUCT_PHOTOS} foto dari galeri</p>
        </div>
      `;
    } else {
      let cardsHtml = productPhotos.map((photo, idx) => {
        const isPrimary = idx === 0;
        return `
          <div class="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-black/40 border ${isPrimary ? 'border-[#0088CC] shadow-[0_0_12px_rgba(0,136,204,0.35)]' : 'border-white/10'} flex items-center justify-center overflow-hidden flex-shrink-0 group">
            <img src="${escapeHtml(photo.previewUrl)}" alt="Foto ${idx + 1}" class="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-200" title="Klik untuk lihat ukuran penuh" onclick="previewGalleryPhoto(${idx})">
            
            ${isPrimary ? `
              <span class="absolute top-1 left-1 bg-[#0088CC] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow pointer-events-none">
                <i data-lucide="star" class="w-2.5 h-2.5 fill-current"></i> Utama
              </span>
            ` : `
              <button type="button" onclick="setPhotoAsPrimary(${idx})" title="Jadikan Foto Utama" class="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-1 left-1 bg-black/80 hover:bg-[#0088CC] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 transition shadow cursor-pointer">
                <i data-lucide="star" class="w-2.5 h-2.5"></i> Utama
              </button>
            `}

            <button type="button" onclick="removePhotoByIndex(${idx})" title="Hapus foto ini" aria-label="Hapus foto ${idx + 1}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 hover:bg-[#FF3B30] text-white flex items-center justify-center transition shadow opacity-90 hover:opacity-100 z-10 cursor-pointer">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>

            <span class="absolute bottom-1 right-1 bg-black/75 text-white/80 text-[9px] px-1.5 py-0.2 rounded font-mono pointer-events-none">
              ${idx + 1}
            </span>
          </div>
        `;
      }).join('');

      if (productPhotos.length < MAX_PRODUCT_PHOTOS) {
        cardsHtml += `
          <div onclick="document.getElementById('item-image-file').click()" class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-dashed border-white/20 hover:border-[#0088CC]/60 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95 flex-shrink-0 group" title="Tambah foto lagi">
            <i data-lucide="plus" class="w-5 h-5 text-[#32ADE6] group-hover:scale-110 transition"></i>
            <span class="text-[10px] text-white/70 font-medium">+ Foto</span>
          </div>
        `;
      }

      container.innerHTML = cardsHtml;
    }

    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons(container);
    }
  }

  function setPhotoAsPrimary(index) {
    if (index > 0 && index < productPhotos.length) {
      const [photo] = productPhotos.splice(index, 1);
      productPhotos.unshift(photo);
      isImageChanged = true;
      renderPhotoGallery();
      if (typeof showToast === 'function') {
        showToast('Foto utama berhasil diubah', 'info');
      }
    }
  }

  function removePhotoByIndex(index) {
    if (index >= 0 && index < productPhotos.length) {
      productPhotos.splice(index, 1);
      isImageChanged = true;
      renderPhotoGallery();
    }
  }

  function previewGalleryPhoto(index) {
    const urls = productPhotos.map(p => p.previewUrl);
    const name = document.getElementById('item-name')?.value || 'Foto Produk';
    const sku = document.getElementById('item-sku')?.value || '';
    if (typeof window.openImageViewer === 'function') {
      window.openImageViewer(urls, name, sku, index);
    }
  }

  function removeSelectedPhoto() {
    productPhotos = [];
    isImageChanged = true;
    renderPhotoGallery();
  }

  function resetImageForm() {
    productPhotos = [];
    isImageChanged = false;
    const fileInput = document.getElementById('item-image-file');
    const camInput = document.getElementById('item-image-camera');
    const compInfo = document.getElementById('image-compression-info');

    if (fileInput) fileInput.value = '';
    if (camInput) camInput.value = '';
    if (compInfo) compInfo.classList.add('hidden');
    renderPhotoGallery();
  }

  if (typeof window !== 'undefined') {
    window.setPhotoAsPrimary = setPhotoAsPrimary;
    window.removePhotoByIndex = removePhotoByIndex;
    window.previewGalleryPhoto = previewGalleryPhoto;
    window.removeSelectedPhoto = removeSelectedPhoto;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  async function handleImageSelection(e) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (typeof ImageUtils === 'undefined') {
      if (typeof showToast === 'function') showToast('Modul kompresi gambar (ImageUtils) belum siap', 'error');
      return;
    }

    const availableSlots = MAX_PRODUCT_PHOTOS - productPhotos.length;
    if (availableSlots <= 0) {
      if (typeof showToast === 'function') {
        showToast(`Maksimal ${MAX_PRODUCT_PHOTOS} foto produk telah tercapai`, 'warning');
      }
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    if (files.length > availableSlots && typeof showToast === 'function') {
      showToast(`Hanya ${availableSlots} foto yang ditambahkan (batas maksimal ${MAX_PRODUCT_PHOTOS} foto)`, 'info');
    }

    const compInfo = document.getElementById('image-compression-info');
    const compText = document.getElementById('compression-info-text');
    if (compInfo && compText) {
      compText.textContent = filesToProcess.length > 1 
        ? `Mengompresi ${filesToProcess.length} foto ke WebP...` 
        : 'Mengompresi ke WebP...';
      compInfo.classList.remove('hidden');
    }

    let successCount = 0;
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        if (compText && filesToProcess.length > 1) {
          compText.textContent = `Mengompresi foto ${i + 1}/${filesToProcess.length}...`;
        }
        const result = await ImageUtils.compressImage(file);
        productPhotos.push({
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          type: 'new',
          blob: result.blob,
          previewUrl: result.previewUrl,
          sizeText: `${result.originalSizeText} → ${result.compressedSizeText}`
        });
        isImageChanged = true;
        successCount++;
      } catch (err) {
        console.error('Compress error for file:', file.name, err);
        if (typeof showToast === 'function') {
          showToast(`Gagal memproses ${file.name}: ${err.message}`, 'error');
        }
      }
    }

    if (compInfo && compText) {
      if (successCount > 0) {
        const lastPhoto = productPhotos[productPhotos.length - 1];
        compText.textContent = successCount > 1 
          ? `${successCount} foto siap diunggah (WebP ≤ 1 MB)` 
          : `${lastPhoto.sizeText} (WebP)`;
        compInfo.classList.remove('hidden');
      } else {
        compInfo.classList.add('hidden');
      }
    }

    e.target.value = ''; // Reset input agar pengguna bisa memilih file/kamera berulang kali
    renderPhotoGallery();
  }

  function isValidChannelUrl(val) {
    if (!val) return false;
    const s = String(val).trim();
    if (/^https?:\/\/.+/i.test(s)) return true;
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/i.test(s);
  }

  function formatChannelUrl(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (!isValidChannelUrl(s)) return null;
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  }

  function getChannelBadgeConfig(channel, link) {
    const ch = String(channel || 'Offline').trim();
    const hasLink = Boolean(link && String(link).trim());

    switch (ch) {
      case 'Shopee':
        return {
          label: 'Shopee',
          icon: 'external-link',
          badgeClasses: 'bg-[#EE4D2D]/15 text-[#EE4D2D] border-[#EE4D2D]/30 hover:bg-[#EE4D2D]/25',
          iconColor: 'text-[#EE4D2D]',
          hasLink
        };
      case 'Tokopedia':
        return {
          label: 'Tokopedia',
          icon: 'external-link',
          badgeClasses: 'bg-[#03AC0E]/15 text-[#00AA5B] border-[#03AC0E]/30 hover:bg-[#03AC0E]/25',
          iconColor: 'text-[#00AA5B]',
          hasLink
        };
      case 'TikTok':
      case 'TikTok Shop':
        return {
          label: 'TikTok Shop',
          icon: 'external-link',
          badgeClasses: 'bg-[#00F2FE]/10 text-[#00F2FE] border-[#00F2FE]/25 hover:bg-[#00F2FE]/20',
          iconColor: 'text-[#00F2FE]',
          hasLink
        };
      case 'Lazada':
        return {
          label: 'Lazada',
          icon: 'external-link',
          badgeClasses: 'bg-[#0088CC]/15 text-[#32ADE6] border-[#0088CC]/30 hover:bg-[#0088CC]/25',
          iconColor: 'text-[#32ADE6]',
          hasLink
        };
      case 'WhatsApp':
        return {
          label: 'WhatsApp',
          icon: 'external-link',
          badgeClasses: 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/25',
          iconColor: 'text-[#25D366]',
          hasLink
        };
      case 'Offline':
      default:
        return hasLink ? {
          label: 'Link Etalase',
          icon: 'external-link',
          badgeClasses: 'bg-white/5 text-[#32ADE6] border-white/10 hover:bg-white/10',
          iconColor: 'text-[#32ADE6]',
          hasLink: true
        } : null;
    }
  }

  function renderChannelBadgeHtml(channel, link, channels = null) {
    let channelList = [];
    if (Array.isArray(channels) && channels.length > 0) {
      channelList = channels.filter(c => c && c.channel);
    } else {
      const parser = (typeof parseItemChannels === 'function')
        ? parseItemChannels
        : ((typeof Api !== 'undefined' && Api.items?.parseItemChannels) ? Api.items.parseItemChannels : null);
      if (typeof parser === 'function') {
        const parsed = parser(channel, link, null);
        if (Array.isArray(parsed) && parsed.length > 0) {
          channelList = parsed;
        }
      }
      if (channelList.length === 0 && (channel || link)) {
        channelList = [{ channel: channel || 'Offline', link: link || '' }];
      }
    }

    if (!channelList || channelList.length === 0) return '';

    return channelList.map(item => {
      const cfg = getChannelBadgeConfig(item.channel, item.link);
      if (!cfg) return '';
      if (cfg.hasLink) {
        return `
          <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition active:scale-95 shadow-sm ${cfg.badgeClasses}" title="Buka etalase produk di ${escapeHtml(cfg.label)}">
            <span>${escapeHtml(cfg.label)}</span>
            <i data-lucide="external-link" class="w-3 h-3 opacity-80" aria-hidden="true"></i>
          </a>
        `;
      }
      return `
        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.badgeClasses}">
          <span>${escapeHtml(cfg.label)}</span>
        </span>
      `;
    }).join(' ');
  }

  const AVAILABLE_CHANNELS = ['Offline', 'Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'WhatsApp'];
  let itemChannelsState = [];

  function syncLegacyChannelInputs() {
    const chSelect = document.getElementById('item-channel');
    const chLink = document.getElementById('item-channel-link');
    const btnOpen = document.getElementById('btn-open-channel-link');

    const first = (Array.isArray(itemChannelsState) && itemChannelsState[0]) || { channel: 'Offline', link: '' };
    if (chSelect) chSelect.value = first.channel || 'Offline';
    if (chLink) chLink.value = first.link || '';
    if (btnOpen) {
      const formatted = formatChannelUrl(first.link);
      if (formatted) {
        btnOpen.href = formatted;
        btnOpen.classList.remove('hidden');
        btnOpen.classList.add('inline-flex');
      } else {
        btnOpen.classList.add('hidden');
        btnOpen.classList.remove('inline-flex');
        btnOpen.href = '#';
      }
    }
  }

  function bindItemChannelRowEvents() {
    const container = document.getElementById('item-channels-list');
    if (!container) return;

    container.querySelectorAll('.item-channel-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        if (itemChannelsState[idx]) {
          itemChannelsState[idx].channel = e.target.value;
          syncLegacyChannelInputs();
        }
      });
    });

    container.querySelectorAll('.item-channel-url').forEach(inp => {
      const handleUrlInput = (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const val = e.target.value.trim();
        if (itemChannelsState[idx]) {
          itemChannelsState[idx].link = val;
        }
        const row = e.target.closest('.channel-row');
        if (row) {
          const openBtn = row.querySelector('.btn-channel-row-open');
          const formatted = formatChannelUrl(val);
          if (openBtn) {
            if (formatted) {
              openBtn.href = formatted;
              openBtn.classList.remove('hidden');
              openBtn.classList.add('inline-flex');
            } else {
              openBtn.classList.add('hidden');
              openBtn.classList.remove('inline-flex');
              openBtn.href = '#';
            }
          }
        }
        syncLegacyChannelInputs();
      };
      inp.addEventListener('input', handleUrlInput);
      inp.addEventListener('change', handleUrlInput);
    });

    container.querySelectorAll('.btn-channel-row-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.currentTarget.closest('.channel-row');
        const idx = Number(row?.getAttribute('data-index') ?? e.currentTarget.getAttribute('data-index'));
        if (!isNaN(idx) && idx >= 0 && idx < itemChannelsState.length) {
          itemChannelsState.splice(idx, 1);
          renderItemChannelsList();
        }
      });
    });
  }

  function renderItemChannelsList() {
    const container = document.getElementById('item-channels-list');
    if (!container) return;

    if (!Array.isArray(itemChannelsState) || itemChannelsState.length === 0) {
      container.innerHTML = `
        <div class="p-3 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <p class="text-xs text-[#A0A0A5]">Belum ada saluran penjualan ditambahkan.</p>
          <button type="button" class="mt-1.5 text-xs text-[#32ADE6] hover:underline font-medium cursor-pointer inline-flex items-center gap-1" onclick="window.addItemChannelRow && window.addItemChannelRow()">
            <i data-lucide="plus" class="w-3 h-3"></i> Tambah Saluran Pertama
          </button>
        </div>
      `;
      syncLegacyChannelInputs();
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    container.innerHTML = itemChannelsState.map((ch, idx) => {
      const channelVal = ch.channel || 'Offline';
      const linkVal = ch.link || '';
      const formattedLink = formatChannelUrl(linkVal);
      const hasValidLink = Boolean(formattedLink);

      const optionsHtml = AVAILABLE_CHANNELS.map(opt => `
        <option value="${escapeHtml(opt)}" ${opt === channelVal ? 'selected' : ''}>${escapeHtml(opt)}</option>
      `).join('');

      return `
        <div class="channel-row p-2.5 bg-white/[0.02] border border-white/10 hover:border-white/20 rounded-xl flex flex-col sm:flex-row sm:items-center gap-2 transition" data-index="${idx}">
          <div class="w-full sm:w-44 shrink-0">
            <select class="item-channel-select w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#0088CC] focus:outline-none transition cursor-pointer" data-index="${idx}" aria-label="Pilih Saluran Penjualan">
              ${optionsHtml}
            </select>
          </div>
          <div class="flex-1 min-w-0">
            <input type="url" class="item-channel-url w-full bg-[#1C1C1E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#636366] focus:border-[#0088CC] focus:outline-none transition" placeholder="Masukkan URL produk (mis. shopee.co.id/...)" value="${escapeHtml(linkVal)}" data-index="${idx}" aria-label="URL Produk Saluran">
          </div>
          <div class="flex items-center gap-1.5 shrink-0 justify-end sm:justify-start">
            <a href="${hasValidLink ? escapeHtml(formattedLink) : '#'}" target="_blank" rel="noopener noreferrer" class="btn-channel-row-open ${hasValidLink ? 'inline-flex' : 'hidden'} px-2.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:text-[#32ADE6] rounded-lg text-xs font-medium items-center gap-1 transition active:scale-95" title="Buka Link Produk" data-index="${idx}">
              <i data-lucide="external-link" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span class="hidden md:inline text-[11px]">Buka</span>
            </a>
            <button type="button" class="btn-channel-row-delete p-2 rounded-lg text-[#A0A0A5] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 border border-transparent hover:border-[#FF3B30]/20 transition cursor-pointer active:scale-95" title="Hapus Saluran" data-index="${idx}" aria-label="Hapus Saluran">
              <i data-lucide="trash-2" class="w-3.5 h-3.5" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    syncLegacyChannelInputs();
    bindItemChannelRowEvents();

    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
  }

  function addItemChannelRow() {
    if (!Array.isArray(itemChannelsState)) itemChannelsState = [];
    const used = itemChannelsState.map(c => c.channel);
    const nextCh = AVAILABLE_CHANNELS.find(ch => ch !== 'Offline' && !used.includes(ch)) || 'Shopee';
    itemChannelsState.push({ channel: nextCh, link: '' });
    renderItemChannelsList();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.item-channel-url');
      if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
      }
    }, 50);
  }
  window.addItemChannelRow = addItemChannelRow;

  function openAddItemModal() {
    const form = document.getElementById('item-form');
    if (form) form.reset();
    const unitSelect = document.getElementById('item-unit');
    const defaultUnit = unitsData.find(unit => unit.name.toLowerCase() === 'pcs') || unitsData[0];
    if (unitSelect && defaultUnit) unitSelect.value = String(defaultUnit.id);
    resetImageForm();
    document.getElementById('item-id').value = '';
    const stockInput = document.getElementById('item-stock');
    if (stockInput) {
      stockInput.value = '0';
      stockInput.readOnly = true;
      stockInput.disabled = false;
    }
    const stockLabel = document.getElementById('item-stock-label');
    if (stockLabel) stockLabel.textContent = 'Stok Awal (0)';
    const stockHelp = document.getElementById('item-stock-help');
    if (stockHelp) stockHelp.textContent = 'Stok awal produk baru selalu dimulai dari 0. Penambahan stok dicatat melalui menu Barang Masuk.';
    document.getElementById('item-stock-adjustment-action')?.classList.add('hidden');
    const supWrap = document.getElementById('item-supplier-wrap');
    if (supWrap) supWrap.classList.add('hidden');
    const supSel = document.getElementById('item-supplier-id');
    if (supSel) supSel.value = '';

    const warnBanner = document.getElementById('item-stock-warning-banner');
    if (warnBanner) warnBanner.classList.add('hidden');

    itemChannelsState = [{ channel: 'Shopee', link: '' }];
    renderItemChannelsList();

    const channelSelect = document.getElementById('item-channel');
    if (channelSelect) channelSelect.value = 'Offline';
    const channelLinkInput = document.getElementById('item-channel-link');
    if (channelLinkInput) channelLinkInput.value = '';
    const btnOpenChannel = document.getElementById('btn-open-channel-link');
    if (btnOpenChannel) {
      btnOpenChannel.classList.add('hidden');
      btnOpenChannel.classList.remove('inline-flex');
      btnOpenChannel.href = '#';
    }

    document.getElementById('modal-item-title').textContent = 'Tambah Barang';
    const submitBtn = document.getElementById('btn-submit-item');
    if (submitBtn) {
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Simpan Produk';
    }
    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    loadCategories();
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
    setTimeout(function () {
      const skuInput = document.getElementById('item-sku');
      if (skuInput) skuInput.focus();
    }, 50);
  }

  function autoGenerateSkuForItem() {
    const catSelect = document.getElementById('item-category');
    const catName = (catSelect && catSelect.selectedIndex >= 0 && catSelect.value) ? catSelect.options[catSelect.selectedIndex].text : '';
    const brand = document.getElementById('item-brand')?.value.trim() || '';
    let maxSeq = 0;
    if (Array.isArray(currentItems)) {
      for (const item of currentItems) {
        if (item.id && Number(item.id) > maxSeq) {
          maxSeq = Number(item.id);
        }
        if (item.sku) {
          const m = String(item.sku).match(/(\d+)$/);
          if (m) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num) && num > maxSeq) maxSeq = num;
          }
        }
      }
    }
    const genSku = typeof generateSKU === 'function' ? generateSKU(catName, brand, maxSeq) : (typeof window.generateSKU === 'function' ? window.generateSKU(catName, brand, maxSeq) : `ITEM-${maxSeq + 1}`);
    const skuInput = document.getElementById('item-sku');
    if (skuInput) skuInput.value = genSku;
    return genSku;
  }

  function openEditItemModal(id) {
    const item = currentItems.find(function (i) { return String(i.id) === String(id); });
    if (!item) return;

    resetImageForm();
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-sku').value = item.sku || '';
    document.getElementById('item-barcode').value = item.barcode || '';
    document.getElementById('item-brand').value = item.brand && item.brand !== '-' ? item.brand : '';
    document.getElementById('item-name').value = item.name || '';
    document.getElementById('item-stock').value = item.stock || 0;
    document.getElementById('item-stock').disabled = true;
    document.getElementById('item-stock-label').textContent = 'Stok Saat Ini';
    document.getElementById('item-stock-help').textContent = 'Sesuaikan stok via Stock Opname.';
    document.getElementById('item-stock-adjustment-action')?.classList.remove('hidden');
    const supWrap = document.getElementById('item-supplier-wrap');
    if (supWrap) supWrap.classList.add('hidden');
    const warnBanner = document.getElementById('item-stock-warning-banner');
    if (warnBanner) warnBanner.classList.add('hidden');
    document.getElementById('item-cost-price').value = item.cost_price || 0;
    document.getElementById('item-sell-price').value = item.sell_price || 0;
    document.getElementById('item-min-stock').value = item.min_stock || 3;

    const getLocalMeta = (typeof window !== 'undefined' && window.getLocalChannelMeta) ? window.getLocalChannelMeta : (typeof Api !== 'undefined' && Api.items?.getLocalChannelMeta ? Api.items.getLocalChannelMeta : null);
    const localMeta = typeof getLocalMeta === 'function' ? getLocalMeta(item.id, item.sku) : null;
    const parser = (typeof window !== 'undefined' && window.parseItemChannels) ? window.parseItemChannels : (typeof Api !== 'undefined' && Api.items?.parseItemChannels ? Api.items.parseItemChannels : null);

    let existingChannels = (Array.isArray(item.channels) && item.channels.length > 0)
      ? item.channels
      : (typeof parser === 'function' ? parser(item.channel, item.channel_link, localMeta) : []);

    if (!existingChannels || existingChannels.length === 0) {
      const effectiveChannel = (item.channel && item.channel !== 'Offline') ? item.channel : ((localMeta && localMeta.channel) || item.channel || 'Offline');
      const effectiveLink = (item.channel_link || (localMeta && localMeta.channel_link) || '').trim();
      existingChannels = [{ channel: effectiveChannel, link: effectiveLink }];
    }

    itemChannelsState = existingChannels.map(c => ({ channel: c.channel || 'Offline', link: c.link || '' }));
    renderItemChannelsList();

    const existingImages = parseProductImages(item.images || item.image_url);
    if (existingImages.length > 0) {
      existingImages.forEach((url, i) => {
        productPhotos.push({
          id: 'existing_' + i + '_' + Math.random().toString(36).substr(2, 6),
          type: 'existing',
          url: url,
          previewUrl: url
        });
      });
      renderPhotoGallery();
    }
    isImageChanged = false;

    document.getElementById('modal-item-title').textContent = 'Edit Barang';
    const submitBtn = document.getElementById('btn-submit-item');
    if (submitBtn) {
      const span = submitBtn.querySelector('span');
      if (span) span.textContent = 'Perbarui Produk';
    }

    loadCategories().then(function () {
      if (item.category_id) {
        document.getElementById('item-category').value = item.category_id;
      }
      if (item.unit_id) {
        document.getElementById('item-unit').value = item.unit_id;
      }
    });

    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
    setTimeout(function () {
      const nameInput = document.getElementById('item-name');
      if (nameInput) nameInput.focus();
    }, 50);
  }

  function closeItemModal() {
    const modal = document.getElementById('modal-item');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function handleItemSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isSubmittingItem) return;
    isSubmittingItem = true;

    const btnSubmit = document.getElementById('btn-submit-item');
    const originalBtnContent = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
    }

    try {
      const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
      if (role === 'VIEWER') {
        alert('Anda tidak punya akses untuk mengubah data.');
        return;
      }

      const id = document.getElementById('item-id').value;
      let sku = document.getElementById('item-sku').value.trim();
      const barcode = document.getElementById('item-barcode').value.trim();
      const name = document.getElementById('item-name').value.trim();
      const brand = document.getElementById('item-brand').value.trim();
      const category_id = document.getElementById('item-category').value;
      const unit_id = document.getElementById('item-unit').value;
      const stock = Number(document.getElementById('item-stock').value);
      const cost_price = Number(document.getElementById('item-cost-price').value);
      const sell_price = Number(document.getElementById('item-sell-price').value);
      const min_stock = Number(document.getElementById('item-min-stock').value);

      // Read current values directly from DOM rows to capture latest edits
      const channelRows = document.querySelectorAll('#item-channels-list .channel-row');
      const channelsPayload = [];
      let hasInvalidUrl = false;

      if (channelRows.length > 0) {
        channelRows.forEach((row, i) => {
          const sel = row.querySelector('.item-channel-select');
          const inp = row.querySelector('.item-channel-url');
          const chName = sel ? sel.value : (itemChannelsState[i]?.channel || 'Offline');
          const rawLink = inp ? inp.value.trim() : (itemChannelsState[i]?.link || '').trim();

          if (rawLink) {
            const validated = formatChannelUrl(rawLink);
            if (!validated) {
              hasInvalidUrl = true;
            } else {
              channelsPayload.push({ channel: chName, link: validated });
            }
          } else if (chName && chName !== 'Offline') {
            channelsPayload.push({ channel: chName, link: '' });
          }
        });
      } else if (Array.isArray(itemChannelsState) && itemChannelsState.length > 0) {
        itemChannelsState.forEach(c => {
          if (!c) return;
          const chName = c.channel || 'Offline';
          const rawLink = (c.link || '').trim();
          if (rawLink) {
            const validated = formatChannelUrl(rawLink);
            if (!validated) {
              hasInvalidUrl = true;
            } else {
              channelsPayload.push({ channel: chName, link: validated });
            }
          } else if (chName && chName !== 'Offline') {
            channelsPayload.push({ channel: chName, link: '' });
          }
        });
      } else {
        const legacySelect = document.getElementById('item-channel');
        const legacyLinkInput = document.getElementById('item-channel-link');
        const legacyCh = legacySelect ? legacySelect.value : 'Offline';
        const legacyLk = legacyLinkInput ? legacyLinkInput.value.trim() : '';
        if (legacyLk) {
          const validated = formatChannelUrl(legacyLk);
          if (!validated) {
            hasInvalidUrl = true;
          } else {
            channelsPayload.push({ channel: legacyCh, link: validated });
          }
        } else if (legacyCh && legacyCh !== 'Offline') {
          channelsPayload.push({ channel: legacyCh, link: '' });
        }
      }

      if (hasInvalidUrl) {
        if (typeof showToast === 'function') {
          showToast('Salah satu tautan produk tidak valid. Masukkan link atau domain lengkap (mis. shopee.co.id/...)', 'warning');
        }
        return;
      }

      const primaryChannel = (channelsPayload[0]?.channel) || 'Offline';
      const primaryChannelLink = (channelsPayload.length > 1)
        ? JSON.stringify(channelsPayload)
        : (channelsPayload[0]?.link || null);

      if (!name) {
        if (typeof showToast === 'function') showToast('Nama barang tidak boleh kosong', 'error');
        return;
      }

      // Validasi Anti-Duplikasi Nama Produk (cegah double input / barang ganda)
      const trimmedNameLower = name.toLowerCase();
      const duplicateName = currentItems.find(function (i) {
        return (i.name || '').trim().toLowerCase() === trimmedNameLower && (!id || String(i.id) !== String(id));
      });
      if (duplicateName) {
        if (typeof showToast === 'function') {
          showToast('Produk dengan nama "' + name + '" sudah terdaftar di sistem', 'error');
        }
        return;
      }

      if (!sku) {
        sku = autoGenerateSkuForItem();
      }
      if (!sku) {
        if (typeof showToast === 'function') showToast('SKU barang wajib diisi', 'error');
        return;
      }
      if (cost_price < 0 || sell_price < 0) {
        if (typeof showToast === 'function') showToast('Harga beli dan harga jual harus >= 0', 'error');
        return;
      }
      if (!id && stock < 0) {
        if (typeof showToast === 'function') showToast('Stok harus >= 0', 'error');
        return;
      }

      const duplicate = currentItems.find(function (i) {
        return String(i.sku || '').toLowerCase() === sku.toLowerCase() && (!id || String(i.id) !== String(id));
      });
      if (duplicate) {
        if (typeof showToast === 'function') showToast('SKU "' + sku + '" sudah digunakan oleh produk lain', 'error');
        return;
      }

      const duplicateBarcode = barcode && currentItems.find(function (i) {
        return (i.barcode || '').trim() === barcode && (!id || String(i.id) !== String(id));
      });
      if (duplicateBarcode) {
        if (typeof showToast === 'function') showToast('Barcode "' + barcode + '" sudah digunakan oleh produk lain', 'error');
        return;
      }

      // 1. Upload foto ke Storage jika ada foto baru
      if (btnSubmit) btnSubmit.innerHTML = '<span>Menyiapkan Foto...</span>';

      const finalUrls = [];
      const newPhotos = productPhotos.filter(p => p.type === 'new');
      let uploadedCount = 0;

      for (let i = 0; i < productPhotos.length; i++) {
        const photo = productPhotos[i];
        if (photo.type === 'existing' && photo.url) {
          finalUrls.push(photo.url);
        } else if (photo.type === 'new' && photo.blob) {
          uploadedCount++;
          if (btnSubmit) btnSubmit.innerHTML = `<span>Mengunggah Foto (${uploadedCount}/${newPhotos.length})...</span>`;
          const cleanSku = (sku || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
          const imagePath = `${cleanSku}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.webp`;

          const uploadRes = await Api.storage.uploadImage(photo.blob, imagePath);
          if (!uploadRes.ok) {
            if (typeof showToast === 'function') {
              showToast(uploadRes.error?.message || 'Gagal mengunggah foto ke storage', 'error');
            }
            return;
          }
          photo.url = uploadRes.data.publicUrl;
          photo.type = 'existing';
          finalUrls.push(uploadRes.data.publicUrl);
        }
      }

      let finalImageUrl = null;
      if (finalUrls.length === 1) {
        finalImageUrl = finalUrls[0];
      } else if (finalUrls.length > 1) {
        finalImageUrl = JSON.stringify(finalUrls);
      }

      if (btnSubmit) btnSubmit.innerHTML = '<span>Menyimpan Produk...</span>';

      const payload = {
        sku: sku,
        barcode: barcode || null,
        name: name,
        brand: brand || null,
        category_id: category_id ? Number(category_id) : null,
        unit_id: Number(unit_id),
        channel: primaryChannel,
        channel_link: primaryChannelLink,
        channels: channelsPayload,
        cost_price: cost_price,
        sell_price: sell_price,
        min_stock: min_stock,
        image_url: finalImageUrl,
        images: finalUrls
      };
      let res;
      if (id) {
        res = await Api.items.update(id, payload);
      } else {
        // Master Barang (katalog): Stok produk baru selalu berawal dari 0
        // Penambahan stok fisik dilakukan melalui menu Barang Masuk untuk menghindari dobel stok
        payload.stock = 0;
        res = await Api.items.create(payload);
      }

      if (!res.ok) {
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal menyimpan data ke Supabase', 'error');
        }
        return;
      }

      const saveLocal = (typeof window !== 'undefined' && window.saveLocalChannelMeta) ? window.saveLocalChannelMeta : (typeof Api !== 'undefined' && Api.items?.saveLocalChannelMeta ? Api.items.saveLocalChannelMeta : null);
      if (typeof saveLocal === 'function') {
        const savedId = id || (res?.data && res.data.id) || null;
        saveLocal(savedId, sku, primaryChannel, primaryChannelLink, channelsPayload);
      }

      closeItemModal();
      if (typeof showToast === 'function') {
        showToast(id ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan', 'success');
      }
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan sistem', 'error');
      }
    } finally {
      isSubmittingItem = false;
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnContent;
      }
    }
  }

  async function openDeleteItemModal(id) {
    const item = currentItems.find(function (i) { return String(i.id) === String(id); });
    if (!item) return;

    itemToDeleteId = item.id;
    document.getElementById('delete-item-name').textContent = item.name + ' (' + item.sku + ')';

    const warningEl = document.getElementById('delete-item-warning');
    const forceCheckbox = document.getElementById('check-force-delete');
    const btnConfirm = document.getElementById('btn-confirm-delete');

    if (warningEl) warningEl.classList.add('hidden');
    if (forceCheckbox) forceCheckbox.checked = false;
    if (btnConfirm) {
      const span = btnConfirm.querySelector('span');
      if (span) span.textContent = 'Hapus';
    }

    const modal = document.getElementById('modal-delete');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();

    // Periksa apakah produk terkait dengan riwayat transaksi/PO/retur
    try {
      if (Api.items?.checkDeletable) {
        const checkRes = await Api.items.checkDeletable([id]);
        if (checkRes.ok && checkRes.data && checkRes.data.skippedIds && checkRes.data.skippedIds.includes(String(id))) {
          if (warningEl) warningEl.classList.remove('hidden');
          if (btnConfirm) {
            const span = btnConfirm.querySelector('span');
            if (span) span.textContent = 'Hapus Bersih';
          }
          if (typeof window.refreshIcons === 'function') window.refreshIcons();
        }
      }
    } catch (_) {}
  }

  function closeDeleteModal() {
    itemToDeleteId = null;
    const modal = document.getElementById('modal-delete');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  let selectedAdjustmentProduct = null;

  function openStockAdjustmentModal(productId) {
    let item = currentItems.find(i => String(i.id) === String(productId));
    if (!item) {
      item = {
        id: productId,
        name: 'Produk',
        sku: '-',
        category: 'Umum',
        unit: 'pcs',
        stock: 0
      };
    }

    selectedAdjustmentProduct = item;
    const idInput = document.getElementById('adj-product-id');
    if (idInput) idInput.value = item.id;

    const nameEl = document.getElementById('adj-product-name');
    if (nameEl) nameEl.textContent = item.name || 'Produk';

    const skuEl = document.getElementById('adj-product-sku');
    if (skuEl) skuEl.textContent = item.sku || '-';

    const catEl = document.getElementById('adj-product-cat');
    if (catEl) catEl.textContent = item.category || 'Umum';

    const unitEl = document.getElementById('adj-product-unit');
    if (unitEl) unitEl.textContent = item.unit || 'pcs';

    const unitLabelCur = document.getElementById('adj-unit-label-current');
    if (unitLabelCur) unitLabelCur.textContent = item.unit || 'pcs';

    const actualUnit = document.getElementById('stock-opname-count-unit');
    if (actualUnit) actualUnit.textContent = item.unit || 'pcs';

    const curStockEl = document.getElementById('adj-current-stock');
    if (curStockEl) curStockEl.textContent = String(item.stock ?? 0);

    const actualInput = document.getElementById('adj-actual-stock');
    if (actualInput) {
      actualInput.value = String(item.stock ?? 0);
    }

    const reasonSel = document.getElementById('adj-reason');
    if (reasonSel) reasonSel.value = 'Koreksi Salah Input / Dobel';

    const notesInput = document.getElementById('adj-notes');
    if (notesInput) notesInput.value = '';

    calculateAdjustmentDifference();
    switchStockOpnameView('form');

    const modal = document.getElementById('modal-stock-adjustment');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
    setTimeout(() => actualInput?.focus(), 50);
  }

  function switchStockOpnameView(view) {
    const formView = document.getElementById('stock-opname-view-form');
    const historyView = document.getElementById('stock-opname-view-history');
    if (view === 'history') {
      if (formView) formView.classList.add('hidden');
      if (historyView) {
        historyView.classList.remove('hidden');
        historyView.classList.add('flex');
      }
    } else {
      if (historyView) {
        historyView.classList.add('hidden');
        historyView.classList.remove('flex');
      }
      if (formView) {
        formView.classList.remove('hidden');
        formView.classList.add('flex');
      }
    }
    if (typeof window.refreshIcons === 'function') {
      const modal = document.getElementById('modal-stock-adjustment');
      window.refreshIcons(modal);
    }
  }

  function closeStockAdjustmentModal() {
    selectedAdjustmentProduct = null;
    const modal = document.getElementById('modal-stock-adjustment');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    switchStockOpnameView('form');
  }

  async function openStockAdjustmentHistory(productIdOverride = null) {
    const chosenId = productIdOverride ?? document.getElementById('adj-product-id')?.value ?? selectedAdjustmentProduct?.id;
    let targetProduct = selectedAdjustmentProduct;

    if (!targetProduct && chosenId != null && Array.isArray(currentItems)) {
      targetProduct = currentItems.find(item => String(item.id) === String(chosenId)) || null;
    }

    if (!targetProduct && chosenId != null) {
      targetProduct = { id: chosenId, name: 'Produk', sku: '-' };
    }

    if (!targetProduct) return;
    selectedAdjustmentProduct = targetProduct;

    // Pastikan modal stock opname aktif dan beralih ke view riwayat
    const modalStockAdj = document.getElementById('modal-stock-adjustment');
    if (modalStockAdj) {
      modalStockAdj.classList.remove('hidden');
      modalStockAdj.classList.add('flex');
    }
    switchStockOpnameView('history');

    // Update info produk di header riwayat
    const histProductName = document.getElementById('adj-history-product-name');
    if (histProductName) {
      histProductName.textContent = `${targetProduct.name || 'Produk'} (${targetProduct.sku || '-'})`;
    }
    const histCurStock = document.getElementById('adj-history-current-stock');
    if (histCurStock) {
      histCurStock.textContent = `${targetProduct.stock ?? 0} ${targetProduct.unit || 'pcs'}`;
    }
    const histSkuBadge = document.getElementById('adj-history-sku-badge');
    if (histSkuBadge) {
      histSkuBadge.textContent = targetProduct.sku || '-';
    }

    // Elemen kompatibilitas untuk modal lama & testing
    let modalLegacy = document.getElementById('modal-stock-adjustment-history');
    let title = document.getElementById('stock-adjustment-history-product');
    if (!title && modalLegacy) {
      title = document.createElement('p');
      title.id = 'stock-adjustment-history-product';
      modalLegacy.appendChild(title);
    }
    if (title) {
      title.textContent = `${targetProduct.name || 'Produk'} (${targetProduct.sku || '-'})`;
    }

    let tbody = document.getElementById('stock-adjustment-history-body');
    if (!tbody && modalLegacy) {
      tbody = document.createElement('tbody');
      tbody.id = 'stock-adjustment-history-body';
      const table = document.createElement('table');
      table.appendChild(tbody);
      modalLegacy.appendChild(table);
    }

    let empty = document.getElementById('stock-adjustment-history-empty');
    let errorEl = document.getElementById('stock-adjustment-history-error');
    let loadingEl = document.getElementById('stock-adjustment-history-loading');
    let timelineList = document.getElementById('stock-adjustment-timeline-list');

    if (tbody) tbody.innerHTML = '';
    if (timelineList) timelineList.innerHTML = '';
    if (empty) empty.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');

    try {
      const itemsApi = (typeof Api !== 'undefined' && Api.items) ? Api.items : (window.Api && window.Api.items);
      const result = await itemsApi.getStockAdjustments(targetProduct.id);
      if (!result.ok) throw new Error(result.error?.message || 'Gagal memuat riwayat penyesuaian.');

      const adjustments = Array.isArray(result.data) ? result.data : [];
      if (loadingEl) loadingEl.classList.add('hidden');

      if (adjustments.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
      }

      // Render kartu linimasa modern (Audit Timeline Cards)
      if (timelineList) {
        timelineList.innerHTML = adjustments.map((adjustment) => {
          const diff = Number(adjustment.difference || 0);
          const createdAt = new Date(adjustment.created_at);
          const dateText = Number.isNaN(createdAt.getTime())
            ? '-'
            : createdAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
          const userName = typeof window.resolveUserName === 'function'
            ? window.resolveUserName(adjustment.created_by)
            : (adjustment.created_by || 'Petugas');
          const unit = targetProduct.unit || 'pcs';

          let diffBadgeClass = 'bg-white/10 text-[#A0A0A5] border-white/10';
          let diffIcon = 'arrow-right';
          let diffPrefix = '';
          if (diff > 0) {
            diffBadgeClass = 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/30';
            diffIcon = 'trending-up';
            diffPrefix = '+';
          } else if (diff < 0) {
            diffBadgeClass = 'bg-[#FF3B30]/15 text-[#FF3B30] border-[#FF3B30]/30';
            diffIcon = 'trending-down';
          }

          const reason = escapeHtml(adjustment.reason || 'Koreksi Stok');
          const notes = adjustment.notes ? escapeHtml(adjustment.notes) : null;

          return `
            <div class="p-4 rounded-xl bg-[#232326] border border-white/5 hover:border-white/10 transition space-y-2.5">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-white">${escapeHtml(dateText)}</span>
                  <span class="inline-flex items-center gap-1 text-[11px] text-[#A0A0A5] bg-white/5 px-2 py-0.5 rounded-full">
                    <i data-lucide="user" class="w-3 h-3 text-[#32ADE6]"></i>
                    <span>${escapeHtml(userName)}</span>
                  </span>
                </div>
                <span class="inline-flex items-center gap-1 text-[11px] font-medium bg-[#0088CC]/10 text-[#63C8FF] border border-[#0088CC]/20 px-2 py-0.5 rounded-lg">
                  <i data-lucide="tag" class="w-3 h-3"></i>
                  <span>${reason}</span>
                </span>
              </div>

              <div class="flex items-center justify-between pt-1 border-t border-white/5">
                <div class="text-xs text-[#A0A0A5]">
                  <span>Sistem: <strong class="text-white">${escapeHtml(String(adjustment.previous_stock))}</strong></span>
                  <span class="mx-1 text-white/30">→</span>
                  <span>Fisik: <strong class="text-white">${escapeHtml(String(adjustment.actual_stock))}</strong> ${escapeHtml(unit)}</span>
                </div>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${diffBadgeClass}">
                  <i data-lucide="${diffIcon}" class="w-3 h-3"></i>
                  <span>${diffPrefix}${escapeHtml(String(diff))} ${escapeHtml(unit)}</span>
                </span>
              </div>

              ${notes ? `
                <div class="text-xs text-[#D1D1D6] bg-black/25 border-l-2 border-[#0088CC] rounded-r-lg px-3 py-1.5 italic">
                  "${notes}"
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }

      // Populate tbody untuk kompatibilitas test
      if (tbody) {
        tbody.innerHTML = adjustments.map((adjustment) => {
          const difference = Number(adjustment.difference);
          const createdAt = new Date(adjustment.created_at);
          const dateText = Number.isNaN(createdAt.getTime())
            ? '-'
            : createdAt.toLocaleString('id-ID');
          const userName = typeof window.resolveUserName === 'function'
            ? window.resolveUserName(adjustment.created_by)
            : (adjustment.created_by || '-');
          const reasonAndNotes = [adjustment.reason, adjustment.notes].filter(Boolean).join(' - ');
          return `
            <tr>
              <td class="py-2 pr-3 whitespace-nowrap">${escapeHtml(dateText)}</td>
              <td class="py-2 pr-3">${escapeHtml(String(adjustment.previous_stock))}</td>
              <td class="py-2 pr-3">${escapeHtml(String(adjustment.actual_stock))}</td>
              <td class="py-2 pr-3 ${difference < 0 ? 'text-[#FF453A]' : 'text-[#34C759]'}">${difference > 0 ? '+' : ''}${escapeHtml(String(difference))}</td>
              <td class="py-2 pr-3">${escapeHtml(reasonAndNotes)}</td>
              <td class="py-2">${escapeHtml(userName || '-')}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (error) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) {
        errorEl.textContent = error.message || 'Gagal memuat riwayat penyesuaian.';
        errorEl.classList.remove('hidden');
      }
    }

    if (typeof window.refreshIcons === 'function') {
      const modal = document.getElementById('modal-stock-adjustment');
      window.refreshIcons(modal);
    }
  }

  function closeStockAdjustmentHistory() {
    switchStockOpnameView('form');
    const modal = document.getElementById('modal-stock-adjustment-history');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function calculateAdjustmentDifference() {
    if (!selectedAdjustmentProduct) return;
    const currentStock = Number(selectedAdjustmentProduct.stock || 0);
    const actualInput = document.getElementById('adj-actual-stock');
    const actualStock = Number(actualInput?.value || 0);
    const unit = selectedAdjustmentProduct.unit || 'pcs';

    const diff = actualStock - currentStock;
    const badge = document.getElementById('adj-diff-badge');
    const box = document.getElementById('adj-diff-box');

    if (badge && box) {
      box.classList.remove('is-increase', 'is-decrease', 'is-balanced');
      if (diff === 0) {
        badge.textContent = `0 ${unit} (Tidak ada perubahan)`;
        box.classList.add('is-balanced');
      } else if (diff > 0) {
        badge.textContent = `+${diff} ${unit} (Stok Bertambah)`;
        box.classList.add('is-increase');
      } else {
        badge.textContent = `${diff} ${unit} (Stok Berkurang)`;
        box.classList.add('is-decrease');
      }
    }
  }

  async function handleStockAdjustmentSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const prodId = document.getElementById('adj-product-id')?.value;
    const actualStock = Number(document.getElementById('adj-actual-stock')?.value);
    const reason = document.getElementById('adj-reason')?.value || 'Stock Opname Fisik';
    const notes = document.getElementById('adj-notes')?.value.trim() || '';

    if (!prodId) return;
    if (isNaN(actualStock) || actualStock < 0) {
      if (typeof showToast === 'function') showToast('Stok fisik harus bernilai 0 atau lebih', 'error');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-adjustment');
    const originalContent = btnSubmit ? btnSubmit.innerHTML : '';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Menyimpan...</span>';
    }

    try {
      if (typeof Api.items?.adjustStock !== 'function') {
        throw new Error('Fitur adjustStock belum tersedia di modul Api.items');
      }

      const res = await Api.items.adjustStock(prodId, actualStock, reason, notes);
      if (!res.ok) {
        throw new Error(res.error?.message || 'Gagal menyimpan penyesuaian stok');
      }

      if (typeof showToast === 'function') {
        showToast(res.meta?.message || `Stok berhasil disesuaikan menjadi ${actualStock}`, 'success');
      }

      closeStockAdjustmentModal();
      await loadItemsFromBackend();
    } catch (err) {
      console.error('Adjustment error:', err);
      if (typeof showToast === 'function') {
        showToast(err.message || 'Terjadi kesalahan saat menyesuaikan stok', 'error');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  async function confirmDeleteItem() {
    if (!itemToDeleteId) return;

    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const force = Boolean(document.getElementById('check-force-delete')?.checked);
    const warningEl = document.getElementById('delete-item-warning');
    const isRestricted = warningEl && !warningEl.classList.contains('hidden');

    if (isRestricted && !force) {
      if (typeof showToast === 'function') {
        showToast('Centang konfirmasi pembersihan data terkait terlebih dahulu', 'info');
      }
      return;
    }

    const btn = document.getElementById('btn-confirm-delete');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const res = await Api.items.delete(itemToDeleteId, { force });
      if (!res.ok) {
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal menghapus produk dari Supabase', 'error');
        }
        btn.disabled = false;
        btn.innerHTML = originalContent;
        return;
      }

      closeDeleteModal();
      if (typeof showToast === 'function') {
        showToast(force ? 'Produk dan data terkait berhasil dibersihkan' : 'Produk berhasil dihapus', 'success');
      }
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast(err.message || 'Gagal menghapus produk', 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStockFilter = 'all';
  let selectedSort = 'name-asc'; // Default: Otomatis Nama A-Z
  let currentPage = 1;
  const pageSize = 10;
  let selectedItemIds = new Set();
  let bulkPriceMode = 'nominal'; // 'nominal' | 'percent'

  function filterItems() {
    const list = currentItems.filter(function (item) {
      // 1. Search text (name, SKU, barcode, brand, category)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchSku = (item.sku || '').toLowerCase().includes(q);
        const matchBarcode = (item.barcode || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBarcode && !matchBrand && !matchCat) return false;
      }
      // 2. Kategori filter
      if (selectedCategory && selectedCategory !== 'all') {
        if (String(item.category_id) !== String(selectedCategory)) return false;
      }
      // 3. Stok filter
      if (selectedStockFilter === 'low') {
        const stock = Number(item.stock) || 0;
        const minStock = Number(item.min_stock || item.minStock) || 0;
        if (!(stock > 0 && stock <= minStock)) return false;
      } else if (selectedStockFilter === 'out') {
        const stock = Number(item.stock) || 0;
        if (stock !== 0) return false;
      }
      return true;
    });

    // Otomatis urutkan data (default Nama A-Z)
    list.sort(function (a, b) {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      if (selectedSort === 'name-desc') {
        return nameB.localeCompare(nameA, 'id', { sensitivity: 'base', numeric: true });
      } else if (selectedSort === 'stock-asc') {
        return (Number(a.stock) || 0) - (Number(b.stock) || 0);
      } else if (selectedSort === 'stock-desc') {
        return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      } else if (selectedSort === 'price-asc') {
        return (Number(a.sell_price || a.sellPrice || a.unitPrice) || 0) - (Number(b.sell_price || b.sellPrice || b.unitPrice) || 0);
      } else if (selectedSort === 'price-desc') {
        return (Number(b.sell_price || b.sellPrice || b.unitPrice) || 0) - (Number(a.sell_price || a.sellPrice || a.unitPrice) || 0);
      }
      // Default: name-asc (A-Z)
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base', numeric: true });
    });

    return list;
  }

  function renderPagination(totalFiltered) {
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalFiltered);

    const infoEl = document.getElementById('items-pagination-info');
    if (infoEl) {
      infoEl.textContent = `${startIdx}-${endIdx} dari ${totalFiltered}`;
    }

    const btnContainer = document.getElementById('items-pagination-buttons');
    if (!btnContainer) return;
    btnContainer.innerHTML = '';

    // Tombol Previous
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
      currentPage <= 1
        ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
        : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
    }`;
    prevBtn.setAttribute('aria-label', 'Halaman sebelumnya');
    prevBtn.disabled = currentPage <= 1;
    prevBtn.onclick = () => goToPage(currentPage - 1);
    prevBtn.innerHTML = '<i data-lucide="chevron-left" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(prevBtn);

    // Nomor Halaman (Maksimal 5 tombol nomor)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
      const pageBtn = document.createElement('button');
      pageBtn.type = 'button';
      const isActive = p === currentPage;
      pageBtn.className = `px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
        isActive
          ? 'bg-[#0088CC] text-white shadow-lg shadow-[#0088CC]/20'
          : 'bg-[#1C1C1E] border border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
      }`;
      pageBtn.textContent = p;
      if (isActive) pageBtn.setAttribute('aria-current', 'page');
      pageBtn.onclick = () => goToPage(p);
      btnContainer.appendChild(pageBtn);
    }

    // Tombol Next
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = `px-3 py-1.5 rounded-lg border text-sm transition flex items-center justify-center ${
      currentPage >= totalPages
        ? 'bg-[#1C1C1E]/50 border-white/5 text-[#A0A0A5]/40 cursor-not-allowed'
        : 'bg-[#1C1C1E] border-white/5 text-[#A0A0A5] hover:text-white hover:bg-white/5'
    }`;
    nextBtn.setAttribute('aria-label', 'Halaman berikutnya');
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.onclick = () => goToPage(currentPage + 1);
    nextBtn.innerHTML = '<i data-lucide="chevron-right" class="w-4 h-4" aria-hidden="true"></i>';
    btnContainer.appendChild(nextBtn);
  }

  function renderItemsTable() {
    const tbody = document.getElementById('items-tbody');
    const subtitle = document.getElementById('items-subtitle');
    if (!tbody) return;

    tbody.innerHTML = '';
    const filtered = filterItems();
    const totalFiltered = filtered.length;

    // Metrik total barang
    let totalStock = 0;
    let totalCostValue = 0;
    let totalSellValue = 0;
    currentItems.forEach(function (i) {
      const s = Number(i.stock) || 0;
      const c = Number(i.cost_price || i.costPrice) || 0;
      const p = Number(i.sell_price || i.sellPrice || i.unitPrice) || 0;
      totalStock += s;
      totalCostValue += (s * c);
      totalSellValue += (s * p);
    });
    if (subtitle) {
      const costStr = 'Rp ' + Number(totalCostValue).toLocaleString('id-ID');
      const sellStr = 'Rp ' + Number(totalSellValue).toLocaleString('id-ID');
      subtitle.textContent = `${currentItems.length} barang · ${totalStock} total stok · Nilai Modal: ${costStr} · Potensi Jual: ${sellStr}`;
    }

    // 1. Kondisi jika database memang kosong
    if (currentItems.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row"><td colspan="12" class="empty-state-cell text-center py-12 text-[#A0A0A5]">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="package-open" class="w-6 h-6 text-[#A0A0A5]/40" aria-hidden="true"></i>
            </div>
            <p class="text-sm font-semibold text-white">Belum ada produk</p>
            <p class="text-xs text-[#A0A0A5]">Klik 'Tambah Barang' di atas untuk mulai menambahkan produk.</p>
          </div>
        </td></tr>
      `;
      const pagWrap = document.getElementById('items-pagination-wrap');
      if (pagWrap) pagWrap.classList.add('hidden');
      const bulkBar = document.getElementById('bulk-bar');
      if (bulkBar) {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    // 2. Kondisi jika search / filter menghasilkan 0 baris (Empty State)
    if (totalFiltered === 0) {
      tbody.innerHTML = `
        <tr class="empty-state-row"><td colspan="12" class="empty-state-cell text-center py-12 text-[#A0A0A5] w-full">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-center">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
              <i data-lucide="search-x" class="w-6 h-6 text-[#A0A0A5]/60" aria-hidden="true"></i>
            </div>
            <p class="text-sm font-semibold text-white">Tidak ada produk yang cocok dengan filter</p>
            <p class="text-xs text-[#A0A0A5]">Coba ubah kata kunci pencarian atau reset kategori dan stok.</p>
            <button type="button" onclick="resetFilters()" class="mt-3 px-4 py-2 rounded-xl bg-[#0088CC]/15 hover:bg-[#0088CC]/25 text-[#32ADE6] text-xs font-semibold transition flex items-center gap-1.5 border border-[#0088CC]/30">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5" aria-hidden="true"></i>
              <span>Reset Filter</span>
            </button>
          </div>
        </td></tr>
      `;
      const pagWrap = document.getElementById('items-pagination-wrap');
      if (pagWrap) pagWrap.classList.add('hidden');
      const bulkBar = document.getElementById('bulk-bar');
      if (bulkBar) {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
      }
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
      return;
    }

    const pagWrap = document.getElementById('items-pagination-wrap');
    if (pagWrap) pagWrap.classList.remove('hidden');

    // 3. Potong data sesuai pagination
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    pagedItems.forEach(function (item) {
      const stock = Number(item.stock) || 0;
      const minStock = Number(item.min_stock || item.minStock) || 0;
      const costPrice = Number(item.cost_price || item.costPrice) || 0;
      const sellPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      const markup = costPrice > 0 ? Math.round(((sellPrice - costPrice) / costPrice) * 100) : (sellPrice > 0 ? 100 : 0);
      const markupColor = markup >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]';
      const isLow = stock <= minStock;
      const isChecked = selectedItemIds.has(String(item.id));

      const stockDisplay = isLow
        ? `<span class="font-semibold text-[#FF3B30] flex items-center justify-end gap-1">${stock} ${escapeHtml(item.unit || 'pcs')} <i data-lucide="alert-triangle" class="w-3.5 h-3.5" aria-hidden="true"></i></span>`
        : `<span class="font-medium">${stock} ${escapeHtml(item.unit || 'pcs')}</span>`;

      const formatRupiah = function (num) {
        return 'Rp ' + Number(num).toLocaleString('id-ID');
      };

      const itemImages = parseProductImages(item.images || item.image_url);
      const coverImage = itemImages[0] || (typeof item.image_url === 'string' && !item.image_url.startsWith('[') ? item.image_url : null);
      const hasMultipleImages = itemImages.length > 1;
      const imagesAttr = escapeHtml(JSON.stringify(itemImages.length > 0 ? itemImages : (coverImage ? [coverImage] : [])));

      const tr = document.createElement('tr');
      tr.className = `table-row border-b border-white/5 transition ${isChecked ? 'bg-[#0088CC]/5' : ''}`;
      tr.innerHTML = `
        <td class="px-4 py-3.5">
          <input type="checkbox" aria-label="Pilih ${escapeHtml(item.name)}"
                 data-select-row
                 data-item-select-id="${escapeHtml(String(item.id))}"
                 ${isChecked ? 'checked' : ''}
                 class="item-checkbox accent-[#0088CC] w-4 h-4 cursor-pointer">
        </td>
        <td class="px-4 py-3.5">
          ${coverImage ? `
            <div class="w-16 h-16 md:w-10 md:h-10 rounded-xl md:rounded-lg overflow-hidden border border-white/10 bg-black/40 flex-shrink-0 cursor-pointer group relative" title="Klik untuk lihat ${hasMultipleImages ? itemImages.length + ' foto produk' : 'foto ukuran penuh'}" onclick="window.openImageViewer(${imagesAttr}, '${escapeHtml(item.name).replace(/'/g, "\\'")}', '${escapeHtml(item.sku || '').replace(/'/g, "\\'")}', 0)">
              <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(item.name)}" class="w-full h-full object-cover group-hover:scale-110 transition duration-200 product-thumbnail-img" data-zoomable data-title="${escapeHtml(item.name)}" data-sku="${escapeHtml(item.sku || '')}" data-gallery="${imagesAttr}" loading="lazy">
              ${hasMultipleImages ? `
                <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-white flex items-center gap-1 shadow pointer-events-none">
                  <i data-lucide="layers" class="w-2.5 h-2.5"></i> ${itemImages.length}
                </span>
              ` : `
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                  <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                </div>
              `}
            </div>
          ` : `
            <div class="w-16 h-16 md:w-10 md:h-10 rounded-xl md:rounded-lg bg-[#0088CC]/15 grid place-items-center flex-shrink-0">
              <i data-lucide="package" class="w-6 h-6 md:w-5 md:h-5 text-[#32ADE6]" aria-hidden="true"></i>
            </div>
          `}
        </td>
        <td class="px-4 py-3.5 font-medium">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-white text-sm font-semibold">${escapeHtml(item.name)}</span>
            ${renderChannelBadgeHtml(item.channel, item.channel_link, item.channels)}
          </div>
        </td>
        <td class="px-4 py-3.5 text-[#A0A0A5]">${escapeHtml(item.brand || '-')}</td>
        <td class="px-4 py-3.5 text-[#A0A0A5] font-mono text-xs">${escapeHtml(item.sku || '-')}</td>
        <td class="px-4 py-3.5 text-[#A0A0A5] font-mono text-xs">${escapeHtml(item.barcode || '-')}</td>
        <td class="px-4 py-3.5"><span class="badge bg-[#0088CC]/15 text-[#32ADE6]">${escapeHtml(item.category || 'Umum')}</span></td>
        <td class="px-4 py-3.5 text-right">${stockDisplay}</td>
        <td class="px-4 py-3.5 text-right">${formatRupiah(costPrice)}</td>
        <td class="px-4 py-3.5 text-right font-semibold">${formatRupiah(sellPrice)}</td>
        <td class="px-4 py-3.5 text-right ${markupColor} font-semibold">${markup}%</td>
        <td class="px-4 py-3.5">
          <div class="flex gap-1 justify-end">
            ${(function () {
              const chList = (Array.isArray(item.channels) && item.channels.length > 0)
                ? item.channels.filter(c => c && c.link)
                : (item.channel_link ? [{ channel: item.channel, link: item.channel_link }] : []);
              return chList.map(c => `
                <a href="${escapeHtml(c.link)}" target="_blank" rel="noopener noreferrer" aria-label="Buka produk di ${escapeHtml((getChannelBadgeConfig(c.channel, c.link) || {}).label || c.channel || 'Marketplace')}" class="p-1.5 hover:bg-white/5 rounded-lg text-[#32ADE6] inline-flex items-center justify-center transition" title="Buka produk di ${escapeHtml((getChannelBadgeConfig(c.channel, c.link) || {}).label || c.channel || 'Marketplace')}">
                  <i data-lucide="external-link" class="w-4 h-4" aria-hidden="true"></i>
                </a>
              `).join('');
            })()}
            <button type="button" data-action="adjust-stock" data-item-action="adjust-stock" data-item-id="${escapeHtml(String(item.id))}" onclick="openStockAdjustmentModal('${escapeHtml(String(item.id))}')" title="Penyesuaian Stok (Stock Opname)" aria-label="Penyesuaian Stok" class="p-1.5 hover:bg-white/5 rounded-lg text-[#FF9500]">
              <i data-lucide="sliders-horizontal" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <button type="button" data-action="edit" data-item-action="edit" data-item-id="${escapeHtml(String(item.id))}" aria-label="Edit" class="p-1.5 hover:bg-white/5 rounded-lg text-[#32ADE6]">
              <i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <button type="button" data-action="delete" data-item-action="delete" data-item-id="${escapeHtml(String(item.id))}" aria-label="Hapus" class="p-1.5 hover:bg-white/5 rounded-lg text-[#FF3B30]">
              <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination(totalFiltered);
    updateBulkBarUI();

    if (typeof window.syncTableLabels === 'function') {
      window.syncTableLabels();
    }
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
  }

  function handleSearchItems(val) {
    searchQuery = (val || '').trim();
    currentPage = 1;
    const pageSearch = document.getElementById('search-items');
    const globalSearch = document.getElementById('global-search');
    if (pageSearch && pageSearch.value !== val) pageSearch.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    renderItemsTable();
  }

  function handleCategoryFilter(val) {
    selectedCategory = val;
    currentPage = 1;
    renderItemsTable();
  }

  function handleStockFilter(val) {
    selectedStockFilter = val;
    currentPage = 1;
    renderItemsTable();
  }

  function updateSortIcon() {
    const icon = document.getElementById('sort-name-icon');
    if (!icon) return;
    if (selectedSort === 'name-asc') {
      icon.setAttribute('data-lucide', 'arrow-down-a-z');
      icon.className = 'w-3.5 h-3.5 text-[#0088CC]';
    } else if (selectedSort === 'name-desc') {
      icon.setAttribute('data-lucide', 'arrow-up-z-a');
      icon.className = 'w-3.5 h-3.5 text-[#0088CC]';
    } else {
      icon.setAttribute('data-lucide', 'arrow-up-down');
      icon.className = 'w-3.5 h-3.5 text-[#A0A0A5]/40';
    }
    if (typeof window.refreshIcons === 'function') {
      window.refreshIcons();
    }
  }

  function handleSortItems(val) {
    selectedSort = val || 'name-asc';
    updateSortIcon();
    currentPage = 1;
    renderItemsTable();
  }

  function toggleSortByName() {
    if (selectedSort === 'name-asc') {
      selectedSort = 'name-desc';
    } else {
      selectedSort = 'name-asc';
    }
    const sortSelect = document.getElementById('sort-items');
    if (sortSelect) sortSelect.value = selectedSort;
    updateSortIcon();
    currentPage = 1;
    renderItemsTable();
  }

  function goToPage(p) {
    currentPage = p;
    renderItemsTable();
    const tableEl = document.querySelector('.card-table-wrap');
    if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetFilters() {
    searchQuery = '';
    selectedCategory = 'all';
    selectedStockFilter = 'all';
    selectedSort = 'name-asc';
    currentPage = 1;
    const searchInput = document.getElementById('search-items');
    if (searchInput) searchInput.value = '';
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) globalSearch.value = '';
    const catSelect = document.getElementById('filter-category');
    if (catSelect) catSelect.value = 'all';
    const stockSelect = document.getElementById('filter-stock');
    if (stockSelect) stockSelect.value = 'all';
    const sortSelect = document.getElementById('sort-items');
    if (sortSelect) sortSelect.value = 'name-asc';
    updateSortIcon();
    renderItemsTable();
  }

  // ═══════════════════════════════════════════════
  // BULK SELECTION (PERSIST ACROSS PAGES)
  // ═══════════════════════════════════════════════
  function toggleItemSelect(id, checked) {
    const itemId = String(id);
    if (checked) {
      selectedItemIds.add(itemId);
    } else {
      selectedItemIds.delete(itemId);
    }
    updateBulkBarUI();
  }

  function toggleSelectAllPage(checked) {
    const filtered = filterItems();
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

    pagedItems.forEach(item => {
      if (checked) {
        selectedItemIds.add(String(item.id));
      } else {
        selectedItemIds.delete(String(item.id));
      }
    });
    renderItemsTable();
  }

  function clearSelection() {
    selectedItemIds.clear();
    const headerCb = document.getElementById('select-all-header');
    if (headerCb) headerCb.checked = false;
    const bottomCb = document.getElementById('select-all-items');
    if (bottomCb) bottomCb.checked = false;
    renderItemsTable();
  }

  function updateBulkBarUI() {
    const count = selectedItemIds.size;
    const bulkBar = document.getElementById('bulk-bar');
    const bulkCountText = document.getElementById('bulk-count');
    const bulkCountBadge = document.getElementById('bulk-count-badge');
    const btnBulkPrice = document.getElementById('btn-bulk-price');
    const btnBulkDelete = document.getElementById('btn-bulk-delete');
    const btnBulkMeta = document.getElementById('btn-bulk-meta');

    const filtered = filterItems();
    if (bulkBar && bulkCountText) {
      if (count > 0 && filtered.length > 0) {
        bulkBar.classList.remove('hidden');
        bulkBar.classList.add('flex');
        bulkCountText.textContent = `${count} dipilih`;
        if (bulkCountBadge) bulkCountBadge.textContent = String(count);
        if (typeof window.refreshIcons === 'function') window.refreshIcons(bulkBar);
      } else {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
        bulkCountText.textContent = `${count} dipilih`;
        if (bulkCountBadge) bulkCountBadge.textContent = String(count);
      }
    }

    if (btnBulkPrice) btnBulkPrice.disabled = count === 0;
    if (btnBulkMeta) btnBulkMeta.disabled = count === 0;
    if (btnBulkDelete) btnBulkDelete.disabled = count === 0;

    // Periksa status centang select-all di halaman aktif
    const startIdx = (currentPage - 1) * pageSize;
    const pagedItems = filtered.slice(startIdx, startIdx + pageSize);
    const allPageSelected = pagedItems.length > 0 && pagedItems.every(i => selectedItemIds.has(String(i.id)));

    const headerCb = document.getElementById('select-all-header');
    if (headerCb) headerCb.checked = allPageSelected;
    const bottomCb = document.getElementById('select-all-items');
    if (bottomCb) bottomCb.checked = allPageSelected;
  }

  // ═══════════════════════════════════════════════
  // BULK DELETE
  // ═══════════════════════════════════════════════
  async function openBulkDeleteModal() {
    if (selectedItemIds.size === 0) {
      if (typeof showToast === 'function') showToast('Pilih minimal 1 produk terlebih dahulu', 'info');
      return;
    }

    const modal = document.getElementById('modal-bulk-delete');
    const summaryEl = document.getElementById('bulk-delete-summary');
    const btnConfirm = document.getElementById('btn-confirm-bulk-delete');
    if (!modal || !summaryEl) return;

    summaryEl.innerHTML = '<div class="py-4 text-center text-[#A0A0A5]">Memeriksa keterkaitan transaksi...</div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
      const ids = Array.from(selectedItemIds);
      const checkRes = await Api.items.checkDeletable(ids);
      const { deletableIds, skippedIds } = checkRes.data || { deletableIds: [], skippedIds: [] };

      // Ambil nama barang yang dilewati
      const skippedItems = currentItems.filter(i => skippedIds.includes(String(i.id)));

      let html = '';
      if (deletableIds.length > 0) {
        html += `<p class="text-white font-medium"><span class="text-[#FF3B30] font-bold">${deletableIds.length}</span> produk akan dihapus secara permanen.</p>`;
      }

      if (skippedIds.length > 0) {
        html += `
          <div class="p-3 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#FF9500] text-xs space-y-1 mt-2">
            <p class="font-bold flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-4 h-4"></i> ${skippedIds.length} produk akan dilewati (memiliki riwayat transaksi):</p>
            <ul class="list-disc list-inside text-[11px] text-[#A0A0A5] pl-1 space-y-0.5 max-h-24 overflow-y-auto">
              ${skippedItems.map(i => `<li>${i.name} (${i.sku})</li>`).join('')}
            </ul>
          </div>
        `;
        console.warn('Produk yang dilewati saat Hapus Massal (berelasi ke transaksi):', skippedItems);
      }

      if (deletableIds.length === 0) {
        html = `
          <div class="p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] text-xs">
            <p class="font-bold">Semua ${ids.length} produk yang dipilih memiliki transaksi dan tidak dapat dihapus.</p>
          </div>
        `;
        if (btnConfirm) btnConfirm.disabled = true;
      } else {
        if (btnConfirm) btnConfirm.disabled = false;
      }

      summaryEl.innerHTML = html;
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    } catch (e) {
      summaryEl.innerHTML = `<p class="text-[#FF3B30]">Gagal memeriksa transaksi: ${e.message}</p>`;
    }
  }

  function closeBulkDeleteModal() {
    const modal = document.getElementById('modal-bulk-delete');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  async function executeBulkDelete() {
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const btn = document.getElementById('btn-confirm-bulk-delete');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghapus...</span>';

    try {
      const ids = Array.from(selectedItemIds);
      const res = await Api.items.bulkDelete(ids);

      if (!res.ok) {
        if (typeof showToast === 'function') showToast(res.error?.message || 'Gagal menghapus massal', 'error');
        return;
      }

      const { deletedCount, skippedCount, skippedIds } = res.data;
      if (skippedCount > 0) {
        console.warn('Produk dilewati karena FK transactions:', skippedIds);
        if (typeof showToast === 'function') {
          showToast(`${deletedCount} berhasil, ${skippedCount} dilewati (memiliki transaksi)`, 'info');
        }
      } else {
        if (typeof showToast === 'function') {
          showToast(`${deletedCount} produk berhasil dihapus`, 'success');
        }
      }

      closeBulkDeleteModal();
      clearSelection();
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  // ═══════════════════════════════════════════════
  // BULK EDIT HARGA
  // ═══════════════════════════════════════════════
  function openBulkPriceModal() {
    if (selectedItemIds.size === 0) {
      if (typeof showToast === 'function') showToast('Pilih minimal 1 produk terlebih dahulu', 'info');
      return;
    }

    const modal = document.getElementById('modal-bulk-price');
    if (!modal) return;

    bulkPriceMode = 'nominal';
    switchBulkPriceTab('nominal');
    document.getElementById('bulk-price-nominal-input').value = '';
    document.getElementById('bulk-price-percent-input').value = '';

    updateBulkPricePreview();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeBulkPriceModal() {
    const modal = document.getElementById('modal-bulk-price');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function switchBulkPriceTab(mode) {
    bulkPriceMode = mode;
    const tabNominal = document.getElementById('tab-bulk-nominal');
    const tabPercent = document.getElementById('tab-bulk-percent');
    const secNominal = document.getElementById('bulk-price-nominal-section');
    const secPercent = document.getElementById('bulk-price-percent-section');

    if (mode === 'nominal') {
      tabNominal.className = 'flex-1 py-2 text-xs font-semibold rounded-lg bg-[#0088CC] text-white transition';
      tabPercent.className = 'flex-1 py-2 text-xs font-medium rounded-lg text-[#A0A0A5] hover:text-white transition';
      secNominal.classList.remove('hidden');
      secPercent.classList.add('hidden');
    } else {
      tabPercent.className = 'flex-1 py-2 text-xs font-semibold rounded-lg bg-[#0088CC] text-white transition';
      tabNominal.className = 'flex-1 py-2 text-xs font-medium rounded-lg text-[#A0A0A5] hover:text-white transition';
      secPercent.classList.remove('hidden');
      secNominal.classList.add('hidden');
    }
    updateBulkPricePreview();
  }

  function updateBulkPricePreview() {
    const tbody = document.getElementById('bulk-price-preview-body');
    if (!tbody) return;

    const selectedItems = currentItems.filter(i => selectedItemIds.has(String(i.id)));
    const nominalVal = Number(document.getElementById('bulk-price-nominal-input')?.value);
    const percentVal = Number(document.getElementById('bulk-price-percent-input')?.value);

    tbody.innerHTML = selectedItems.map(item => {
      const oldPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      let newPrice = oldPrice;

      if (bulkPriceMode === 'nominal') {
        if (!isNaN(nominalVal) && nominalVal > 0) {
          newPrice = nominalVal;
        }
      } else {
        if (!isNaN(percentVal) && percentVal !== 0) {
          newPrice = Math.max(0, Math.round(oldPrice * (1 + (percentVal / 100))));
        }
      }

      const formatRp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
      const isChanged = newPrice !== oldPrice;

      return `
        <tr class="hover:bg-white/[0.02]">
          <td class="py-2 px-2 text-white font-medium">${item.name}</td>
          <td class="py-2 px-2 text-right text-[#A0A0A5]">${formatRp(oldPrice)}</td>
          <td class="py-2 px-2 text-center text-[#A0A0A5]">&rarr;</td>
          <td class="py-2 px-2 text-right font-bold ${isChanged ? 'text-[#34C759]' : 'text-white'}">
            ${formatRp(newPrice)}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function executeBulkPriceUpdate() {
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const selectedItems = currentItems.filter(i => selectedItemIds.has(String(i.id)));
    if (selectedItems.length === 0) return;

    const nominalVal = Number(document.getElementById('bulk-price-nominal-input')?.value);
    const percentVal = Number(document.getElementById('bulk-price-percent-input')?.value);

    const updates = [];
    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const oldPrice = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      let newPrice = oldPrice;

      if (bulkPriceMode === 'nominal') {
        if (isNaN(nominalVal) || nominalVal < 0) {
          if (typeof showToast === 'function') showToast('Harga jual harus berupa angka >= 0', 'error');
          return;
        }
        newPrice = nominalVal;
      } else {
        if (isNaN(percentVal)) {
          if (typeof showToast === 'function') showToast('Persentase tidak valid', 'error');
          return;
        }
        newPrice = Math.max(0, Math.round(oldPrice * (1 + (percentVal / 100))));
      }

      if (newPrice < 0) {
        if (typeof showToast === 'function') showToast('Harga baru tidak boleh kurang dari 0', 'error');
        return;
      }
      updates.push({ id: item.id, sell_price: newPrice });
    }

    const btn = document.getElementById('btn-save-bulk-price');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menyimpan...</span>';

    try {
      const res = await Api.items.bulkUpdatePrice(updates);
      if (!res.ok) {
        if (res.error?.code === 'PARTIAL_UPDATE') {
          closeBulkPriceModal();
          clearSelection();
          await loadItemsFromBackend();
        }
        if (typeof showToast === 'function') showToast(res.error?.message || 'Gagal memperbarui harga massal', 'error');
        return;
      }

      if (typeof showToast === 'function') {
        showToast(`${res.data.updatedCount} produk berhasil diperbarui harganya`, 'success');
      }
      closeBulkPriceModal();
      clearSelection();
      await loadItemsFromBackend();
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  // ═══════════════════════════════════════════════
  // BULK EDIT SATUAN & SUPPLIER
  // ═══════════════════════════════════════════════
  let suppliersData = [];

  async function loadSuppliersForBulk() {
    if (suppliersData && suppliersData.length > 0) return suppliersData;
    try {
      if (typeof Api !== 'undefined' && Api.suppliers) {
        const res = await Api.suppliers.getAll({ status: 'active' });
        if (res.ok) {
          suppliersData = res.data || [];
        }
      } else if (typeof window.supabase !== 'undefined') {
        const { data } = await window.supabase.from('suppliers').select('id, name').order('name');
        suppliersData = data || [];
      }
    } catch (e) {
      console.warn('Gagal memuat daftar pemasok:', e);
    }
    return suppliersData;
  }

  async function openBulkMetaModal() {
    if (selectedItemIds.size === 0) {
      if (typeof showToast === 'function') showToast('Pilih minimal 1 produk terlebih dahulu', 'info');
      return;
    }

    const modal = document.getElementById('modal-bulk-meta');
    if (!modal) return;

    // Reset checkboxes
    const checkUnit = document.getElementById('check-bulk-unit');
    const checkSupplier = document.getElementById('check-bulk-supplier');
    if (checkUnit) checkUnit.checked = false;
    if (checkSupplier) checkSupplier.checked = false;
    toggleBulkUnitField(false);
    toggleBulkSupplierField(false);

    // Isi dropdown Satuan dari unitsData
    const unitSelect = document.getElementById('bulk-unit-select');
    if (unitSelect && unitsData.length > 0) {
      unitSelect.innerHTML = unitsData.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    }

    // Isi dropdown Supplier dari Api.suppliers
    const suppSelect = document.getElementById('bulk-supplier-select');
    if (suppSelect) {
      suppSelect.innerHTML = '<option value="">Memuat daftar pemasok...</option>';
      const supps = await loadSuppliersForBulk();
      if (!supps || supps.length === 0) {
        suppSelect.innerHTML = '<option value="">(Belum ada data supplier)</option>';
      } else {
        suppSelect.innerHTML = supps.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      }
    }

    // Render Preview Barang yang Dipilih
    const selectedItems = currentItems.filter(i => selectedItemIds.has(String(i.id)));
    const subtitle = document.getElementById('bulk-meta-subtitle');
    const countEl = document.getElementById('bulk-meta-item-count');
    const previewList = document.getElementById('bulk-meta-preview-list');

    if (subtitle) subtitle.textContent = `${selectedItems.length} barang dipilih`;
    if (countEl) countEl.textContent = `${selectedItems.length} produk`;

    if (previewList) {
      previewList.innerHTML = selectedItems.map(item => `
        <div class="py-1.5 flex items-center justify-between">
          <span class="font-medium text-white truncate max-w-[240px]">${escapeHtml(item.name)}</span>
          <span class="font-mono text-[11px] text-[#A0A0A5] shrink-0">${escapeHtml(item.sku || '-')}</span>
        </div>
      `).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof window.refreshIcons === 'function') window.refreshIcons();
  }

  function closeBulkMetaModal() {
    const modal = document.getElementById('modal-bulk-meta');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function toggleBulkUnitField(checked) {
    const wrap = document.getElementById('bulk-unit-wrap');
    if (wrap) {
      if (checked) {
        wrap.classList.remove('hidden');
      } else {
        wrap.classList.add('hidden');
      }
    }
  }

  function toggleBulkSupplierField(checked) {
    const wrap = document.getElementById('bulk-supplier-wrap');
    if (wrap) {
      if (checked) {
        wrap.classList.remove('hidden');
      } else {
        wrap.classList.add('hidden');
      }
    }
  }

  async function executeBulkMetaUpdate() {
    const role = (typeof window !== 'undefined' && window.RBAC) ? await window.RBAC.getUserRole() : null;
    if (role === 'VIEWER') {
      alert('Anda tidak punya akses untuk mengubah data.');
      return;
    }

    const checkUnit = document.getElementById('check-bulk-unit')?.checked;
    const checkSupplier = document.getElementById('check-bulk-supplier')?.checked;

    if (!checkUnit && !checkSupplier) {
      if (typeof showToast === 'function') {
        showToast('Centang setidaknya opsi Ubah Satuan Stok atau Ubah Pemasok', 'error');
      }
      return;
    }

    const updates = {};
    if (checkUnit) {
      const unitVal = document.getElementById('bulk-unit-select')?.value;
      if (!unitVal) {
        if (typeof showToast === 'function') showToast('Pilih satuan yang valid', 'error');
        return;
      }
      updates.unit_id = Number(unitVal);
    }

    if (checkSupplier) {
      const suppVal = document.getElementById('bulk-supplier-select')?.value;
      if (!suppVal) {
        if (typeof showToast === 'function') showToast('Pilih pemasok yang valid', 'error');
        return;
      }
      updates.supplier_id = Number(suppVal);
    }

    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;

    const btn = document.getElementById('btn-save-bulk-meta');
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menerapkan...</span>';

    try {
      const res = await Api.items.bulkUpdateMeta(ids, updates);
      if (!res.ok) {
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal menerapkan perubahan massal', 'error');
        }
        return;
      }

      if (typeof showToast === 'function') {
        showToast(`${res.data.updatedCount} produk berhasil diperbarui`, 'success');
      }

      closeBulkMetaModal();
      clearSelection();
      await loadItemsFromBackend();
    } catch (err) {
      console.error('Bulk meta update error:', err);
      if (typeof showToast === 'function') showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  // ═══════════════════════════════════════════════
  // REFRESH & EXPORT CSV
  // ═══════════════════════════════════════════════
  async function handleRefreshItems() {
    const btn1 = document.getElementById('btn-refresh-items');
    const btn2 = document.getElementById('btn-refresh-items-toolbar');
    const icon1 = btn1 ? btn1.querySelector('i') : null;
    const icon2 = btn2 ? btn2.querySelector('i') : null;
    if (icon1) icon1.classList.add('animate-spin');
    if (icon2) icon2.classList.add('animate-spin');

    try {
      await loadItemsFromBackend();
      if (typeof showToast === 'function') showToast('Data berhasil di-refresh', 'success');
    } catch (err) {
      console.error('Refresh items error:', err);
      if (typeof showToast === 'function') showToast('Gagal memuat ulang data', 'error');
    } finally {
      if (icon1) icon1.classList.remove('animate-spin');
      if (icon2) icon2.classList.remove('animate-spin');
      if (typeof window.refreshIcons === 'function') window.refreshIcons();
    }
  }

  function handleExportItems() {
    const filtered = filterItems();
    if (!filtered || filtered.length === 0) {
      if (typeof showToast === 'function') showToast('Tidak ada data produk untuk diekspor', 'info');
      return;
    }

    const headers = ['ID', 'SKU', 'Barcode', 'Nama Barang', 'Brand', 'Kategori', 'Stok', 'Min Stok', 'Harga Beli (Rp)', 'Harga Jual (Rp)', 'Markup (%)'];
    const rows = filtered.map(item => {
      const s = Number(item.stock) || 0;
      const min = Number(item.min_stock || item.minStock) || 0;
      const c = Number(item.cost_price || item.costPrice) || 0;
      const p = Number(item.sell_price || item.sellPrice || item.unitPrice) || 0;
      const m = c > 0 ? Math.round(((p - c) / c) * 100) : (p > 0 ? 100 : 0);
      return [item.id, item.sku || '-', item.barcode || '-', item.name, item.brand || '-', item.category || 'Umum', s, min, c, p, m];
    });

    const filename = `items-${new Date().toISOString().slice(0, 10)}.csv`;
    if (typeof exportToCSV === 'function') {
      exportToCSV(filename, rows, headers);
    }
  }

  // ═══════════════════════════════════════════════
  // LOAD FROM BACKEND
  // ═══════════════════════════════════════════════
  async function loadItemsFromBackend() {
    if (typeof Api === 'undefined') return;

    try {
      const res = await Api.items.getAll();
      if (!res.ok) {
        console.error('Gagal mengambil data produk:', res.error);
        if (typeof showToast === 'function') {
          showToast(res.error?.message || 'Gagal mengambil data produk dari database', 'error');
        }
        return;
      }

      currentItems = res.data || [];
      const getLocalMeta = (typeof window !== 'undefined' && window.getLocalChannelMeta) ? window.getLocalChannelMeta : (typeof Api !== 'undefined' && Api.items?.getLocalChannelMeta ? Api.items.getLocalChannelMeta : null);
      if (typeof getLocalMeta === 'function') {
        currentItems.forEach(function (item) {
          const meta = getLocalMeta(item.id, item.sku);
          if (meta) {
            if (!item.channel || item.channel === 'Offline') {
              item.channel = meta.channel || item.channel || 'Offline';
            }
            if (!item.channel_link) {
              item.channel_link = meta.channel_link || '';
            }
          }
        });
      }
      // Urutkan default otomatis A-Z
      currentItems.sort(function (a, b) {
        return (a.name || '').trim().localeCompare((b.name || '').trim(), 'id', { sensitivity: 'base', numeric: true });
      });

      // Update badge di sidebar & simpan di session cache
      try {
        sessionStorage.setItem('items_count', currentItems.length.toString());
      } catch (_) {}
      const badge = document.querySelector('#sidebar-items-badge') || document.querySelector('.menu-item[data-page="items"] span');
      if (badge) {
        badge.textContent = currentItems.length;
      }

      // Bersihkan ID terpilih yang sudah tidak ada di data
      const existingIdSet = new Set(currentItems.map(i => String(i.id)));
      selectedItemIds.forEach(id => {
        if (!existingIdSet.has(id)) selectedItemIds.delete(id);
      });

      renderItemsTable();
    } catch (err) {
      console.error('Error saat memuat produk:', err);
    }
  }

  function handleItemStockInput() {
    const val = Number(document.getElementById('item-stock')?.value || 0);
    const warnBanner = document.getElementById('item-stock-warning-banner');
    if (warnBanner) {
      if (val > 0) {
        warnBanner.classList.remove('hidden');
      } else {
        warnBanner.classList.add('hidden');
      }
    }
  }

  // Ekspos fungsi ke global window
  window.handleItemStockInput = handleItemStockInput;
  window.openAddItemModal = openAddItemModal;
  window.openEditItemModal = openEditItemModal;
  window.closeItemModal = closeItemModal;
  window.handleItemSubmit = handleItemSubmit;
  window.handleImageSelection = handleImageSelection;
  window.removeSelectedPhoto = removeSelectedPhoto;
  window.openDeleteItemModal = openDeleteItemModal;
  window.closeDeleteModal = closeDeleteModal;
  window.confirmDeleteItem = confirmDeleteItem;
  window.loadItemsFromBackend = loadItemsFromBackend;
  window.autoGenerateSkuForItem = autoGenerateSkuForItem;

  // Fitur Fase 4.8 & Sorting
  window.handleSearchItems = handleSearchItems;
  window.handleCategoryFilter = handleCategoryFilter;
  window.handleStockFilter = handleStockFilter;
  window.handleSortItems = handleSortItems;
  window.toggleSortByName = toggleSortByName;
  window.goToPage = goToPage;
  window.resetFilters = resetFilters;
  window.toggleItemSelect = toggleItemSelect;
  window.toggleSelectAllPage = toggleSelectAllPage;
  window.clearSelection = clearSelection;
  window.openBulkDeleteModal = openBulkDeleteModal;
  window.closeBulkDeleteModal = closeBulkDeleteModal;
  window.executeBulkDelete = executeBulkDelete;
  window.openBulkPriceModal = openBulkPriceModal;
  window.closeBulkPriceModal = closeBulkPriceModal;
  window.switchBulkPriceTab = switchBulkPriceTab;
  window.updateBulkPricePreview = updateBulkPricePreview;
  window.executeBulkPriceUpdate = executeBulkPriceUpdate;
  window.openBulkMetaModal = openBulkMetaModal;
  window.closeBulkMetaModal = closeBulkMetaModal;
  window.toggleBulkUnitField = toggleBulkUnitField;
  window.toggleBulkSupplierField = toggleBulkSupplierField;
  window.executeBulkMetaUpdate = executeBulkMetaUpdate;
  window.handleRefreshItems = handleRefreshItems;
  window.handleExportItems = handleExportItems;

  window.openStockAdjustmentModal = openStockAdjustmentModal;
  window.closeStockAdjustmentModal = closeStockAdjustmentModal;
  window.openStockAdjustmentHistory = openStockAdjustmentHistory;
  window.closeStockAdjustmentHistory = closeStockAdjustmentHistory;
  window.switchStockOpnameView = switchStockOpnameView;
  window.calculateAdjustmentDifference = calculateAdjustmentDifference;
  window.handleStockAdjustmentSubmit = handleStockAdjustmentSubmit;

  // Tutup modal saat klik pada backdrop atau tekan Escape
  window.addEventListener('click', function (e) {
    const historyTrigger = e.target.closest('#btn-show-adjustment-history');
    if (historyTrigger) {
      const productId = document.getElementById('adj-product-id')?.value || selectedAdjustmentProduct?.id;
      openStockAdjustmentHistory(productId);
    }
    const itemAction = e.target.closest('[data-item-action]');
    if (itemAction) {
      const itemId = itemAction.dataset.itemId;
      if (itemAction.dataset.itemAction === 'adjust-stock') openStockAdjustmentModal(itemId);
      if (itemAction.dataset.itemAction === 'edit') openEditItemModal(itemId);
      if (itemAction.dataset.itemAction === 'delete') openDeleteItemModal(itemId);
    }

    const modalItem = document.getElementById('modal-item');
    const modalAdj = document.getElementById('modal-stock-adjustment');
    const modalAdjHistory = document.getElementById('modal-stock-adjustment-history');
    const modalDelete = document.getElementById('modal-delete');
    const modalBulkDel = document.getElementById('modal-bulk-delete');
    const modalBulkPrice = document.getElementById('modal-bulk-price');
    const modalBulkMeta = document.getElementById('modal-bulk-meta');
    if (e.target === modalItem) closeItemModal();
    if (e.target === modalAdj) closeStockAdjustmentModal();
    if (e.target === modalAdjHistory) closeStockAdjustmentHistory();
    if (e.target === modalDelete) closeDeleteModal();
    if (e.target === modalBulkDel) closeBulkDeleteModal();
    if (e.target === modalBulkPrice) closeBulkPriceModal();
    if (e.target === modalBulkMeta) closeBulkMetaModal();
  });
  document.getElementById('items-tbody')?.addEventListener('change', function (event) {
    const checkbox = event.target.closest('[data-item-select-id]');
    if (checkbox) toggleItemSelect(checkbox.dataset.itemSelectId, checkbox.checked);
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeItemModal();
      closeStockAdjustmentHistory();
      closeStockAdjustmentModal();
      closeDeleteModal();
      closeBulkDeleteModal();
      closeBulkPriceModal();
      closeBulkMetaModal();
    }
  });

  const scanItemBarcodeButton = document.getElementById('btn-scan-item-barcode');
  if (scanItemBarcodeButton) {
    scanItemBarcodeButton.addEventListener('click', function () {
      if (typeof window.openItemBarcodeScanner !== 'function') {
        showToast('Pemindai barcode belum siap. Muat ulang halaman dan coba lagi.', 'error');
        return;
      }

      window.openItemBarcodeScanner(function (barcode) {
        const input = document.getElementById('item-barcode');
        if (!input) return;
        input.value = barcode;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        if (typeof showToast === 'function') showToast('Barcode berhasil dipindai', 'success');
      });
    });
  }

  const channelLinkInput = document.getElementById('item-channel-link');
  if (channelLinkInput) {
    const updateOpenButton = function () {
      const btn = document.getElementById('btn-open-channel-link');
      if (!btn) return;
      const rawVal = (channelLinkInput.value || '').trim();
      const formatted = formatChannelUrl(rawVal);
      if (formatted) {
        btn.classList.remove('hidden');
        btn.classList.add('inline-flex');
        btn.href = formatted;
      } else {
        btn.classList.add('hidden');
        btn.classList.remove('inline-flex');
        btn.href = '#';
      }
    };
    channelLinkInput.addEventListener('input', updateOpenButton);
    channelLinkInput.addEventListener('change', updateOpenButton);
  }

  const btnAddItemChannel = document.getElementById('btn-add-item-channel');
  if (btnAddItemChannel) {
    btnAddItemChannel.addEventListener('click', function () {
      addItemChannelRow();
    });
  }

  document.getElementById('btn-import-items')?.addEventListener('click', function () {
    if (typeof window.startCsvImport !== 'function') {
      showToast('Fitur import belum siap. Muat ulang halaman dan coba lagi.', 'error');
      return;
    }

    const headers = [
      'SKU', 'Barcode', 'Nama Barang', 'Brand', 'Kategori',
      'Stok Awal', 'Min Stok', 'Harga Beli (Rp)', 'Harga Jual (Rp)'
    ];
    window.startCsvImport({
      title: 'Barang',
      templateName: 'template-barang.csv',
      headers,
      requiredHeaders: ['SKU', 'Nama Barang', 'Stok Awal', 'Min Stok', 'Harga Beli (Rp)', 'Harga Jual (Rp)'],
      templateRows: [
        ['PAK-LOK-001', '8991234567890', 'Pelet Kura Kura 1mm 100g', 'Lokal', 'Pakan', '10', '3', '15000', '25000'],
        ['POM-RES-002', '8999876543210', 'Pompa Celup SP-1200', 'Resun', 'Pompa Aquarium', '5', '2', '45000', '70000'],
        ['MED-BLU-003', '', 'Obat Ikan Blitz Ich Blue 100ml', 'Lokal', 'Obat', '20', '5', '8000', '15000']
      ],
      instructions: [
        'SKU dan Nama Barang wajib diisi dan tidak boleh duplikat.',
        'Barcode bersifat opsional (dapat dikosongkan jika produk tidak memiliki barcode fisik).',
        'Kategori harus sesuai dengan kategori yang sudah terdaftar di toko (contoh: Pakan, Pompa Aquarium, Aksesoris, dll).',
        'Stok Awal, Min Stok, Harga Beli, dan Harga Jual berupa angka murni (tanpa titik pemisah ribuan atau Rp).'
      ],
      validate: async function (records) {
        const [productsResult, categoriesResult] = await Promise.all([
          Api.items.getAll(),
          window.supabase.from('categories').select('name')
        ]);
        if (!productsResult?.ok) throw new Error(productsResult?.error?.message || 'Gagal memeriksa SKU dan barcode yang terdaftar.');
        if (categoriesResult.error) throw new Error(categoriesResult.error.message || 'Gagal memeriksa kategori.');

        const existingBarcodeMap = new Map();
        (productsResult.data || []).forEach(item => {
          if (item.barcode && item.sku) {
            existingBarcodeMap.set(String(item.barcode).trim(), String(item.sku).trim().toLowerCase());
          }
        });
        const seenSkus = new Set();
        const seenBarcodes = new Set();
        const rows = [];
        const errors = [];
        const parseNumber = (value, label, rowNumber, integer = false) => {
          const raw = String(value ?? '').trim().replace(/^Rp\s*/i, '').replace(/[\s]/g, '');
          const valid = integer ? /^\d+$/.test(raw) : /^\d+(\.\d+)?$/.test(raw);
          if (!valid) {
            errors.push({ row: rowNumber, message: `${label} harus berupa ${integer ? 'bilangan bulat' : 'angka'} nol atau lebih.` });
            return null;
          }
          return Number(raw);
        };

        records.forEach((record, index) => {
          const rowNumber = index + 2;
          const sku = (record['SKU'] || '').trim();
          const barcode = (record['Barcode'] || '').trim();
          const name = (record['Nama Barang'] || '').trim();
          const category = (record['Kategori'] || '').trim();
          const rowErrorsBefore = errors.length;
          if (!sku) errors.push({ row: rowNumber, message: 'SKU wajib diisi.' });
          if (!name) errors.push({ row: rowNumber, message: 'Nama barang wajib diisi.' });
          const skuKey = sku.toLowerCase();
          if (sku && seenSkus.has(skuKey)) {
            errors.push({ row: rowNumber, message: `SKU "${sku}" duplikat di dalam file CSV.` });
          }
          if (barcode && seenBarcodes.has(barcode)) {
            errors.push({ row: rowNumber, message: `Barcode "${barcode}" duplikat di dalam file CSV.` });
          }
          if (barcode && existingBarcodeMap.has(barcode) && existingBarcodeMap.get(barcode) !== skuKey) {
            errors.push({ row: rowNumber, message: `Barcode "${barcode}" sudah digunakan oleh produk lain di toko.` });
          }
          const initialStock = parseNumber(record['Stok Awal'], 'Stok awal', rowNumber, true);
          const minStock = parseNumber(record['Min Stok'], 'Min stok', rowNumber, true);
          const costPrice = parseNumber(record['Harga Beli (Rp)'], 'Harga beli', rowNumber);
          const sellPrice = parseNumber(record['Harga Jual (Rp)'], 'Harga jual', rowNumber);
          if ([initialStock, minStock, costPrice, sellPrice].some(value => value === null)) return;
          if (errors.length !== rowErrorsBefore) return;
          seenSkus.add(skuKey);
          if (barcode) seenBarcodes.add(barcode);
          rows.push({
            sku,
            barcode,
            name,
            brand: (record['Brand'] || '').trim() || '-',
            category: category || 'Umum',
            initial_stock: initialStock,
            min_stock: minStock,
            cost_price: costPrice,
            sell_price: sellPrice
          });
        });
        return { rows, errors };
      },
      commit: async function (rows) {
        try {
          if (!window.supabase) {
            throw new Error('Koneksi database Supabase tidak tersedia.');
          }

          // 1. Ambil data produk & kategori yang ada saat ini
          const [productsRes, categoriesRes] = await Promise.all([
            window.supabase.from('products').select('id, sku, barcode, stock'),
            window.supabase.from('categories').select('id, name')
          ]);

          const existingProds = productsRes.data || [];
          const prodMapBySku = new Map();
          existingProds.forEach(p => {
            if (p.sku) prodMapBySku.set(p.sku.trim().toLowerCase(), p);
          });

          // Mapping kategori
          const catMap = new Map();
          (categoriesRes.data || []).forEach(c => {
            if (c.name) catMap.set(c.name.trim().toLowerCase(), c.id);
          });

          // Auto-insert kategori baru dari file jika belum terdaftar
          const missingCategories = Array.from(new Set(
            rows.map(r => (r.category || '').trim()).filter(Boolean)
          )).filter(cName => !catMap.has(cName.toLowerCase()));

          if (missingCategories.length > 0) {
            try {
              const { data: createdCats } = await window.supabase
                .from('categories')
                .insert(missingCategories.map(name => ({ name })))
                .select('id, name');
              (createdCats || []).forEach(c => {
                if (c.name) catMap.set(c.name.trim().toLowerCase(), c.id);
              });
            } catch (catErr) {
              console.warn('Kategori baru otomatis dicatat jika memungkinkan:', catErr);
            }
          }

          // Pisahkan antara produk yang sudah ada (UPDATE / SINKRON) vs produk baru (INSERT)
          const toUpdate = [];
          const toInsert = [];

          rows.forEach(r => {
            const skuKey = (r.sku || '').trim().toLowerCase();
            const catName = (r.category || '').trim().toLowerCase();
            const categoryId = catMap.get(catName) || null;
            const existing = prodMapBySku.get(skuKey);

            if (existing) {
              const targetStock = Number(r.initial_stock) || 0;
              const currentStock = Number(existing.stock || 0);
              toUpdate.push({
                id: existing.id,
                sku: r.sku.trim(),
                barcode: r.barcode ? r.barcode.trim() : null,
                name: r.name.trim(),
                brand: r.brand ? r.brand.trim() : '-',
                category_id: categoryId,
                min_stock: Number(r.min_stock) || 3,
                cost_price: Number(r.cost_price) || 0,
                sell_price: Number(r.sell_price) || 0,
                target_stock: targetStock,
                current_stock: currentStock,
                updated_at: new Date().toISOString()
              });
            } else {
              toInsert.push({
                sku: r.sku.trim(),
                barcode: r.barcode ? r.barcode.trim() : null,
                name: r.name.trim(),
                brand: r.brand ? r.brand.trim() : '-',
                category_id: categoryId,
                unit_id: 1,
                stock: Number(r.initial_stock) || 0,
                min_stock: Number(r.min_stock) || 3,
                cost_price: Number(r.cost_price) || 0,
                sell_price: Number(r.sell_price) || 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          });

          // 2. Eksekusi UPDATE untuk produk yang sudah ada (metadata & penyesuaian stok ber-ledger)
          if (toUpdate.length > 0) {
            for (const item of toUpdate) {
              const { id, target_stock, current_stock, ...updateFields } = item;
              const { error: updErr } = await window.supabase
                .from('products')
                .update(updateFields)
                .eq('id', id);
              if (updErr) {
                console.warn(`Gagal menyinkronkan produk ${item.sku}:`, updErr);
              }

              // Jika ada selisih stok, wajib rekam melalui transaksi ledger koreksi stok
              if (typeof target_stock === 'number' && target_stock !== current_stock && typeof Api.items?.adjustStock === 'function') {
                try {
                  await Api.items.adjustStock(
                    id,
                    target_stock,
                    'Sinkronisasi Impor CSV',
                    `Penyesuaian stok via impor CSV dari ${current_stock} menjadi ${target_stock}`
                  );
                } catch (adjErr) {
                  console.warn(`Gagal mencatat mutasi stok opname untuk ${item.sku}:`, adjErr);
                }
              }
            }
          }

          // 3. Eksekusi INSERT untuk produk baru dengan stok awal terkunci 0
          if (toInsert.length > 0) {
            const rowsToInsert = toInsert.map(p => ({
              ...p,
              stock: 0 // Selalu 0 di awal, penambahan fisik melalui mutasi penerimaan awal
            }));

            const { data: createdProds, error: insErr } = await window.supabase
              .from('products')
              .insert(rowsToInsert)
              .select('id, sku, cost_price');

            if (insErr) {
              throw new Error(`Gagal menyimpan produk baru: ${insErr.message || 'Kesalahan database'}`);
            }

            // Catat penerimaan stok awal ber-ledger untuk produk baru yang memiliki stok awal > 0
            if (Array.isArray(createdProds)) {
              for (const cp of createdProds) {
                const origRow = toInsert.find(r => (r.sku || '').toLowerCase() === (cp.sku || '').toLowerCase());
                const initStock = Number(origRow?.stock || 0);
                if (initStock > 0 && typeof Api.transactions?.createIn === 'function') {
                  try {
                    await Api.transactions.createIn({
                      product_id: cp.id,
                      qty: initStock,
                      price: Number(cp.cost_price || 0),
                      note: 'Stok awal dari impor produk baru'
                    });
                  } catch (inErr) {
                    console.warn(`Gagal mencatat transaksi masuk awal untuk ${cp.sku}:`, inErr);
                  }
                }
              }
            }
          }

          return {
            ok: true,
            data: {
              updated_count: toUpdate.length,
              inserted_count: toInsert.length,
              total_count: rows.length
            }
          };
        } catch (err) {
          console.error('Import/sinkronisasi error:', err);
          return {
            ok: false,
            error: {
              message: err.message || 'Gagal menyimpan dan menyinkronkan produk.'
            }
          };
        }
      },
      onComplete: loadItemsFromBackend
    });
  });

  function setupSearchListeners() {
    const pageSearch = document.getElementById('search-items');
    const globalSearch = document.getElementById('global-search');

    if (pageSearch) {
      pageSearch.addEventListener('input', function (e) {
        handleSearchItems(e.target.value);
      });
    }
    if (globalSearch) {
      globalSearch.addEventListener('input', function (e) {
        handleSearchItems(e.target.value);
      });
    }
  }

  async function initItems() {
    setupSearchListeners();
    let retries = 0;
    while (typeof window.supabase === 'undefined' && retries < 20) {
      await new Promise(r => setTimeout(r, 50));
      retries++;
    }
    await loadCategories();
    await loadItemsFromBackend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initItems);
  } else {
    initItems();
  }
