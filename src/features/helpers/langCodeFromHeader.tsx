const SUPPORTED = ['ru', 'en', 'zh', 'hi'] as const
type SupportedLang = typeof SUPPORTED[number]

export function langFromRequest(req: { headers: { get: (k: string) => string | null } }): SupportedLang {
  const header = req.headers.get('accept-language') ?? ''
  // "zh-CN,zh;q=0.9,en;q=0.8" → берём первый тег
  const primary = header.split(',')[0]?.split('-')[0]?.toLowerCase() ?? 'ru'
  return (SUPPORTED.includes(primary as SupportedLang) ? primary : 'ru') as SupportedLang
}