import {prisma} from '@/shared/prisma/prisma'
import {createNotification, NOTIFICATION_TYPES} from '@/shared/lib/notifications'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../../auth'

interface RouteParams {
  params: Promise<{id: string}>
}

interface AuthorRecord {
  id: string
  name: string
  avatarUrl: string | null
}

async function filesToBase64(form: FormData, field: string): Promise<string[]> {
  const entries = form.getAll(field)
  const results: string[] = []
  for (const entry of entries) {
    if (!(entry instanceof File) || entry.size === 0) continue
    const buffer = await entry.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    results.push(`data:${entry.type};base64,${base64}`)
  }
  return results
}

export async function GET(req: NextRequest, {params}: RouteParams) {
  try {
    const {id: postId} = await params
    const {searchParams} = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

    const [comments, total] = await Promise.all([
      prisma.postComment.findMany({
        where: {postId},
        orderBy: {createdAt: 'desc'},
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.postComment.count({where: {postId}})
    ])

    const studentIds = comments.filter((c) => c.authorRole === 'STUDENT').map((c) => c.authorId)
    const teacherIds = comments.filter((c) => c.authorRole === 'TEACHER').map((c) => c.authorId)
    const selectFields = {id: true, name: true, avatarUrl: true}

    const [students, teachers] = await Promise.all([
      studentIds.length
        ? prisma.student.findMany({where: {id: {in: studentIds}}, select: selectFields})
        : ([] as AuthorRecord[]),
      teacherIds.length
        ? prisma.teacher.findMany({where: {id: {in: teacherIds}}, select: selectFields})
        : ([] as AuthorRecord[])
    ])

    const authorMap = new Map<string, AuthorRecord>([
      ...students.map((s): [string, AuthorRecord] => [s.id, s]),
      ...teachers.map((t): [string, AuthorRecord] => [t.id, t])
    ])

    const enriched = comments.map((c) => ({...c, author: authorMap.get(c.authorId) ?? null}))

    return NextResponse.json({
      comments: enriched,
      pagination: {page, limit, total, totalPages: Math.ceil(total / limit)}
    })
  } catch (error) {
    console.error('[GET /api/post/:id/comments]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function POST(req: NextRequest, {params}: RouteParams) {
  try {
    const {id: postId} = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({error: 'Unauthorized'}, {status: 401})

    const form = await req.formData()

    const text = form.get('text')
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({error: 'Text is required'}, {status: 400})
    }

    const post = await prisma.post.findUnique({where: {id: postId}, select: {id: true, teacherId: true, title: true}})
    if (!post) return NextResponse.json({error: 'Post not found'}, {status: 404})

    // One comment per user per post
    const existing = await prisma.postComment.findFirst({
      where: {postId, authorId: session.user.id},
      select: {id: true}
    })
    if (existing) {
      return NextResponse.json({error: 'You have already left a comment on this post'}, {status: 409})
    }

    const imageUrls = await filesToBase64(form, 'images')

    const comment = await prisma.postComment.create({
      data: {
        postId,
        authorId: session.user.id,
        authorRole: session.user.role as 'STUDENT' | 'TEACHER' | 'ADMIN',
        text: text.trim(),
        imageUrls
      }
    })

    const selectFields = {id: true, name: true, avatarUrl: true}
    let author: AuthorRecord | null = null
    if (session.user.role === 'STUDENT') {
      author = await prisma.student.findUnique({where: {id: session.user.id}, select: selectFields})
    } else if (session.user.role === 'TEACHER') {
      author = await prisma.teacher.findUnique({where: {id: session.user.id}, select: selectFields})
    }

    // Notify post owner (teacher) about new comment — skip if commenter is the teacher themselves
    if (post.teacherId && post.teacherId !== session.user.id) {
      await createNotification({
        type: NOTIFICATION_TYPES.NEW_COMMENT_ON_POST,
        title: 'Новый комментарий',
        body: `${author?.name ?? 'Пользователь'} оставил комментарий к посту «${post.title ?? 'Без названия'}»`,
        payload: {
          actorId: session.user.id,
          actorName: author?.name ?? 'Пользователь',
          actorRole: session.user.role,
          postId,
          postTitle: post.title ?? '',
        },
        teacherId: post.teacherId,
      })
    }

    return NextResponse.json({...comment, author}, {status: 201})
  } catch (error) {
    console.error('[POST /api/post/:id/comments]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
