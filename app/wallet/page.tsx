import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import { WalletPage } from '@/widgets/Wallet/WalletPage/WalletPage'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('wallet') }
}

export default async function WalletRoute() {
  const session = await auth()
  if (!session) redirect('/login')

  // Both TEACHER/ADMIN and STUDENT sessions land here — balance/history are
  // scoped server-side by the wallet API (user comes strictly from session).
  return <WalletPage />
}
