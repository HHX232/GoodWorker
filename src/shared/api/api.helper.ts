export const getCurrentLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith('NEXT_LOCALE='))
      ?.split('=')[1]

    if (cookieValue) {
      return cookieValue
    }
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    if (parts.length > 2) {
      const subdomain = parts[0]
      switch (subdomain) {
        case 'cn':
          return 'zh'
        case 'en':
          return 'en'
        case 'in':
        case 'hi':
          return 'hi'
      }
    }
    if (parts.length === 2 && parts[0] === 'exporteru') {
      return 'ru'
    }

    const pathname = window.location.pathname
    const langMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
    if (langMatch) {
      return langMatch[1]
    }
  }
  return 'en'
}

export const getContentType = (overrideLang?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const currentLang = overrideLang || getCurrentLanguage()
  headers['Accept-Language'] = currentLang
  headers['X-Requested-With'] = 'XMLHttpRequest'
  headers['Accept'] = 'application/json'

  return headers
}

type TAllLang = 'ru' | 'en' | 'zh' | 'hi'

export const getAbsoluteLanguage = async (): Promise<TAllLang> => {
  const isServer = typeof window === 'undefined'

  if (isServer) {
    const {cookies, headers} = await import('next/headers')

    const cookieStore = await cookies()
    let locale = cookieStore.get('NEXT_LOCALE')?.value

    if (!locale) {
      const headersList = await headers()
      locale = headersList.get('x-next-intl-locale') || headersList.get('x-locale') || undefined

      if (!locale) {
        const referer = headersList.get('referer')
        if (referer) {
          const match = referer.match(/\/([a-z]{2})\//)
          if (match && ['en', 'ru', 'zh'].includes(match[1])) {
            locale = match[1]
          }
        }
      }
    }

    return (locale as TAllLang) || 'en'
  } else {
    const cookieMatch = document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]*)/)
    let locale = cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined

    if (!locale) {
      const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/)
      if (match && ['en', 'ru', 'zh'].includes(match[1])) {
        locale = match[1]
      }
    }

    return (locale as TAllLang) || 'en'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorCatch = (error: any): string =>
  error.response && error.response.data && error.response.data.message
    ? typeof error.response.data.message === 'object'
      ? error.response.data.message[0]
      : error.response.data.essage
    : error.message
