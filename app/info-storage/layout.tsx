import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Caveat, Manrope } from 'next/font/google'

// Manrope — основной шрифт страницы, Caveat — рукописная подпись в hero; оба с кириллицей.
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' })
const caveat = Caveat({ subsets: ['latin', 'cyrillic'], weight: ['600'], variable: '--font-caveat', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('StorageLanding')
  const title = t('meta_title')
  const description = t('meta_description')
  return {
    title,
    description,
    openGraph: { title, description, url: '/info-storage', type: 'website', siteName: 'GoodWorker' },
  }
}

export default function StorageInfoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${manrope.variable} ${caveat.variable}`}>{children}</div>
}
