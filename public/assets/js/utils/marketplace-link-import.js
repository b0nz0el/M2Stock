export const MARKETPLACE_LINK_CSV_HEADERS = [
  'SKU',
  'Nama Produk',
  'Shopee URL',
  'Tokopedia URL',
  'Lazada URL',
  'TikTok URL',
  'WhatsApp URL'
];

const CHANNEL_COLUMNS = [
  { header: 'Shopee URL', channel: 'Shopee', hosts: ['shopee.co.id'] },
  { header: 'Tokopedia URL', channel: 'Tokopedia', hosts: ['tokopedia.com'] },
  { header: 'Lazada URL', channel: 'Lazada', hosts: ['lazada.co.id'] },
  { header: 'TikTok URL', channel: 'TikTok Shop', hosts: ['tiktok.com', 'shop-id.tokopedia.com'] },
  { header: 'WhatsApp URL', channel: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'] }
];

function normalizeSku(value) {
  return String(value || '').trim().toLocaleUpperCase('en-US');
}

function channelKey(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US');
}

export function normalizeImportedChannelUrl(channel, value) {
  const column = CHANNEL_COLUMNS.find(entry => channelKey(entry.channel) === channelKey(channel));
  const raw = String(value || '').trim();
  if (!column || !raw) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase();
    const allowed = column.hosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function getExistingChannels(product) {
  if (Array.isArray(product?.channels)) {
    return product.channels
      .filter(channel => channel && typeof channel.channel === 'string')
      .map(channel => ({ channel: channel.channel, link: String(channel.link || '') }));
  }

  const rawLink = String(product?.channel_link || '');
  if (rawLink.startsWith('[')) {
    try {
      const channels = JSON.parse(rawLink);
      if (Array.isArray(channels)) {
        return channels
          .filter(channel => channel && typeof channel.channel === 'string')
          .map(channel => ({ channel: channel.channel, link: String(channel.link || '') }));
      }
    } catch {
      return [];
    }
  }

  return product?.channel || rawLink
    ? [{ channel: product.channel || 'Offline', link: rawLink }]
    : [];
}

export function prepareMarketplaceLinkImport(records, products) {
  const productsBySku = new Map();
  for (const product of products || []) {
    const sku = normalizeSku(product?.sku);
    if (!sku) continue;
    const matches = productsBySku.get(sku) || [];
    matches.push(product);
    productsBySku.set(sku, matches);
  }

  const seenSkus = new Set();
  const rows = [];
  const errors = [];
  const skipped = [];

  (records || []).forEach((record, index) => {
    const rowNumber = index + 2;
    const sku = String(record?.SKU || '').trim();
    const skuKey = normalizeSku(sku);

    if (!skuKey) {
      errors.push({ row: rowNumber, message: 'SKU wajib diisi.' });
      return;
    }
    if (seenSkus.has(skuKey)) {
      errors.push({ row: rowNumber, message: `SKU "${sku}" duplikat di dalam file CSV.` });
      return;
    }
    seenSkus.add(skuKey);

    const matches = productsBySku.get(skuKey) || [];
    if (matches.length === 0) {
      skipped.push({ row: rowNumber, sku, message: `SKU "${sku}" tidak ditemukan di M2Stock.` });
      return;
    }
    if (matches.length > 1) {
      errors.push({ row: rowNumber, message: `SKU "${sku}" ditemukan lebih dari sekali di M2Stock; impor dibatalkan demi keamanan.` });
      return;
    }

    const importedLinks = [];
    const sourceRecord = { SKU: sku };
    for (const column of CHANNEL_COLUMNS) {
      const value = String(record?.[column.header] || '').trim();
      if (!value) continue;
      const link = normalizeImportedChannelUrl(column.channel, value);
      if (!link) {
        errors.push({ row: rowNumber, message: `URL ${column.channel} tidak valid atau domainnya tidak sesuai.` });
      } else {
        importedLinks.push({ channel: column.channel, link });
        sourceRecord[column.header] = value;
      }
    }
    if (importedLinks.length === 0) {
      errors.push({ row: rowNumber, message: 'Isi minimal satu URL channel. Kolom URL kosong mempertahankan link yang sudah tersimpan.' });
      return;
    }

    const channels = getExistingChannels(matches[0]);
    for (const imported of importedLinks) {
      const existing = channels.find(channel => channelKey(channel.channel) === channelKey(imported.channel));
      if (existing) existing.link = imported.link;
      else channels.push(imported);
    }

    const channel = channels[0]?.channel || importedLinks[0].channel;
    const channelLink = channels.length > 1
      ? JSON.stringify(channels)
      : (channels[0]?.link || null);
    rows.push({
      id: matches[0].id,
      sku: matches[0].sku,
      channel,
      channel_link: channelLink,
      channels,
      sourceRecord
    });
  });

  return { rows, errors, skipped };
}
