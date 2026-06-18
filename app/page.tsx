import LandingPage from '@/_pages/PublickPages/LandingPage/LandingPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GoodWorker — платформа для учителей и студентов',
  description: 'Визуальный конструктор уроков, авто-транскрипция звонков, общая лента постов и календарь занятий',
}

export default function Home() {
  return <LandingPage />
}
