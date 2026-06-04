import RoadMapViewer from '@/_pages/RoadMapPages/ViewRoadMap/InnerViewer'
import RoadmapService from '@/features/services/RoadmapService.service'
import {Edge, Node} from '@xyflow/react'
import {getLocale} from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'


interface Props {
  params: Promise<{id: string}>
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('PageTitles')
  try {
    const locale = await getLocale()
    const roadmap = await RoadmapService.getById(id, locale)
    if (roadmap?.title) return { title: roadmap.title }
  } catch {}
  return { title: t('courses') }
}

export default async function RoadMapPage({params}: Props) {
  const {id} = await params
  const locale = await getLocale()

  const roadmap = await RoadmapService.getById(id, locale).catch(() => null)

  if (!roadmap) {
    return (
      <div style={{padding: 40, fontFamily: 'Roboto, sans-serif', color: '#141416'}}>
        <h2>Роадмап не найден</h2>
        <p style={{color: '#868897'}}>ID: {id}</p>
      </div>
    )
  }

  const content = roadmap.content as {nodes: Node<Record<string, unknown>>[]; edges: Edge[]}

  return (
    <RoadMapViewer
      nodes={content?.nodes ?? []}
      edges={content?.edges ?? []}
      roadmapId={id}
      roadmapTitle={roadmap.title}
      roadmapPrice={roadmap.price}
      nodeAccessType={roadmap.nodeAccessType ?? null}
      initialAvgRating={roadmap.avgRating}
      originalLanguage={roadmap.originalLanguage ?? null}
    />
  )
}
