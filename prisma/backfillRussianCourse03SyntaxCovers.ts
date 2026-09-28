/**
 * One-off backfill: cover images for the 10 "Синтаксис" topics (ticket 03) whose
 * posts were created without a MEDIA block because kie.ai/velsvisual ran out of
 * credits mid-run (see interfaces.md §8 "Тикет 03", D01).
 *
 * Provider switched to api.bycom.by (interfaces.md §5, contract confirmed by the
 * coordinator with a real test call, not guessed here). z-image-turbo, b64_json
 * response (not a URL) — decoded and uploaded to S3 directly, same as the PDF/cover
 * upload pattern in seedRussianCourse03Syntax.ts.
 *
 * Idempotent: skips any post that already has a MEDIA block, so a re-run after a
 * partial failure only fills in what's still missing.
 *
 * Run: npx tsx prisma/backfillRussianCourse03SyntaxCovers.ts
 */
import {PrismaClient} from '@prisma/client' // first import — its own dotenv load populates process.env.* below
import {randomUUID} from 'crypto'
import {PutObjectCommand} from '@aws-sdk/client-s3'
import {s3, S3_BUCKET, publicUrlForKey} from '../src/shared/s3/s3Client'
import {PostBlockType} from '../src/shared/types/Post/Post.type'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const BYCOM_MODEL = 'z-image-turbo' // 0.03 BYN/image, interfaces.md §5 — budget is one image per topic, no extras

// slug/ruName/coverPrompt exactly as authored in seedRussianCourse03Syntax.ts's TOPICS —
// not re-imported from there because that module runs its whole main() as an import
// side effect (top-level `main().then(...)`), which would re-run the entire seed.
const TOPIC_COVERS: {slug: string; ruName: string; coverPrompt: string}[] = [
  {
    slug: 'simple-sentence',
    ruName: 'Простое предложение',
    coverPrompt: 'Minimalist editorial photo of wooden alphabet blocks arranged in a neat row on a desk, soft natural light, calm study atmosphere, no readable text'
  },
  {
    slug: 'complex-sentence',
    ruName: 'Сложноподчинённое предложение: виды придаточных',
    coverPrompt: 'Abstract editorial illustration of branching tree-like ink lines on textured paper, representing connected clauses, muted tones, no readable text'
  },
  {
    slug: 'phrase-connection',
    ruName: 'Словосочетание: виды связи',
    coverPrompt: 'Macro photo of two wooden puzzle pieces interlocking on a table, warm light, minimalist composition, no readable text'
  },
  {
    slug: 'one-part-sentence',
    ruName: 'Односоставные предложения',
    coverPrompt: 'Editorial photo of a single spotlight illuminating an empty stage, moody atmosphere, minimalist composition, no readable text'
  },
  {
    slug: 'homogeneous-parts',
    ruName: 'Однородные члены предложения',
    coverPrompt: 'Flat lay photo of a row of identical pencils arranged in parallel on lined paper, soft daylight, no readable text'
  },
  {
    slug: 'isolated-members',
    ruName: 'Обособленные определения и обстоятельства',
    coverPrompt: 'Editorial photo of a comma-shaped paper cutout resting beside an open notebook, warm light, minimalist composition, no readable text'
  },
  {
    slug: 'introductory-words',
    ruName: 'Вводные слова, конструкции и обращения',
    coverPrompt: 'Editorial still life of a vintage rotary phone next to an open notebook, symbolizing speech and commentary, warm sepia tones, no readable text'
  },
  {
    slug: 'compound-sentence',
    ruName: 'Сложносочинённое предложение',
    coverPrompt: 'Abstract photo of two intertwined ropes of equal length on a wooden surface, symbolizing equal connected parts, soft light, no readable text'
  },
  {
    slug: 'asyndetic-sentence',
    ruName: 'Бессоюзное сложное предложение',
    coverPrompt: 'Minimalist photo of scattered punctuation-shaped paper cutouts (comma, colon, dash) on a desk, soft light, no readable text'
  },
  {
    slug: 'direct-speech',
    ruName: 'Прямая речь, косвенная речь, цитирование',
    coverPrompt: 'Editorial photo of an open book with a speech-bubble-shaped paper cutout resting on the page, warm light, no readable text'
  }
]

async function generateCoverBycom(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BYCOM_API_KEY
  if (!apiKey) throw new Error('BYCOM_API_KEY is not set in .env')

  const res = await fetch('https://api.bycom.by/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: BYCOM_MODEL, prompt, n: 1, size: '1024x1024'})
  })
  if (!res.ok) {
    throw new Error(`bycom ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as {data?: {b64_json?: string}[]}
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error(`bycom response missing data[0].b64_json: ${JSON.stringify(json).slice(0, 300)}`)
  return Buffer.from(b64, 'base64')
}

async function uploadBuffer(buffer: Buffer, folder: string, ext: string, teacherId: string, contentType: string) {
  const key = `${folder}/${teacherId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType}))
  return publicUrlForKey(key)
}

function mediaBlock(url: string, caption: string) {
  return {id: `rc03-backfill-${randomUUID()}`, type: PostBlockType.MEDIA, payload: {kind: 'image', url, caption}}
}

async function main() {
  const teacher = await prisma.teacher.findUnique({where: {email: TEACHER_EMAIL}})
  if (!teacher) throw new Error(`Teacher not found: ${TEACHER_EMAIL}`)

  const report: {slug: string; postId?: string; coverUrl?: string; skipped: boolean; error?: string}[] = []

  for (const topic of TOPIC_COVERS) {
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id}})
    if (!post) {
      console.log(`! пост для ${topic.slug} не найден — пропуск`)
      report.push({slug: topic.slug, skipped: true, error: 'post not found'})
      continue
    }

    const content = post.content as {blocks: {id: string; type: string; payload: Record<string, unknown>}[]}
    const blocks = content.blocks
    if (blocks.some((b) => b.type === PostBlockType.MEDIA)) {
      console.log(`= пропуск ${topic.slug} — MEDIA-блок уже есть (${post.id})`)
      report.push({slug: topic.slug, postId: post.id, skipped: true})
      continue
    }

    try {
      const coverBuffer = await generateCoverBycom(topic.coverPrompt)
      const coverUrl = await uploadBuffer(coverBuffer, 'russian-course-images', 'png', teacher.id, 'image/png')

      const textIndex = blocks.findIndex((b) => b.type === PostBlockType.TEXT)
      const insertAt = textIndex >= 0 ? textIndex + 1 : 1
      const newBlocks = [...blocks.slice(0, insertAt), mediaBlock(coverUrl, `Обложка темы «${topic.ruName}»`), ...blocks.slice(insertAt)]
      const mediaUrls = newBlocks.filter((b) => b.type === PostBlockType.MEDIA && typeof b.payload?.url === 'string').map((b) => b.payload.url as string)

      await prisma.post.update({where: {id: post.id}, data: {content: {blocks: newBlocks}, mediaUrls}})
      console.log(`+ ${topic.slug}: ${coverUrl}`)
      report.push({slug: topic.slug, postId: post.id, coverUrl, skipped: false})
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`! ${topic.slug}: ${msg}`)
      report.push({slug: topic.slug, postId: post.id, skipped: false, error: msg})
    }
  }

  console.log('\n─── ИТОГ ───')
  console.log(JSON.stringify(report, null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
