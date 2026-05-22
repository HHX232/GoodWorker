import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../../../auth'
import {enrichCommentWithAI} from '@/lib/postAI'

interface RouteParams {
  params: Promise<{id: string; commentId: string}>
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

async function resolveAuthor(authorId: string, authorRole: string): Promise<AuthorRecord | null> {
  const select = {id: true, name: true, avatarUrl: true}
  if (authorRole === 'STUDENT') return prisma.student.findUnique({where: {id: authorId}, select})
  if (authorRole === 'TEACHER') return prisma.teacher.findUnique({where: {id: authorId}, select})
  return null
}

export async function PATCH(req: NextRequest, {params}: RouteParams) {
  try {
    const {commentId} = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({error: 'Unauthorized'}, {status: 401})

    const comment = await prisma.postComment.findUnique({where: {id: commentId}})
    if (!comment) return NextResponse.json({error: 'Not found'}, {status: 404})
    if (comment.authorId !== session.user.id) return NextResponse.json({error: 'Forbidden'}, {status: 403})

    const form = await req.formData()

    const text = form.get('text')
    if (text !== null && (typeof text !== 'string' || !text.trim())) {
      return NextResponse.json({error: 'Text cannot be empty'}, {status: 400})
    }
    const keepImageUrls = form.getAll('keepImageUrls').filter((v): v is string => typeof v === 'string')
    const newImages = await filesToBase64(form, 'images')

    const imageUrls =
      newImages.length > 0 || keepImageUrls.length !== comment.imageUrls.length
        ? [...keepImageUrls, ...newImages]
        : undefined

    const updated = await prisma.postComment.update({
      where: {id: commentId},
      data: {
        ...(typeof text === 'string' && text.trim() ? {text: text.trim()} : {}),
        imageUrls: imageUrls ?? comment.imageUrls,
        editedAt: new Date()
      }
    })

    // Re-translate when text changed
    if (typeof text === 'string' && text.trim() && process.env.OPENROUTER_API_KEY) {
      enrichCommentWithAI(updated.id).catch(e => console.error('[commentAI]', e))
    }

    const author = await resolveAuthor(updated.authorId, updated.authorRole)
    return NextResponse.json({...updated, author})
  } catch (error) {
    console.error('[PATCH /api/post/:id/comments/:commentId]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function DELETE(req: NextRequest, {params}: RouteParams) {
  try {
    const {id: postId, commentId} = await params
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({error: 'Unauthorized'}, {status: 401})

    const comment = await prisma.postComment.findUnique({where: {id: commentId}})
    if (!comment) return NextResponse.json({error: 'Not found'}, {status: 404})

    const isAuthor = comment.authorId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    let isPostTeacher = false
    if ((session.user.role === 'TEACHER' || session.user.role === 'ADMIN')) {
      const post = await prisma.post.findUnique({where: {id: postId}, select: {teacherId: true}})
      isPostTeacher = post?.teacherId === session.user.id
    }

    if (!isAuthor && !isPostTeacher && !isAdmin) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }

    await prisma.postComment.delete({where: {id: commentId}})
    return NextResponse.json({success: true})
  } catch (error) {
    console.error('[DELETE /api/post/:id/comments/:commentId]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
