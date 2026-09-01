import { langFromRequest } from '@/features/helpers/langCodeFromHeader'
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('NEXT_LOCALE')?.value
  const locale = cookieLocale || langFromRequest({ headers: await headers() })

  return {
    locale,
    messages: (await import(`../../../messages/${locale}.json`)).default
  }
})
