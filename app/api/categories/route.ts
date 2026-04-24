// app/api/categories/route.ts
import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'

export async function GET(req: Request) {
  const {searchParams} = new URL(req.url)
  const langCode = searchParams.get('langCode') ?? 'ru'

  const categories = await prisma.category.findMany({
    include: {
      translations: {where: {langCode}}
    },
    orderBy: {levelNumber: 'asc'}
  })

  return NextResponse.json(
    categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      levelNumber: c.levelNumber,
      parentId: c.parentId,
      name: c.translations[0]?.name ?? c.slug
    }))
  )
}
