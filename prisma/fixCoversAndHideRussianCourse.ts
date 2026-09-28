/**
 * One-off: revert 7 specific topics' cover to their original (pre-promo-poster)
 * image, and hide the whole Russian-course batch (35 posts + the Roadmap) from
 * public view while quality issues get sorted. Idempotent, safe to re-run —
 * targets whichever DATABASE_URL is live (local now, production via
 * entrypoint.sh). Do not import from src/ at runtime (not present in the prod
 * Docker image).
 */
import {PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

const COVER_REVERTS: Record<string, string> = {
  'Вводные слова, конструкции и обращения':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/034caaba-699d-4ddf-8fd0-1d652d17c0b7.png',
  'Причастие и деепричастие: как отличить особые формы глагола':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/9a3d4637-059b-424a-b6cf-c4c6b0594fa3.jpg',
  'Словосочетание: согласование, управление, примыкание':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/2f0373cc-c69e-4b12-aec8-5a9d54b21c6d.png',
  'Приставки на З/С и приставки ПРЕ-/ПРИ-':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/5bfb2d37-064d-4817-950e-7310e6e6fd9d.jpg',
  'Кавычки: прямая речь, цитаты и особые случаи':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/5eb45601-3b63-427a-a2ed-ab6890f8c51b.png',
  'Простое предложение: главные и второстепенные члены':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/20b2d74d-6d24-42a0-a587-2062f841f31a.png',
  'Безударные гласные в корне: три типа и как их различать':
    'https://ec2d0826-ed65-4e17-9296-2eb821c2e6bb.srvstatic.kz/russian-course-images/eac0ceeb-4226-4b43-9705-4aaec0f1f6a2/293b6b16-4dc9-4bda-91f1-a846ae663c02.jpg'
}

const BLOCK_SLUGS = ['orthography', 'morphology', 'syntax', 'punctuation']

type ContentBlock = {id: string; type: string; payload: Record<string, unknown>}

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: 'teacher@seed.dev'}})

  // 1. Revert the 7 named covers.
  let coversReverted = 0
  let coversSkipped = 0
  for (const [title, oldUrl] of Object.entries(COVER_REVERTS)) {
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, title}})
    if (!post) {
      console.log(`  ! пост "${title}" не найден — пропуск`)
      continue
    }
    const content = post.content as {blocks: ContentBlock[]}
    const mediaBlock = content.blocks.find((b) => b.type === 'MEDIA')
    if (mediaBlock?.payload?.url === oldUrl) {
      console.log(`  = "${title}" — обложка уже старая — пропуск`)
      coversSkipped++
      continue
    }
    const newBlocks = content.blocks.map((b) => (b.type === 'MEDIA' ? {...b, payload: {...b.payload, url: oldUrl}} : b))
    const mediaUrls = newBlocks.filter((b) => b.type === 'MEDIA').map((b) => b.payload.url as string)
    await prisma.post.update({where: {id: post.id}, data: {content: {blocks: newBlocks} as object, mediaUrls}})
    console.log(`  + "${title}" — обложка возвращена на старую`)
    coversReverted++
  }

  // 2. Hide the whole batch: all 35 posts под orthography/morphology/syntax/punctuation,
  //    plus the Roadmap course wrapper.
  const parents = await prisma.category.findMany({where: {slug: {in: BLOCK_SLUGS}}, select: {id: true}})
  const leafCategories = await prisma.category.findMany({
    where: {parentId: {in: parents.map((p) => p.id)}},
    select: {id: true}
  })
  const leafIds = leafCategories.map((c) => c.id)

  const postsHidden = await prisma.post.updateMany({
    where: {teacherId: teacher.id, categoryId: {in: leafIds}},
    data: {visibility: 'PRIVATE', moderationStatus: 'PENDING'}
  })
  console.log(`  посты скрыты: ${postsHidden.count} (visibility=PRIVATE, moderationStatus=PENDING)`)

  const roadmapHidden = await prisma.roadmap.updateMany({
    where: {teacherId: teacher.id, title: {startsWith: 'Русский язык — большой курс'}},
    data: {moderationStatus: 'PENDING'}
  })
  console.log(`  roadmap скрыт: ${roadmapHidden.count} (moderationStatus=PENDING)`)

  console.log(
    `\n✅ Fix+hide: обложек возвращено ${coversReverted}, уже были старые ${coversSkipped}, постов скрыто ${postsHidden.count}, roadmap скрыто ${roadmapHidden.count}.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
