import type { ReactNode } from 'react'
import { ChessLayout } from '@/_pages/Chess/ChessLayout'

export default function Layout({ children }: { children: ReactNode }) {
  return <ChessLayout>{children}</ChessLayout>
}
