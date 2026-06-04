/* eslint-disable @typescript-eslint/no-explicit-any */
import HomePage from '@/_pages/PublickPages/HomePage/HomePage'
import PostService, {IPostResponse, IPostsQuery} from '@/features/services/PostService.service'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('home') }
}



interface HomePageRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({searchParams}: HomePageRouteProps) {
  const params = await searchParams

  const query: IPostsQuery = {
    page: params.page ? Number(params.page) : 1,
    limit: params.limit ? Number(params.limit) : 12,
    categoryId: typeof params.categoryId === 'string' ? params.categoryId : undefined,
    teacherId: typeof params.teacherId === 'string' ? params.teacherId : undefined,
    visibility: typeof params.visibility === 'string' ? (params.visibility as any) : 'any',
    search: typeof params.search === 'string' ? params.search : undefined
  }

  const emptyResponse = {posts: [], pagination: {page: 1, limit: query.limit ?? 12, total: 0, totalPages: 0}}

  const [data, vipData] = await Promise.all([
    PostService.getList(query).catch(() => emptyResponse),
    PostService.getList({onlyVip: true, limit: 8, visibility: 'any'}).catch(() => null)
  ])

  const vipPosts: IPostResponse[] = vipData?.posts ?? []

  return <HomePage initialData={data} initialQuery={query} vipPosts={vipPosts} />
}
