import { describe, expect, it } from 'vitest';
import { getChannelIconConfig } from '../public/assets/js/utils/channel-icons.js';
import '../public/assets/js/icons.js';

describe('marketplace channel icons', () => {
  it.each([
    ['Shopee', 'brand-shopee', 'text-[#EE4D2D]', '0 0 24 24'],
    ['Tokopedia', 'brand-tokopedia', 'text-[#00AA5B]', '0 0 192 192'],
    ['TikTok Shop', 'brand-tiktok-shop', 'text-[#00F2FE]', '0 0 352 398'],
    ['Lazada', 'brand-lazada', 'text-[#F36F21]', '0 0 48 48'],
    ['WhatsApp', 'brand-whatsapp', 'text-[#25D366]', '0 0 24 24']
  ])('maps %s to its brand icon and color', (channel, icon, color) => {
    expect(getChannelIconConfig(channel)).toMatchObject({ icon, color });
  });

  it('matches channel names without case sensitivity and provides a fallback', () => {
    expect(getChannelIconConfig(' tIkToK SHOP ')).toMatchObject({ icon: 'brand-tiktok-shop' });
    expect(getChannelIconConfig('Custom Store')).toMatchObject({ icon: 'store' });
  });

  it.each([
    ['Shopee', 'brand-shopee', '0 0 24 24', 'currentColor', 'none'],
    ['Tokopedia', 'brand-tokopedia', '0 0 192 192', 'currentColor', 'none'],
    ['TikTok Shop', 'brand-tiktok-shop', '0 0 352 398', 'none', 'none'],
    ['Lazada', 'brand-lazada', '0 0 48 48', 'none', 'currentColor'],
    ['WhatsApp', 'brand-whatsapp', '0 0 24 24', 'currentColor', 'none']
  ])('renders supplied SVG geometry for %s', (channel, iconName, viewBox, fill, stroke) => {
    const root = document.createElement('div');
    root.innerHTML = `<i data-lucide="${iconName}"></i>`;
    document.body.appendChild(root);

    window.refreshIcons(root);

    const icon = root.querySelector('svg');
    expect(icon.getAttribute('viewBox')).toBe(viewBox);
    expect(icon.getAttribute('fill')).toBe(fill);
    expect(icon.getAttribute('stroke')).toBe(stroke);
    if (channel === 'TikTok Shop') {
      expect(icon.querySelector('[fill="#25F4EE"]')).not.toBeNull();
      expect(icon.querySelector('[fill="#FE2C55"]')).not.toBeNull();
      expect(icon.querySelector('[fill="#FFFFFF"]')).not.toBeNull();
    }

    root.remove();
  });
});
