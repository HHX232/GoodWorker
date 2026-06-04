import TakeTestPage from '@/_pages/TestPages/TakeTestPage'
import { prisma } from '@/shared/prisma/prisma'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

interface Props { params: Promise<{ testId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { testId } = await params
  const t = await getTranslations('PageTitles')
  try {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { title: true }
    })
    if (test?.title) return { title: test.title }
  } catch {}
  return { title: t('takeTest') }
}

export default TakeTestPage
