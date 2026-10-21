'use client'

import type { ReactNode } from 'react'
import { ChessShell } from '@/widgets/Chess/Shell'
import { OnlineLobby } from './Online/OnlineLobbyPage'
import { ChessProfilePage } from './Profile/ChessProfilePage'

/** The shell around every /chess/* page, with the page-level bodies its lobby modal and profile drawer show. */
export function ChessLayout({ children }: { children: ReactNode }) {
  return (
    <ChessShell lobby={({ search, tc, seek }) => <OnlineLobby search={search} initialTc={tc} autoSeek={seek} />} profile={<ChessProfilePage compact />}>
      {children}
    </ChessShell>
  )
}
