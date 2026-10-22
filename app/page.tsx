import LandingPage from '@/_pages/PublickPages/LandingPage/LandingPage'
import { parseAudience } from '@/_pages/PublickPages/LandingPage/audience'
import Footer from '@/widgets/Footer/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GoodWorker — платформа для учителей и студентов',
  description: 'Визуальный конструктор уроков, авто-транскрипция звонков, общая лента постов и календарь занятий',
  // ?isForTeacher и пр. — рекламные варианты той же страницы, не дубли для поиска
  alternates: { canonical: '/' },
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const audience = parseAudience(await searchParams)
  return (
    <>
      <LandingPage audience={audience} />
      <Footer />
    </>
  )
}
