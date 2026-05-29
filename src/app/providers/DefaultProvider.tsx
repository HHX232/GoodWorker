'use client'

import {store} from '@/entities/store/store'
import {useHeartbeat} from '@/features/hooks/User/useHeartbeat'
import {PomodoroProvider} from '@/widgets/Pomodoro/PomodoroContext'
import {QueryCache, QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {AxiosError} from 'axios'
import {SessionProvider, signOut} from 'next-auth/react'
import {ReactNode, useEffect, useState} from 'react'
import {Provider as ReduxProvider} from 'react-redux'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReduxProviderWrapper = ({children, ...props}: any) => {
  return <ReduxProvider {...props}>{children}</ReduxProvider>
}

function HeartbeatRunner() {
  useHeartbeat()
  return null
}

// Сбрасывает overflow:hidden когда браузер восстанавливает страницу из bfcache.
// На мобилке страница «замораживается» с открытой модалкой и при возврате
// остаётся заблокированный скролл.
function BfcacheScrollFix() {
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        document.body.style.removeProperty('overflow')
        document.documentElement.style.removeProperty('overflow')
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])
  return null
}

let signingOut = false

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        const status = (error as AxiosError).response?.status
        if (status === 401 && typeof window !== 'undefined' && !signingOut) {
          signingOut = true
          signOut({redirect: true, callbackUrl: '/login'})
        }
      }
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as AxiosError).response?.status
          if (status === 401 || status === 403) return false
          return failureCount < 2
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000)
      }
    }
  })
}

export default function DefaultProvider({children}: {children: ReactNode}) {
  const [queryClient] = useState(makeQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ReduxProviderWrapper store={store}>
          <PomodoroProvider>
            <HeartbeatRunner />
            <BfcacheScrollFix />
            {children}
          </PomodoroProvider>
        </ReduxProviderWrapper>
      </SessionProvider>
    </QueryClientProvider>
  )
}
