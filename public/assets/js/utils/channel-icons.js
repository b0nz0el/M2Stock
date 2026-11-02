const CHANNEL_ICON_CONFIG = [
  {
    names: ['shopee'],
    icon: 'brand-shopee',
    color: 'text-[#EE4D2D]',
    background: 'bg-[#EE4D2D]/12',
    border: 'border-[#EE4D2D]/25'
  },
  {
    names: ['tokopedia'],
    icon: 'brand-tokopedia',
    color: 'text-[#00AA5B]',
    background: 'bg-[#03AC0E]/12',
    border: 'border-[#03AC0E]/25'
  },
  {
    names: ['tiktok', 'tiktok shop'],
    icon: 'brand-tiktok-shop',
    color: 'text-[#00F2FE]',
    background: 'bg-[#00F2FE]/10',
    border: 'border-[#00F2FE]/25'
  },
  {
    names: ['lazada'],
    icon: 'brand-lazada',
    color: 'text-[#F36F21]',
    background: 'bg-[#F36F21]/10',
    border: 'border-[#F36F21]/25'
  },
  {
    names: ['whatsapp'],
    icon: 'brand-whatsapp',
    color: 'text-[#25D366]',
    background: 'bg-[#25D366]/12',
    border: 'border-[#25D366]/25'
  }
];

export function getChannelIconConfig(channel) {
  const name = String(channel || '').trim().toLocaleLowerCase();
  return CHANNEL_ICON_CONFIG.find(config => config.names.includes(name)) || {
    icon: 'store',
    color: 'text-[#32ADE6]',
    background: 'bg-[#0088CC]/10',
    border: 'border-[#0088CC]/25'
  };
}
