/* eslint-disable @typescript-eslint/no-explicit-any */
import PostPage, { EnrichedComment } from '@/_pages/PublickPages/PostPage/PostPage'
import { localizePost, enrichPostWithAI } from '@/lib/postAI'
import { prisma } from '@/shared/prisma/prisma'
import { SeoPostContent } from '@/shared/ui/Posts/SeoPostContent/SeoPostContent'
import { Prisma } from '@prisma/client'
import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { auth } from '../../../../auth'

function parseBlocks(content: Prisma.JsonValue): any[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  const obj = content as Record<string, Prisma.JsonValue>
  if (!Array.isArray(obj.blocks)) return []
  return obj.blocks as any[]
}

function extractPlainText(blocks: any[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type !== 'TEXT') continue
    const text = extractTextFromNode(block.payload?.content)
    if (text.trim()) parts.push(text.trim())
    if (parts.join(' ').length >= 200) break
  }
  return parts.join(' ').slice(0, 160)
}

function extractTextFromNode(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (Array.isArray(node.content)) return node.content.map(extractTextFromNode).join(' ')
  return ''
}

function extractFirstImage(blocks: any[]): string | null {
  for (const block of blocks) {
    if (block.type === 'MEDIA' && block.payload?.kind === 'image' && block.payload?.url) {
      return block.payload.url as string
    }
  }
  return null
}

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn() }
    catch (e) {
      const msg = String((e as Error).message ?? '')
      const isTransient = msg.includes("Can't reach database") || msg.includes('connection') || msg.includes('timeout')
      if (i < 2 && isTransient) {
        await new Promise(r => setTimeout(r, 400 * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

async function recordView(postId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'STUDENT') {
    const alreadyViewed = await prisma.postView.findUnique({
      where: {postId_studentId: {postId, studentId: userId}}
    })
    if (alreadyViewed) return false
    await prisma.$transaction([
      prisma.postView.create({data: {postId, studentId: userId, viewerRole: 'STUDENT'}}),
      prisma.post.update({where: {id: postId}, data: {viewCount: {increment: 1}}})
    ])
    return true
  }

  if (role === 'TEACHER') {
    const alreadyViewed = await prisma.postView.findFirst({
      where: {postId, teacherId: userId}
    })
    if (alreadyViewed) return false
    await prisma.$transaction([
      prisma.postView.create({data: {postId, teacherId: userId, viewerRole: 'TEACHER'}}),
      prisma.post.update({where: {id: postId}, data: {viewCount: {increment: 1}}})
    ])
    return true
  }

  return false
}

export async function generateMetadata({params}: {params: Promise<{id: string}>}): Promise<Metadata> {
  const {id} = await params
  const post = await prisma.post.findUnique({
    where: {id},
    select: {
      title: true,
      content: true,
      teacher: {select: {name: true}},
      category: {include: {translations: true}},
    }
  })
  if (!post) return {}

  const blocks = parseBlocks(post.content)
  const description = extractPlainText(blocks)
  const image = extractFirstImage(blocks)

  return {
    title: post.title,
    description: description || undefined,
    openGraph: {
      title: post.title,
      description: description || undefined,
      type: 'article',
      authors: post.teacher?.name ? [post.teacher.name] : undefined,
      ...(image ? {images: [{url: image}]} : {}),
    },
  }
}

async function PostServerPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const locale = (await cookies()).get('NEXT_LOCALE')?.value ?? 'ru'

  const [post, session] = await Promise.all([
    withDbRetry(() => prisma.post.findUnique({
      where: {id},
      include: {
        teacher: {select: {id: true, name: true, avatarUrl: true}},
        category: {include: {translations: true}},
        _count: {select: {views: true, comments: true}}
      }
    })),
    auth()
  ])

  if (!post) return notFound()

  // Trigger AI enrichment for posts that haven't been translated yet
  if (!(post as any).contentTranslations) {
    enrichPostWithAI(post.id).catch(() => {})
  }

  // Record view and optimistically bump viewCount
  if (session?.user?.id && session.user.role) {
    const incremented = await recordView(id, session.user.id, session.user.role)
    if (incremented) post.viewCount += 1
  }

  const rawComments = await prisma.postComment.findMany({
    where: {postId: id},
    orderBy: {createdAt: 'desc'},
    take: 50
  })

  const studentIds = rawComments.filter((c) => c.authorRole === 'STUDENT').map((c) => c.authorId)
  const teacherIds = rawComments.filter((c) => c.authorRole === 'TEACHER').map((c) => c.authorId)
  const selectFields = {id: true, name: true, avatarUrl: true}
  const allAuthorIds = [...studentIds, ...teacherIds]

  const [students, teachers, ratings] = await Promise.all([
    studentIds.length ? prisma.student.findMany({where: {id: {in: studentIds}}, select: selectFields}) : [],
    teacherIds.length ? prisma.teacher.findMany({where: {id: {in: teacherIds}}, select: selectFields}) : [],
    allAuthorIds.length
      ? prisma.postRating.findMany({where: {postId: id, authorId: {in: allAuthorIds}}, select: {authorId: true, stars: true}})
      : []
  ])

  const authorMap = new Map([...students.map((s) => [s.id, s] as const), ...teachers.map((t) => [t.id, t] as const)])
  const ratingMap = new Map(ratings.map((r) => [r.authorId, r.stars]))

  const enrichedComments: EnrichedComment[] = rawComments.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    authorRole: c.authorRole,
    text: c.text,
    imageUrls: c.imageUrls,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    author: authorMap.get(c.authorId) ?? null,
    stars: ratingMap.get(c.authorId) ?? null,
  }))

  const blocks = parseBlocks(post.content)
  const description = extractPlainText(blocks)
  const firstImage = extractFirstImage(blocks)
  const categoryName = post.category?.translations.find(t => t.langCode === 'ru')?.name ?? ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    ...(description ? {description} : {}),
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt?.toISOString() ?? post.createdAt.toISOString(),
    author: post.teacher ? {
      '@type': 'Person',
      name: post.teacher.name,
      url: `/users/${post.teacher.id}`,
    } : undefined,
    ...(firstImage ? {image: firstImage} : {}),
    ...(categoryName ? {articleSection: categoryName} : {}),
  }

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd)}}
      />
      <SeoPostContent
        blocks={blocks}
        title={post.title}
        authorName={post.teacher?.name}
        authorId={post.teacher?.id}
        publishedAt={post.createdAt}
        categoryName={categoryName}
      />
      <PostPage post={localizePost({...post, enrichedComments}, locale)} currentUserId={session?.user?.id} />
    </>
  )
}

export default PostServerPage
