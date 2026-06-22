import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import type { GlobeDotData } from '@/shared/types/GlobeDot.type'

export type { GlobeDotData }

const SUPPORTED_LOCALES = ['ru', 'en', 'zh', 'hi']

function pickLocale(raw: string | null): string {
  return SUPPORTED_LOCALES.includes(raw ?? '') ? (raw as string) : 'ru'
}

export async function GET(req: NextRequest) {
  const locale = pickLocale(new URL(req.url).searchParams.get('locale'))

  try {
    // ── 1. Popular posts: high rating + enough reviews ──────────────────────
    // Find posts that have enough ratings, then filter by avgRating
    const ratingGroups = await prisma.postRating.groupBy({
      by: ['postId'],
      _avg: { stars: true },
      _count: { stars: true },
      having: { stars: { _count: { gte: 1 } } },  // at least 1 rating
      orderBy: { _avg: { stars: 'desc' } },
      take: 50,
    })

    // Sort: prefer 50+ reviews 4.5+, fall back to highest rating
    const sorted = ratingGroups
      .filter(r => (r._avg.stars ?? 0) >= 4.0)
      .sort((a, b) => {
        const aScore = (a._avg.stars ?? 0) * Math.log1p(a._count.stars)
        const bScore = (b._avg.stars ?? 0) * Math.log1p(b._count.stars)
        return bScore - aScore
      })
      .slice(0, 6)

    const popularPostIds = sorted.map(r => r.postId)

    const popularPosts = popularPostIds.length
      ? await prisma.post.findMany({
          where: { id: { in: popularPostIds }, visibility: 'PUBLIC' },
          select: { id: true, title: true, titleTranslations: true },
        })
      : []

    // Keep original sorted order, resolve titles
    const postDots: GlobeDotData[] = popularPostIds
      .map(id => popularPosts.find(p => p.id === id))
      .filter(Boolean)
      .map(p => {
        const translations = (p!.titleTranslations as Record<string, string> | null) ?? {}
        const label = translations[locale] || translations['ru'] || p!.title
        return { label, href: `/post/${p!.id}`, type: 'post' as const }
      })

    // ── 2. Top categories by post count ─────────────────────────────────────
    const usedPostIds = new Set(postDots.map(d => d.href.replace('/post/', '')))
    const remaining = Math.max(0, 12 - postDots.length)

    const topCategories = remaining > 0
      ? await prisma.category.findMany({
          where: { posts: { some: { visibility: 'PUBLIC' } } },
          include: {
            translations: true,
            _count: { select: { posts: true } },
          },
          orderBy: { posts: { _count: 'desc' } },
          take: remaining + 4, // extra buffer
        })
      : []

    const catDots: GlobeDotData[] = []
    for (const cat of topCategories) {
      if (catDots.length >= remaining) break

      const label =
        cat.translations.find(t => t.langCode === locale)?.name ??
        cat.translations.find(t => t.langCode === 'ru')?.name ??
        cat.slug

      // Best post in this category not already shown
      const topPost = await prisma.post.findFirst({
        where: {
          categoryId: cat.id,
          visibility: 'PUBLIC',
          id: { notIn: [...usedPostIds] },
          viewCount: { gt: 0 },
        },
        orderBy: { viewCount: 'desc' },
        select: { id: true, viewCount: true },
      })

      const href =
        topPost && topPost.viewCount >= 3
          ? `/post/${topPost.id}`
          : `/posts?categoryId=${cat.id}`

      const type: GlobeDotData['type'] = href.startsWith('/post/') ? 'post' : 'category'
      catDots.push({ label, href, type })
    }

    const dots = [...postDots, ...catDots].slice(0, 12)

    return NextResponse.json(dots, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
