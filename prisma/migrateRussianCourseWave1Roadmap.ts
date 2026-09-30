/**
 * Idempotent migration: wraps the 35-topic Russian course (already shipped as
 * Post+Test rows by prisma/migrateRussianCourseWave1.ts) into ONE Roadmap — the
 * app's actual "course" product concept (there is no separate Course model; the
 * catalog at /workflows-list, labeled "Курсы" in the UI, lists Roadmap rows).
 * Reads the same prisma/data/russianCourseWave1.json used by the posts migration
 * as its single source of truth for block order/titles and post titles, so the
 * two scripts never drift. Safe to run repeatedly — resolves everything by
 * natural key (email/slug/title), no hardcoded ids.
 *
 * Roadmap.content shape (Roadmap.content is a required Json field) is whatever
 * the app's React Flow-based roadmap editor/viewer produces and consumes:
 * `{nodes: Node[], edges: Edge[]}` — confirmed both from an existing seeded
 * Roadmap's content column in the local dev DB and from
 * app/(road-map)/road-map/[id]/page.tsx, which reads
 * `roadmap.content as {nodes, edges}` and hands it to <RoadMapViewer>.
 * Node shape: `{id, type: 'FlowScrapeNode', position, data: {type: <block>, ...}}`
 * where `data.type` is one of RoadMapBlockType (src/shared/types/RoadMap/RoadMap.types.ts):
 * ENTRY_POINT (course title/description/category), INFO_TEXT (data.inputs.INFO_TEXT),
 * POST_LINK (data.selectedPostIds: string[]). Field shapes for these three matched an
 * existing seeded roadmap's content exactly (id 'c080d200-...', title "мой любимый JS").
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1Roadmap.ts
 */
import {PrismaClient} from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const prisma = new PrismaClient()

interface WaveData {
  teacherEmail: string
  categories: {
    slug: string
    parentSlug: string
    translations: {langCode: string; name: string}[]
    posts: {title: string}[]
  }[]
}

const BLOCK_ORDER = ['orthography', 'morphology', 'syntax', 'punctuation']
const BLOCK_TITLES_RU: Record<string, string> = {
  orthography: 'Орфография',
  morphology: 'Морфология',
  syntax: 'Синтаксис',
  punctuation: 'Пунктуация'
}

const ROADMAP_TITLE = 'Русский язык — большой курс: орфография, морфология, синтаксис, пунктуация'

type FlowNode = {id: string; type: 'FlowScrapeNode'; position: {x: number; y: number}; data: Record<string, unknown>}
type FlowEdge = {
  id: string
  type: 'default'
  source: string
  target: string
  animated: boolean
  sourceHandle: string
  targetHandle: string
  markerEnd: {type: 'arrowclosed'; color: string; width: number; height: number}
}

function makeEdge(sourceId: string, targetId: string): FlowEdge {
  const sourceHandle = `${sourceId}-output`
  const targetHandle = `${targetId}-input`
  return {
    id: `xy-edge__${sourceId}${sourceHandle}-${targetId}${targetHandle}`,
    type: 'default',
    source: sourceId,
    target: targetId,
    animated: true,
    sourceHandle,
    targetHandle,
    markerEnd: {type: 'arrowclosed', color: '#868897', width: 22, height: 22}
  }
}

async function main() {
  const dataPath = path.join(process.cwd(), 'prisma/data/russianCourseWave1.json')
  const data: WaveData = JSON.parse(await fs.readFile(dataPath, 'utf8'))

  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: data.teacherEmail}})

  const existing = await prisma.roadmap.findFirst({where: {teacherId: teacher.id, title: ROADMAP_TITLE}})
  if (existing) {
    console.log(`= Roadmap "${ROADMAP_TITLE}" уже существует (${existing.id}) — пропуск`)
    await prisma.$disconnect()
    return
  }

  const russianCategory = await prisma.category.findUniqueOrThrow({where: {slug: 'russian'}})
  const blockCategories = await Promise.all(
    BLOCK_ORDER.map((slug) => prisma.category.findUniqueOrThrow({where: {slug}}))
  )

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  let y = 0
  const X_ENTRY = 0
  const X_TEXT = 500
  const X_POSTS = 1000

  const entryId = crypto.randomUUID()
  nodes.push({
    id: entryId,
    type: 'FlowScrapeNode',
    position: {x: X_ENTRY, y: 300},
    data: {
      type: 'ENTRY_POINT',
      inputs: {},
      headerColor: '#141416',
      roadTitle: ROADMAP_TITLE,
      roadDescription:
        'Большой курс по русскому языку: орфография, морфология, синтаксис и пунктуация — 35 тем с разборами и тестами.',
      roadCategoryIds: [russianCategory.id]
    }
  })

  let prevId = entryId

  for (const blockSlug of BLOCK_ORDER) {
    const blockCategory = blockCategories.find((c) => c.slug === blockSlug)!
    const topics = data.categories.filter((c) => c.parentSlug === blockSlug)

    const postIds: string[] = []
    for (const topic of topics) {
      const topicCategory = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
      for (const post of topic.posts) {
        const row = await prisma.post.findFirstOrThrow({
          where: {teacherId: teacher.id, categoryId: topicCategory.id, title: post.title}
        })
        postIds.push(row.id)
      }
    }

    const textId = crypto.randomUUID()
    nodes.push({
      id: textId,
      type: 'FlowScrapeNode',
      position: {x: X_TEXT, y},
      data: {type: 'INFO_TEXT', inputs: {INFO_TEXT: BLOCK_TITLES_RU[blockSlug]}, headerColor: ''}
    })
    edges.push(makeEdge(prevId, textId))

    const postsId = crypto.randomUUID()
    nodes.push({
      id: postsId,
      type: 'FlowScrapeNode',
      position: {x: X_POSTS, y},
      data: {type: 'POST_LINK', inputs: {'': ''}, headerColor: '', selectedPostIds: postIds}
    })
    edges.push(makeEdge(textId, postsId))

    console.log(`+ ${blockSlug}: блок "${BLOCK_TITLES_RU[blockSlug]}" — ${postIds.length} постов привязано`)

    prevId = postsId
    y += 400
  }

  const content = {nodes, edges}

  const roadmap = await prisma.roadmap.create({
    data: {
      teacherId: teacher.id,
      title: ROADMAP_TITLE,
      price: 0,
      content: content as object,
      moderationStatus: 'PUBLISHED',
      roadmapCategories: {
        create: [russianCategory, ...blockCategories].map((c) => ({categoryId: c.id}))
      }
    }
  })

  console.log(`\n✅ Roadmap создан: ${roadmap.id} — "${roadmap.title}"`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
