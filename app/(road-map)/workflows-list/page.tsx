import { RoadMapListPage } from '@/_pages/RoadMapPages/RoadMapListPage/RoadMapListPage'
import RoadmapService, { IRoadmapQuery } from '@/features/services/RoadmapService.service'
import { Suspense } from 'react'
import { getLocale } from 'next-intl/server'

interface WorkflowsListRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WorkflowsListPage({ searchParams }: WorkflowsListRouteProps) {
  const params = await searchParams
  const locale = await getLocale()

  const query: IRoadmapQuery = {
    page: 1,
    limit: 12,
    search: typeof params.search === 'string' ? params.search : undefined,
    minPrice: typeof params.minPrice === 'string' ? Number(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === 'string' ? Number(params.maxPrice) : undefined,
    minRating: typeof params.minRating === 'string' ? Number(params.minRating) : undefined,
    teacherId: typeof params.teacherId === 'string' ? params.teacherId : undefined,
    lang: locale,
  }

  const initialData = await RoadmapService.getList(query).catch(() => ({
    roadmaps: [],
    pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
  }))

  return (
    <Suspense>
      <RoadMapListPage initialData={initialData} initialQuery={query} />
    </Suspense>
  )
}
