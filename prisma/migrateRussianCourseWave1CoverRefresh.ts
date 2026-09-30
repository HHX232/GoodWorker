/**
 * Idempotent backfill: regenerates the 35 Russian-course topic cover images with
 * topic-specific "advertising poster" prompts (the generic z-image-turbo covers from
 * the original seed didn't relate to their topics — user feedback after reviewing the
 * live result) on a slightly pricier model, `flux-2-klein-4b` (0.05 BYN/image vs the
 * original 0.03), via api.bycom.by (same contract as
 * prisma/backfillRussianCourse03SyntaxCovers.ts: POST /v1/images/generations,
 * {"data":[{"b64_json":...}]} response, decoded PNG).
 *
 * Idempotency: new covers go to the `russian-course-images-v2` S3 folder (old covers
 * stayed in `russian-course-images`, untouched, not deleted). A post is skipped if its
 * current MEDIA block url already contains that marker — a second run is a clean no-op,
 * no re-spend.
 *
 * No `src/` import at runtime — the production runner image doesn't copy `src/` (see
 * prisma/migrateRussianCourseWave1.ts, fixed the same way after a MODULE_NOT_FOUND on
 * PostBlockType). Block type is the plain literal 'MEDIA'; the S3 client is
 * reconstructed inline from the same env vars src/shared/s3/s3Client.ts uses, instead
 * of importing that file.
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1CoverRefresh.ts
 */
import {PrismaClient} from '@prisma/client'
import {randomUUID} from 'crypto'
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'

const prisma = new PrismaClient()

const TEACHER_EMAIL = 'teacher@seed.dev'
const BYCOM_MODEL = 'flux-2-klein-4b' // 0.05 BYN/image — one tier up from z-image-turbo's 0.03
const COVER_FOLDER = 'russian-course-images-v2' // marker: distinguishes refreshed covers for idempotency

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  }
})
const S3_BUCKET = process.env.S3_BUCKET!

function publicUrlForKey(key: string): string {
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL
  if (!base) throw new Error('NEXT_PUBLIC_S3_PUBLIC_URL is not set')
  return `${base.replace(/\/$/, '')}/${key}`
}

interface Topic {
  slug: string
  ruName: string
  prompt: string
}

// Each prompt names the actual grammar phenomenon (not a generic template) and frames
// it as a bold promotional poster, per the user's ask: "рекламный/промо-пост на тему
// <topic>", eye-catching, not a generic stock illustration.
const TOPICS: Topic[] = [
  // Орфография
  {
    slug: 'spelling-words',
    ruName: 'Правописание слов',
    prompt: 'Bold advertising poster about tricky Russian spelling words, dictionary pages exploding into confetti of letters, vibrant contrasting colors, dynamic modern graphic design, no readable text'
  },
  {
    slug: 'prefixes-suffixes',
    ruName: 'Приставки и суффиксы',
    prompt: 'Vibrant advertising poster illustrating word-building blocks snapping together like colorful LEGO pieces to form a word, prefix and suffix pieces highlighted in contrasting neon colors, bold modern design, no readable text'
  },
  {
    slug: 'unstressed-vowels-root',
    ruName: 'Безударные гласные в корне',
    prompt: 'Eye-catching advertising poster about unstressed vowels hidden inside a word root, a magnifying glass spotlighting a glowing vowel letter shape, bold saturated colors, dynamic composition, no readable text'
  },
  {
    slug: 'hard-soft-signs',
    ruName: 'Ъ и Ь: разделительные и обозначающие мягкость',
    prompt: 'Bold advertising poster contrasting a hard sharp angular shape versus a soft rounded cushion shape, symbolizing hard and soft signs in Russian spelling, vivid contrasting color blocks, modern graphic poster design, no readable text'
  },
  {
    slug: 'ne-ni-spelling',
    ruName: 'НЕ и НИ с разными частями речи',
    prompt: 'Punchy advertising poster with a dramatic tug-of-war between two glowing particle shapes, one negating and one intensifying, vivid clashing colors, bold modern poster design about Russian grammar particles, no readable text'
  },
  {
    slug: 'n-nn-spelling',
    ruName: 'Н и НН в разных частях речи',
    prompt: 'Bold advertising poster comparing a single glowing dot versus a double glowing dot, symbolizing single versus double letter N in Russian spelling, vibrant high-contrast colors, sleek modern poster layout, no readable text'
  },
  {
    slug: 'hyphenation-rules',
    ruName: 'Слитное, дефисное и раздельное написание',
    prompt: 'Dynamic advertising poster showing puzzle pieces in three states — fused together, linked by a small connector, and floating apart — representing solid, hyphenated and separate spelling, bold saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'endings-spelling',
    ruName: 'Правописание падежных и личных окончаний',
    prompt: 'Vivid advertising poster of a rotating gear-like wheel of glowing word-ending fragments, symbolizing Russian noun and verb endings changing by case and person, bold vibrant colors, modern dynamic poster design, no readable text'
  },
  // Морфология
  {
    slug: 'parts-of-speech',
    ruName: 'Части речи: система',
    prompt: 'Bold advertising poster showing a colorful constellation map connecting ten glowing category icons, representing the full system of Russian parts of speech, vibrant gradient background, modern infographic poster style, no readable text'
  },
  {
    slug: 'participles-gerunds',
    ruName: 'Причастия и деепричастия',
    prompt: 'Dynamic advertising poster of a figure frozen mid-motion with a glowing trailing streak, symbolizing participles and adverbial participles describing action and state at once, bold saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'noun-morphology',
    ruName: 'Имя существительное',
    prompt: 'Bold advertising poster of a solid glowing geometric object rotating through six colored facets, symbolizing a Russian noun changing through its six grammatical cases, vivid saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'adjective-morphology',
    ruName: 'Имя прилагательное',
    prompt: 'Vibrant advertising poster of a plain object being painted with bold colorful brush strokes, symbolizing adjectives adding qualities to a word, dynamic modern poster composition, saturated palette, no readable text'
  },
  {
    slug: 'verb-morphology',
    ruName: 'Глагол',
    prompt: 'Energetic advertising poster of a glowing arrow launching forward with a motion trail through past, present and future zones, symbolizing the Russian verb and its tenses, bold vivid colors, modern dynamic poster design, no readable text'
  },
  {
    slug: 'pronoun-morphology',
    ruName: 'Местоимение',
    prompt: 'Playful advertising poster of a glowing silhouette that mirrors and replaces other colorful silhouettes around it, symbolizing pronouns standing in for nouns, bold contrasting colors, modern poster design, no readable text'
  },
  {
    slug: 'numeral-morphology',
    ruName: 'Числительное',
    prompt: 'Bold advertising poster of oversized glowing numeral shapes stacked like building blocks, symbolizing Russian numerals and their declension, vivid saturated color palette, modern graphic poster design, no readable text'
  },
  {
    slug: 'adverb-morphology',
    ruName: 'Наречие',
    prompt: 'Dynamic advertising poster of a glowing speedometer-like dial surrounded by motion streaks, symbolizing adverbs describing how an action happens, bold vibrant colors, modern poster composition, no readable text'
  },
  {
    slug: 'function-words',
    ruName: 'Предлог, союз, частица',
    prompt: 'Bold advertising poster of three small glowing connector shapes linking larger colorful blocks together like bridges, symbolizing prepositions, conjunctions and particles, vivid saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'interjections',
    ruName: 'Междометие и звукоподражательные слова',
    prompt: 'Energetic advertising poster of a bright comic-style burst and sound-wave rings radiating outward, symbolizing interjections and sound-imitating words, bold saturated colors, playful modern poster design, no readable text'
  },
  // Синтаксис
  {
    slug: 'simple-sentence',
    ruName: 'Простое предложение',
    prompt: 'Clean bold advertising poster of two glowing connected geometric shapes — one larger, one smaller — forming a simple balanced structure, symbolizing subject and predicate in a simple sentence, vivid modern poster design, no readable text'
  },
  {
    slug: 'complex-sentence',
    ruName: 'Сложноподчинённое предложение: виды придаточных',
    prompt: 'Bold advertising poster of a large glowing tree trunk with several smaller branching offshoots each in a different color, symbolizing a main clause with subordinate clauses branching off it, vivid modern poster design, no readable text'
  },
  {
    slug: 'phrase-connection',
    ruName: 'Словосочетание: виды связи',
    prompt: 'Vibrant advertising poster showing three different connector mechanisms — a tight lock, a flexible hinge, and a loose magnet — symbolizing agreement, government and adjunction in Russian phrases, bold saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'one-part-sentence',
    ruName: 'Односоставные предложения',
    prompt: 'Bold minimalist advertising poster of a single glowing pillar standing alone and complete under a spotlight, symbolizing a one-part sentence, vivid saturated colors, striking modern poster design, no readable text'
  },
  {
    slug: 'homogeneous-parts',
    ruName: 'Однородные члены предложения',
    prompt: 'Bold advertising poster of a row of identical glowing geometric shapes in different vibrant colors lined up side by side, symbolizing homogeneous sentence members, dynamic modern poster design, no readable text'
  },
  {
    slug: 'isolated-members',
    ruName: 'Обособленные определения и обстоятельства',
    prompt: 'Bold advertising poster of a glowing shape set apart in its own bracketed spotlight beside a larger main shape, symbolizing isolated modifiers set off by commas, vivid saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'introductory-words',
    ruName: 'Вводные слова, конструкции и обращения',
    prompt: 'Bold advertising poster of a small glowing speech-bubble shape floating beside a larger sentence-shape, easily removable, symbolizing introductory words and direct address, vivid modern poster design, no readable text'
  },
  {
    slug: 'compound-sentence',
    ruName: 'Сложносочинённое предложение',
    prompt: 'Bold advertising poster of two equal glowing geometric shapes linked side by side by a bright connecting bar, symbolizing two equal independent clauses joined together, vivid saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'asyndetic-sentence',
    ruName: 'Бессоюзное сложное предложение',
    prompt: 'Bold advertising poster of two glowing geometric shapes standing close together with no visible connector between them, only a sharp gap implying meaning, vivid modern poster design, saturated colors, no readable text'
  },
  {
    slug: 'direct-speech',
    ruName: 'Прямая речь, косвенная речь, цитирование',
    prompt: 'Bold advertising poster of a glowing speech-bubble shape transforming mid-poster into a flowing ribbon of narrative, symbolizing direct speech turning into reported speech, vivid saturated colors, modern poster design, no readable text'
  },
  // Пунктуация
  {
    slug: 'commas',
    ruName: 'Запятые: главные правила',
    prompt: 'Bold advertising poster starring an oversized glowing comma shape as the hero element, with smaller sentence-fragment shapes orbiting it, vivid saturated colors, striking modern poster design about commas, no readable text'
  },
  {
    slug: 'colon',
    ruName: 'Двоеточие',
    prompt: 'Bold advertising poster starring an oversized glowing colon symbol as the hero element, with a list of small colorful shapes cascading out from it, vivid saturated colors, striking modern poster design, no readable text'
  },
  {
    slug: 'dash',
    ruName: 'Тире',
    prompt: 'Bold advertising poster starring a long glowing dash shape bridging two contrasting colored blocks like a bolt of energy, vivid saturated colors, striking modern poster design about the Russian dash mark, no readable text'
  },
  {
    slug: 'quotation-marks',
    ruName: 'Кавычки',
    prompt: 'Bold advertising poster starring oversized glowing angular quotation marks framing a glowing shape at the center, vivid saturated colors, striking modern poster design, no readable text'
  },
  {
    slug: 'comma-isolation',
    ruName: 'Запятая при обособленных членах',
    prompt: 'Bold advertising poster of a glowing sentence-shape with a smaller fragment fenced off by two bright comma shapes on either side, vivid saturated colors, modern poster design, no readable text'
  },
  {
    slug: 'complex-sentence-punctuation',
    ruName: 'Знаки препинания в сложном предложении (сводно)',
    prompt: 'Bold advertising poster of a branching decision-tree made of glowing punctuation marks — comma, semicolon, colon, dash — each lighting up a different path, vivid saturated colors, modern infographic poster design, no readable text'
  },
  {
    slug: 'introductory-punctuation',
    ruName: 'Пунктуация при вводных словах и обращениях',
    prompt: 'Bold advertising poster of a small glowing bracketed shape being gently lifted out of a sentence by two bright comma-shaped hands, vivid saturated colors, modern poster design, no readable text'
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

async function uploadCover(buffer: Buffer, teacherId: string): Promise<string> {
  const key = `${COVER_FOLDER}/${teacherId}/${randomUUID()}.png`
  await s3.send(new PutObjectCommand({Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: 'image/png'}))
  return publicUrlForKey(key)
}

interface Block {
  id: string
  type: string
  payload: Record<string, unknown>
}

async function main() {
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: TEACHER_EMAIL}})

  let refreshed = 0
  let skipped = 0
  let failed = 0

  for (const topic of TOPICS) {
    const category = await prisma.category.findUniqueOrThrow({where: {slug: topic.slug}})
    const post = await prisma.post.findFirst({where: {teacherId: teacher.id, categoryId: category.id}})
    if (!post) {
      console.log(`! пост для ${topic.slug} не найден — пропуск`)
      failed++
      continue
    }

    const content = post.content as {blocks: Block[]} | null
    const blocks = content?.blocks ?? []
    const mediaIndex = blocks.findIndex((b) => b.type === 'MEDIA')
    const existingUrl = mediaIndex >= 0 ? (blocks[mediaIndex].payload?.url as string | undefined) : undefined

    if (existingUrl?.includes(COVER_FOLDER)) {
      console.log(`= пропуск ${topic.slug} — обложка уже обновлена (${post.id})`)
      skipped++
      continue
    }
    if (mediaIndex < 0) {
      console.log(`! ${topic.slug}: у поста ${post.id} нет MEDIA-блока — пропуск`)
      failed++
      continue
    }

    try {
      const buffer = await generateCoverBycom(topic.prompt)
      const coverUrl = await uploadCover(buffer, teacher.id)

      const newBlocks = blocks.map((b, i) => (i === mediaIndex ? {...b, payload: {...b.payload, url: coverUrl}} : b))
      const mediaUrls = newBlocks.filter((b) => b.type === 'MEDIA' && typeof b.payload?.url === 'string').map((b) => b.payload.url as string)

      await prisma.post.update({where: {id: post.id}, data: {content: {blocks: newBlocks} as object, mediaUrls}})
      console.log(`+ ${topic.slug}: ${coverUrl}`)
      refreshed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`! ${topic.slug}: ${msg}`)
      failed++
    }
  }

  console.log(`\n✅ Russian course cover refresh: ${refreshed} обновлено, ${skipped} уже обновлено, ${failed} ошибок/пропусков.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
