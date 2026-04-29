'use client'

import {store} from '@/entities/store/store'
import {useHeartbeat} from '@/features/hooks/User/useHeartbeat'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SessionProvider} from 'next-auth/react'
import {ReactNode, useState} from 'react'
import {Provider as ReduxProvider} from 'react-redux'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReduxProviderWrapper = ({children, ...props}: any) => {
  return <ReduxProvider {...props}>{children}</ReduxProvider>
}

function HeartbeatRunner() {
  useHeartbeat()
  return null
}

export default function DefaultProvider({children}: {children: ReactNode}) {
  const [queryClient] = useState(
    new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false
        }
      }
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ReduxProviderWrapper store={store}>
          <HeartbeatRunner />
          {children}
        </ReduxProviderWrapper>
      </SessionProvider>
    </QueryClientProvider>
  )
}
