import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LectureLanding } from '@/_pages/PublickPages/LectureLanding/LectureLanding'
import type { FaqItem } from '@/_pages/PublickPages/LectureLanding/Seo'
import { SITE_URL } from '@/shared/lib/seo/siteUrl'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lectureLanding')
  const title = t('metaTitle')
  const description = t('metaDescription')
  return {
    title,
    description,
    keywords: t.raw('seo.keywords') as string[],
    alternates: { canonical: `${SITE_URL}/info-lecture` },
    openGraph: { title, description, url: `${SITE_URL}/info-lecture`, type: 'website', siteName: 'GoodWorker' },
  }
}

// Public landing for /lecture. The FAQ is also given to search engines as FAQPage structured data.
export default async function LectureInfoPage() {
  const t = await getTranslations('lectureLanding.seo')
  const faq = t.raw('faq') as FaqItem[]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <LectureLanding />
    </>
  )
}
