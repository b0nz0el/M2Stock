const SUPABASE_URL = 'https://kvdktgknwxmqpankwpre.supabase.co';
const HABITIC_SYNC_URL = 'https://habitic.pages.dev/api/sync/aquastock-products';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost({ request, env }) {
  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const apiKey = request.headers.get('X-Supabase-Key') || '';
  const syncSecret = env?.HABITIC_SYNC_SECRET;

  if (!accessToken) return jsonResponse({ success: false, error: 'Sesi Aquastock tidak ditemukan. Silakan login ulang.' }, 401);
  if (!apiKey) return jsonResponse({ success: false, error: 'Konfigurasi Supabase browser tidak tersedia.' }, 400);
  if (!syncSecret) return jsonResponse({ success: false, error: 'Integrasi Habitic belum dikonfigurasi di server Aquastock.' }, 503);

  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json'
  };

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    if (!userResponse.ok) {
      return jsonResponse({ success: false, error: 'Sesi Supabase tidak valid atau telah berakhir. Silakan login ulang.' }, 401);
    }
    const user = await userResponse.json();
    if (!user?.id) return jsonResponse({ success: false, error: 'Identitas pengguna Aquastock tidak dapat diverifikasi.' }, 401);

    const productsUrl = new URL(`${SUPABASE_URL}/rest/v1/products`);
    productsUrl.searchParams.set('select', 'sku,channel,channel_link');
    productsUrl.searchParams.set('limit', '251');
    const productsResponse = await fetch(productsUrl, {
      headers,
      signal: AbortSignal.timeout(15000)
    });
    if (!productsResponse.ok) {
      return jsonResponse({ success: false, error: 'Data produk marketplace gagal dibaca dari Supabase.' }, 502);
    }

    const products = await productsResponse.json();
    if (!Array.isArray(products) || products.length > 250) {
      return jsonResponse({ success: false, error: 'Sinkronisasi dibatasi maksimal 250 produk per proses.' }, 413);
    }

    const items = products
      .filter(product => typeof product?.sku === 'string' && product.sku.trim())
      .map(product => ({
        sku: product.sku,
        channel: product.channel || '',
        channel_link: product.channel_link || ''
      }));

    const syncResponse = await fetch(HABITIC_SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aquastock-Sync-Token': syncSecret
      },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(20000)
    });
    const result = await syncResponse.json().catch(() => null);
    if (!syncResponse.ok || result?.success !== true) {
      return jsonResponse({
        success: false,
        error: result?.error || `Server Habitic menolak sinkronisasi (HTTP ${syncResponse.status}).`
      }, syncResponse.status >= 400 && syncResponse.status < 600 ? syncResponse.status : 502);
    }

    return jsonResponse({
      success: true,
      sourceProducts: items.length,
      summary: result.summary
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error('Sinkronisasi link marketplace ke Habitic gagal:', error);
    return jsonResponse({
      success: false,
      error: timedOut ? 'Sinkronisasi melewati batas waktu. Coba kembali.' : 'Koneksi sinkronisasi gagal. Periksa koneksi dan konfigurasi server.'
    }, 502);
  }
}
