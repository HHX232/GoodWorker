export interface CurrencyInfo {
  code: string
  symbol: string
  name: string
  /** How many units of this currency equal 1 RUB */
  rateFromRub: number
  flag: string
}

/**
 * Approximate rates vs RUB (updated May 2025).
 * In production swap rateFromRub values from a live exchange-rate API.
 */
export const CURRENCIES: CurrencyInfo[] = [
  // ── Tier 1: most familiar ─────────────────────────────────────────────────
  { code: 'RUB', symbol: '₽',   name: 'Российский рубль',        rateFromRub: 1,         flag: '🇷🇺' },
  { code: 'USD', symbol: '$',   name: 'Доллар США',               rateFromRub: 0.0110,    flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',   name: 'Евро',                     rateFromRub: 0.0101,    flag: '🇪🇺' },
  { code: 'BYN', symbol: 'Br',  name: 'Белорусский рубль',        rateFromRub: 0.0360,    flag: '🇧🇾' },
  { code: 'GBP', symbol: '£',   name: 'Фунт стерлингов',          rateFromRub: 0.0087,    flag: '🇬🇧' },
  { code: 'CNY', symbol: '¥',   name: 'Китайский юань',           rateFromRub: 0.0800,    flag: '🇨🇳' },
  { code: 'INR', symbol: '₹',   name: 'Индийская рупия',          rateFromRub: 0.9200,    flag: '🇮🇳' },
  { code: 'JPY', symbol: '¥',   name: 'Японская иена',            rateFromRub: 1.6400,    flag: '🇯🇵' },
  { code: 'KZT', symbol: '₸',   name: 'Казахстанский тенге',      rateFromRub: 5.0000,    flag: '🇰🇿' },
  { code: 'UAH', symbol: '₴',   name: 'Украинская гривна',        rateFromRub: 0.4400,    flag: '🇺🇦' },
  // ── Tier 2: emerging markets ──────────────────────────────────────────────
  { code: 'TRY', symbol: '₺',   name: 'Турецкая лира',            rateFromRub: 0.3600,    flag: '🇹🇷' },
  { code: 'UZS', symbol: "so'm",name: 'Узбекский сум',            rateFromRub: 143.0,     flag: '🇺🇿' },
  { code: 'AED', symbol: 'د.إ', name: 'Дирхам ОАЭ',               rateFromRub: 0.0400,    flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼',   name: 'Саудовский риял',          rateFromRub: 0.0413,    flag: '🇸🇦' },
  { code: 'BRL', symbol: 'R$',  name: 'Бразильский реал',         rateFromRub: 0.0550,    flag: '🇧🇷' },
  { code: 'MXN', symbol: '$',   name: 'Мексиканский песо',        rateFromRub: 0.2170,    flag: '🇲🇽' },
  { code: 'ZAR', symbol: 'R',   name: 'Южноафриканский рэнд',     rateFromRub: 0.2000,    flag: '🇿🇦' },
  { code: 'NGN', symbol: '₦',   name: 'Нигерийская найра',        rateFromRub: 16.700,    flag: '🇳🇬' },
  { code: 'EGP', symbol: '£',   name: 'Египетский фунт',          rateFromRub: 0.5300,    flag: '🇪🇬' },
  { code: 'PKR', symbol: '₨',   name: 'Пакистанская рупия',       rateFromRub: 3.0300,    flag: '🇵🇰' },
  { code: 'BDT', symbol: '৳',   name: 'Бангладешская така',       rateFromRub: 1.2000,    flag: '🇧🇩' },
  { code: 'IDR', symbol: 'Rp',  name: 'Индонезийская рупия',      rateFromRub: 178.0,     flag: '🇮🇩' },
  { code: 'VND', symbol: '₫',   name: 'Вьетнамский донг',         rateFromRub: 278.0,     flag: '🇻🇳' },
  { code: 'PHP', symbol: '₱',   name: 'Филиппинское песо',        rateFromRub: 0.6250,    flag: '🇵🇭' },
  { code: 'THB', symbol: '฿',   name: 'Тайский бат',              rateFromRub: 0.3920,    flag: '🇹🇭' },
  { code: 'MYR', symbol: 'RM',  name: 'Малайзийский ринггит',     rateFromRub: 0.0488,    flag: '🇲🇾' },
  { code: 'KRW', symbol: '₩',   name: 'Южнокорейская вона',       rateFromRub: 15.150,    flag: '🇰🇷' },
  // ── Tier 3: European & other developed ───────────────────────────────────
  { code: 'CHF', symbol: 'Fr',  name: 'Швейцарский франк',        rateFromRub: 0.0097,    flag: '🇨🇭' },
  { code: 'CAD', symbol: 'C$',  name: 'Канадский доллар',         rateFromRub: 0.0149,    flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$',  name: 'Австралийский доллар',     rateFromRub: 0.0169,    flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$',  name: 'Сингапурский доллар',      rateFromRub: 0.0147,    flag: '🇸🇬' },
  { code: 'HKD', symbol: 'HK$', name: 'Гонконгский доллар',       rateFromRub: 0.0855,    flag: '🇭🇰' },
  { code: 'TWD', symbol: 'NT$', name: 'Тайваньский доллар',       rateFromRub: 0.3570,    flag: '🇹🇼' },
  { code: 'PLN', symbol: 'zł',  name: 'Польский злотый',          rateFromRub: 0.0430,    flag: '🇵🇱' },
  { code: 'SEK', symbol: 'kr',  name: 'Шведская крона',           rateFromRub: 0.1160,    flag: '🇸🇪' },
  { code: 'NOK', symbol: 'kr',  name: 'Норвежская крона',         rateFromRub: 0.1180,    flag: '🇳🇴' },
  { code: 'DKK', symbol: 'kr',  name: 'Датская крона',            rateFromRub: 0.0750,    flag: '🇩🇰' },
  { code: 'CZK', symbol: 'Kč',  name: 'Чешская крона',            rateFromRub: 0.2500,    flag: '🇨🇿' },
  { code: 'HUF', symbol: 'Ft',  name: 'Венгерский форинт',        rateFromRub: 4.0000,    flag: '🇭🇺' },
  { code: 'RON', symbol: 'lei', name: 'Румынский лей',            rateFromRub: 0.0500,    flag: '🇷🇴' },
  { code: 'ILS', symbol: '₪',   name: 'Израильский шекель',       rateFromRub: 0.0400,    flag: '🇮🇱' },
  { code: 'QAR', symbol: 'QR',  name: 'Катарский риял',           rateFromRub: 0.0400,    flag: '🇶🇦' },
]

export function convertFromRub(amountRub: number, currency: CurrencyInfo): number {
  return amountRub * currency.rateFromRub
}

export function formatConverted(amountRub: number, currency: CurrencyInfo): string {
  const amount = convertFromRub(amountRub, currency)
  // Choose decimal precision by magnitude
  let formatted: string
  if (amount >= 10_000) {
    formatted = Math.round(amount).toLocaleString('en-US')
  } else if (amount >= 100) {
    formatted = Math.round(amount).toString()
  } else if (amount >= 1) {
    formatted = amount.toFixed(2)
  } else {
    formatted = amount.toFixed(4)
  }
  return `${currency.symbol}${formatted}`
}

/** Currencies to show prominently (first row) — excludes RUB (it's the input). */
export const FEATURED_CURRENCIES = CURRENCIES.filter((c) => c.code !== 'RUB')

/** Default display currency per app locale. */
export const LOCALE_DEFAULT_CURRENCY: Record<string, string> = {
  ru: 'BYN',
  en: 'USD',
  zh: 'CNY',
  hi: 'INR',
}

/** Convert an amount from one currency to another using RUB as intermediate. */
export function convertBetween(amount: number, fromCode: string, toCode: string): number {
  if (fromCode === toCode) return amount
  const from = CURRENCIES.find(c => c.code === fromCode)
  const to = CURRENCIES.find(c => c.code === toCode)
  if (!from || !to || from.rateFromRub === 0) return amount
  const inRub = amount / from.rateFromRub
  return inRub * to.rateFromRub
}

/** Format a price in its native currency with symbol. */
export function formatPrice(amount: number, currencyCode: string): string {
  const cur = CURRENCIES.find(c => c.code === currencyCode)
  if (!cur) return `${amount.toLocaleString()} ${currencyCode}`
  const formatted = amount >= 1000
    ? Math.round(amount).toLocaleString('ru-RU')
    : amount % 1 === 0
      ? amount.toString()
      : amount.toFixed(2)
  return `${formatted} ${cur.symbol}`
}

/** Small set of currencies to show in the price tooltip. */
export const TOOLTIP_CURRENCIES = ['USD', 'EUR', 'RUB', 'CNY', 'KZT']
