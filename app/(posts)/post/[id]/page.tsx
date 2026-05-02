/* eslint-disable @typescript-eslint/no-explicit-any */
import PostPage, { EnrichedComment } from '@/_pages/PublickPages/PostPage/PostPage'
import { prisma } from '@/shared/prisma/prisma'
import { SeoPostContent } from '@/shared/ui/Posts/SeoPostContent/SeoPostContent'
import { Prisma } from '@prisma/client'
import { notFound } from 'next/navigation'
import { auth } from '../../../../auth'

function parseBlocks(content: Prisma.JsonValue): any[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  const obj = content as Record<string, Prisma.JsonValue>
  if (!Array.isArray(obj.blocks)) return []
  return obj.blocks as any[]
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

async function PostServerPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params

  const [post, session] = await Promise.all([
    prisma.post.findUnique({
      where: {id},
      include: {
        teacher: {select: {id: true, name: true, avatarUrl: true}},
        category: {include: {translations: true}},
        _count: {select: {views: true, comments: true}}
      }
    }),
    auth()
  ])

  if (!post) return notFound()

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

  const [students, teachers] = await Promise.all([
    studentIds.length ? prisma.student.findMany({where: {id: {in: studentIds}}, select: selectFields}) : [],
    teacherIds.length ? prisma.teacher.findMany({where: {id: {in: teacherIds}}, select: selectFields}) : []
  ])

  const authorMap = new Map([...students.map((s) => [s.id, s] as const), ...teachers.map((t) => [t.id, t] as const)])

  const enrichedComments: EnrichedComment[] = rawComments.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    authorRole: c.authorRole,
    text: c.text,
    imageUrls: c.imageUrls,
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    author: authorMap.get(c.authorId) ?? null
  }))

  const blocks = parseBlocks(post.content)

  return (
    <>
      <SeoPostContent blocks={blocks} />
      <PostPage post={{...post, enrichedComments}} currentUserId={session?.user?.id} />
     
    </>
  )
}

export default PostServerPage
