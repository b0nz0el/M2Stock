const CHANNEL_ICON_CONFIG = [
  {
    names: ['shopee'],
    icon: 'brand-shopee',
    color: 'text-white',
    background: 'bg-[#EE4D2D]',
    border: 'border-transparent'
  },
  {
    names: ['tokopedia'],
    icon: 'brand-tokopedia',
    color: 'text-white',
    background: 'bg-[#00AA5B]',
    border: 'border-transparent'
  },
  {
    names: ['tiktok', 'tiktok shop'],
    icon: 'brand-tiktok-shop',
    color: 'text-white',
    background: 'bg-black',
    border: 'border-[#303030]'
  },
  {
    names: ['lazada'],
    icon: 'brand-lazada',
    color: 'text-[#D1D5DB]',
    background: 'bg-[#F3F4F6]',
    border: 'border-transparent'
  },
  {
    names: ['whatsapp'],
    icon: 'brand-whatsapp',
    color: 'text-white',
    background: 'bg-[#16A34A]',
    border: 'border-transparent'
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
