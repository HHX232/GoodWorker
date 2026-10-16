import { langFromRequest } from '@/features/helpers/langCodeFromHeader'
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

// Chess strings live in messages/chess/<area>/<locale>.json and are mounted as `chess.<area>`.
const CHESS_AREAS = ['core', 'play', 'learn', 'call', 'course'] as const

async function chessMessages(locale: string) {
  const entries = await Promise.all(
    CHESS_AREAS.map(async (area) => {
      try {
        return [area, (await import(`../../../messages/chess/${area}/${locale}.json`)).default] as const
      } catch (e) {
        // a missing area/locale file is fine; a broken one is a bug worth seeing
        const missing = (e as { code?: string }).code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(String(e))
        if (!missing) console.error(`[i18n] messages/chess/${area}/${locale}.json:`, e)
        return [area, {}] as const
      }
    })
  )
  return Object.fromEntries(entries)
}

export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('NEXT_LOCALE')?.value
  const locale = cookieLocale || langFromRequest({ headers: await headers() })

  return {
    locale,
    messages: {
      ...(await import(`../../../messages/${locale}.json`)).default,
      chess: await chessMessages(locale),
    },
  }
})
