/* eslint-disable @typescript-eslint/no-explicit-any */
import HomePage from '@/_pages/PublickPages/HomePage/HomePage'
import PostService, {IPostsQuery} from '@/features/services/PostService.service'

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

  const data = await PostService.getList(query)
  return <HomePage initialData={data} initialQuery={query} />
}
