/* eslint-disable @typescript-eslint/no-explicit-any */
import HomePage from '@/_pages/PublickPages/HomePage/HomePage'
import { IPostResponse, IPostsQuery, IPostsResponse } from '@/features/services/PostService.service'
import { fetchPostsList } from '@/features/services/posts.server'
import { auth } from '../../auth'
import { getLocale, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('home') }
}

interface PostsPageRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PostsPage({ searchParams }: PostsPageRouteProps) {
  const params = await searchParams
  const locale = await getLocale()
  const session = await auth()

  const query: IPostsQuery = {
    page: params.page ? Number(params.page) : 1,
    limit: params.limit ? Number(params.limit) : 12,
    categoryId: typeof params.categoryId === 'string' ? params.categoryId : undefined,
    teacherId: typeof params.teacherId === 'string' ? params.teacherId : undefined,
    visibility: typeof params.visibility === 'string' ? (params.visibility as any) : 'any',
    search: typeof params.search === 'string' ? params.search : undefined,
    lang: locale,
  }

  const emptyResponse = { posts: [], pagination: { page: 1, limit: query.limit ?? 12, total: 0, totalPages: 0 } }
  const userId = session?.user?.id
  const userRole = session?.user?.role

  // fetchPostsList's Prisma-inferred shape omits `category` (the list view
  // never needed it), which IPostResponse declares as always-present — the
  // same gap PostService.getList() papered over via an unchecked axios
  // generic before this was switched to a direct in-process call.
  const [data, vipData] = await Promise.all([
    fetchPostsList({ ...query, userId, userRole }).catch(() => emptyResponse) as unknown as Promise<IPostsResponse>,
    fetchPostsList({ onlyVip: true, limit: 8, lang: locale, userId, userRole }).catch(() => null) as unknown as Promise<{posts: IPostResponse[]} | null>,
  ])

  const vipPosts: IPostResponse[] = vipData?.posts ?? []

  return <HomePage initialData={data} initialQuery={query} vipPosts={vipPosts} />
}
