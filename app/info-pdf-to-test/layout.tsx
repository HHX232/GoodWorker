import type { Metadata } from 'next'
import { Onest } from 'next/font/google'

const onest = Onest({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '500', '600', '700', '800'], display: 'swap' })

export const metadata: Metadata = {
  title: 'GoodWorker Тесты — PDF в интерактивный тест',
  description: 'Загрузите PDF с вопросами и ответами — получите готовый тест онлайн. Выбор вариантов, сопоставление пар, ввод ответа — структуру распознаём автоматически.',
}

export default function PdfInfoLayout({ children }: { children: React.ReactNode }) {
  return <div className={onest.className} style={{ isolation: 'isolate' }}>{children}</div>
}
