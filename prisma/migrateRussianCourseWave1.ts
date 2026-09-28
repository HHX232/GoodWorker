/**
 * Idempotent migration: ships the 35-topic Russian course (Орфография/Морфология/
 * Синтаксис/Пунктуация) from prisma/data/russianCourseWave1.json onto whichever DB
 * is live in DATABASE_URL. Safe to run repeatedly — resolves everything by natural
 * key (slug/email/title) since ids are @default(uuid()) and not portable across
 * environments. Called from `npm run start` on every boot (see package.json), so a
 * fully-seeded run must no-op fast.
 *
 * Run: npx tsx prisma/migrateRussianCourseWave1.ts
 */
import {PrismaClient} from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import {PostBlockType} from '../src/shared/types/Post/Post.type'

const prisma = new PrismaClient()

interface WaveData {
  teacherEmail: string
  categories: {
    slug: string
    parentSlug: string
    levelNumber: number
    translations: {langCode: string; name: string}[]
    posts: {title: string; content: unknown; mediaUrls: string[]}[]
    tests: {title: string; content: unknown; aiTopic: string | null}[]
  }[]
}

function rewriteTestLinkIds(content: unknown, titleToId: Map<string, string>): unknown {
  const doc = content as {blocks?: {type: string; payload?: Record<string, unknown>}[]} | null
  if (!doc?.blocks) return content
  for (const block of doc.blocks) {
    if (block.type !== PostBlockType.TEST_LINK) continue
    const tests = block.payload?.tests as {id: string; title: string}[] | undefined
    if (!tests) continue
    for (const t of tests) {
      const newId = titleToId.get(t.title)
      if (!newId) throw new Error(`TEST_LINK references unknown test title "${t.title}"`)
      t.id = newId
    }
  }
  return doc
}

async function main() {
  const dataPath = path.join(process.cwd(), 'prisma/data/russianCourseWave1.json')
  const data: WaveData = JSON.parse(await fs.readFile(dataPath, 'utf8'))

  // Fail loudly (not a silent skip) — a missing teacher means the environment isn't
  // in the expected state, same as a missing parent block category below.
  const teacher = await prisma.teacher.findUniqueOrThrow({where: {email: data.teacherEmail}})

  let createdPosts = 0
  let skippedPosts = 0

  for (const cat of data.categories) {
    const parent = await prisma.category.findUniqueOrThrow({where: {slug: cat.parentSlug}})

    const category = await prisma.category.upsert({
      where: {slug: cat.slug},
      create: {slug: cat.slug, levelNumber: cat.levelNumber, parentId: parent.id},
      update: {}
    })
    for (const tr of cat.translations) {
      await prisma.categoryTranslation.upsert({
        where: {categoryId_langCode: {categoryId: category.id, langCode: tr.langCode}},
        create: {categoryId: category.id, langCode: tr.langCode, name: tr.name},
        update: {name: tr.name}
      })
    }

    for (const post of cat.posts) {
      const existingPost = await prisma.post.findFirst({
        where: {teacherId: teacher.id, categoryId: category.id, title: post.title}
      })
      if (existingPost) {
        console.log(`= ${cat.slug}: пост "${post.title}" уже существует (${existingPost.id}) — пропуск`)
        skippedPosts++
        continue
      }

      // resolve/create this topic's tests, capturing new ids for TEST_LINK rewrite
      const titleToId = new Map<string, string>()
      for (const test of cat.tests) {
        let row = await prisma.test.findFirst({where: {teacherId: teacher.id, title: test.title}})
        if (!row) {
          row = await prisma.test.create({
            data: {teacherId: teacher.id, title: test.title, content: test.content as object, aiTopic: test.aiTopic}
          })
          await prisma.testCategory.create({data: {testId: row.id, categoryId: category.id}})
          console.log(`  + ${cat.slug}: тест "${test.title}" создан (${row.id})`)
        }
        titleToId.set(test.title, row.id)
      }

      const rewrittenContent = rewriteTestLinkIds(post.content, titleToId)

      const created = await prisma.post.create({
        data: {
          teacherId: teacher.id,
          categoryId: category.id,
          title: post.title,
          content: rewrittenContent as object,
          mediaUrls: post.mediaUrls,
          visibility: 'PUBLIC',
          aiTopics: [],
          viewCount: 0
        }
      })
      console.log(`+ ${cat.slug}: пост "${post.title}" создан (${created.id})`)
      createdPosts++
    }
  }

  console.log(`\n✅ Russian course wave 1: ${createdPosts} постов создано, ${skippedPosts} уже существовало.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
