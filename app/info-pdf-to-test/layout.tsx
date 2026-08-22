import type { Metadata } from 'next'
import { Archivo, Bodoni_Moda } from 'next/font/google'

// Neither family ships Cyrillic glyphs on Google Fonts — ru/other Cyrillic text falls back to the
// web-safe stack in the page CSS (Georgia / Helvetica), matching the prototype's fallback design.
const archivo = Archivo({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-archivo', display: 'swap' })
const bodoni = Bodoni_Moda({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '700', '900'], style: ['normal', 'italic'], variable: '--font-bodoni', display: 'swap' })

export const metadata: Metadata = {
  title: 'GoodWorker Тесты — PDF в интерактивный тест',
  description: 'Загрузите PDF с вопросами и ответами — получите готовый тест онлайн. Выбор вариантов, сопоставление пар, ввод ответа — структуру распознаём автоматически.',
}

export default function PdfInfoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${archivo.variable} ${bodoni.variable}`} style={{ isolation: 'isolate' }}>{children}</div>
}
