import { describe, expect, it } from 'vitest';
import { getChannelIconConfig } from '../public/assets/js/utils/channel-icons.js';

describe('marketplace channel icons', () => {
  it.each([
    ['Shopee', 'shopping-bag', 'text-[#EE4D2D]'],
    ['Tokopedia', 'store', 'text-[#00AA5B]'],
    ['TikTok Shop', 'music-2', 'text-[#00F2FE]'],
    ['WhatsApp', 'message-circle', 'text-[#25D366]']
  ])('maps %s to its brand icon and color', (channel, icon, color) => {
    expect(getChannelIconConfig(channel)).toMatchObject({ icon, color });
  });

  it('matches channel names without case sensitivity and provides a fallback', () => {
    expect(getChannelIconConfig(' tIkToK SHOP ')).toMatchObject({ icon: 'music-2' });
    expect(getChannelIconConfig('Custom Store')).toMatchObject({ icon: 'store' });
  });
});
