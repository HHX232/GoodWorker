'use client'

import { store } from '@/entities/store/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from "next-auth/react"
import { ReactNode, useState } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Provider = ({children, ...props}: any) => {
  return <ReduxProvider {...props}>{children}</ReduxProvider>
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
      <Provider store={store}>{children}</Provider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
