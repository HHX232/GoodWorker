import type { MetadataRoute } from 'next'
import { prisma } from '@/shared/prisma/prisma'

import { SITE_URL } from '@/shared/lib/seo/siteUrl'
// Built per request: the DB is not reachable during the Railway build, a prerendered sitemap would have no posts.
export const dynamic = 'force-dynamic'

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/info-lecture', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/info-pdf-to-test', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/teachers', priority: 0.8, changeFrequency: 'daily' },
  { path: '/posts', priority: 0.8, changeFrequency: 'daily' },
  { path: '/vip', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/pomodoro', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/game', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const pages: MetadataRoute.Sitemap = STATIC.map(p => ({ url: `${SITE_URL}${p.path === '/' ? '' : p.path}`, lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority }))
  try {
    const posts = await prisma.post.findMany({
      where: { visibility: 'PUBLIC', moderationStatus: 'PUBLISHED', slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
    for (const p of posts) pages.push({ url: `${SITE_URL}/post/${encodeURIComponent(p.slug!)}`, lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.6 })
  } catch (e) {
    // The DB being down must not take the static part of the sitemap with it.
    console.error('[sitemap] posts failed', e)
  }
  return pages
}
