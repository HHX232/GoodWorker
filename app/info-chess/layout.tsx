import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Forum, JetBrains_Mono, Onest } from 'next/font/google'

// Forum — антиквенные заголовки, Onest — текст, JetBrains Mono — только часы и запись ходов; все с кириллицей.
const forum = Forum({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-forum', display: 'swap' })
const onest = Onest({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600'], variable: '--font-onest', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--font-jbmono', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('chess.landing')
  const title = t('meta_title')
  const description = t('meta_description')
  return {
    title,
    description,
    openGraph: { title, description, url: '/info-chess', type: 'website', siteName: 'GoodWorker' },
  }
}

export default function ChessInfoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${forum.variable} ${onest.variable} ${mono.variable}`}>{children}</div>
}
