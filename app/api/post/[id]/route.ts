import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../auth'
import {canViewPost} from '@/features/helpers/Post/canViewPost'
import {PostVisibility} from '@prisma/client'
import {localizePost} from '@/lib/postAI'

function extractMediaUrls(content: {blocks?: {type: string; payload: {url?: string | null}}[]} | null): string[] {
  if (!content?.blocks) return []
  return content.blocks
    .filter((b) => b.type === 'MEDIA' && b.payload?.url && !b.payload.url.startsWith('blob:'))
    .map((b) => b.payload.url as string)
}

interface Params {
  params: Promise<{id: string}>
}

export async function PATCH(req: NextRequest, {params}: Params) {
  try {
    const {id} = await params
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const post = await prisma.post.findUnique({where: {id}})
    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})
    if (post.teacherId !== session.user.id) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }

    const body = await req.json()
    const {title, additionalTitle, visibility, categoryIds, content, isVip, vipExpiresAt, allowedStudentIds} = body

    if (visibility && !Object.values(PostVisibility).includes(visibility)) {
      return NextResponse.json({error: 'Invalid visibility value'}, {status: 400})
    }

    const newVisibility = visibility ?? post.visibility
    const categoryId = categoryIds?.[0] ?? post.categoryId

    const updated = await prisma.$transaction(async (tx) => {
      // Пересинхронизируем allowedStudents если меняется visibility или список
      if (newVisibility === 'SELECTED' && allowedStudentIds) {
        await tx.postAllowedStudent.deleteMany({where: {postId: id}})
        await tx.postAllowedStudent.createMany({
          data: allowedStudentIds.map((studentId: string) => ({postId: id, studentId}))
        })
      } else if (newVisibility !== 'SELECTED') {
        // Если убрали SELECTED — чистим список
        await tx.postAllowedStudent.deleteMany({where: {postId: id}})
      }

      return tx.post.update({
        where: {id},
        data: {
          ...(title && {title: title.trim()}),
          ...(additionalTitle !== undefined && {additionalTitle: additionalTitle?.trim() ?? null}),
          ...(visibility && {visibility}),
          ...(categoryId !== undefined && {categoryId}),
          ...(content && {content, mediaUrls: extractMediaUrls(content)}),
          ...(isVip !== undefined && {isVip}),
          ...(isVip && vipExpiresAt ? {vipExpiresAt: new Date(vipExpiresAt)} : {}),
          ...(!isVip ? {vipExpiresAt: null} : {})
        },
        include: {allowedStudents: true}
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
export async function DELETE(req: NextRequest, {params}: Params) {
  try {
    const {id} = await params
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const post = await prisma.post.findUnique({where: {id}})
    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})
    if (post.teacherId !== session.user.id) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }

    await prisma.post.delete({where: {id}})
    return NextResponse.json({success: true})
  } catch (error) {
    console.error('[DELETE /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
export async function GET(req: NextRequest, {params}: Params) {
  try {
    const {id} = await params
    const session = await auth()

    const post = await prisma.post.findUnique({
      where: {id},
      include: {
        teacher: {select: {id: true, name: true, avatarUrl: true}},
        category: {include: {translations: true}},
        _count: {select: {comments: true}}
      }
    })

    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})

    // @ts-ignore
    if (post.moderationStatus && post.moderationStatus !== 'PUBLISHED' && session?.user?.role !== 'ADMIN') {
      return NextResponse.json({error: 'Not found'}, {status: 404})
    }

    const visible = await canViewPost({
      post,
      userId: session?.user?.id,
      userRole: session?.user?.role
    })
    if (!visible) return NextResponse.json({error: 'Forbidden'}, {status: 403})

    if (session?.user?.id) {
      const role = session.user.role

      if (role === 'STUDENT') {
        const alreadyViewed = await prisma.postView.findUnique({
          where: {postId_studentId: {postId: id, studentId: session.user.id}}
        })

        if (!alreadyViewed) {
          await prisma.$transaction([
            prisma.postView.create({
              data: {postId: id, studentId: session.user.id, viewerRole: 'STUDENT'}
            }),
            prisma.post.update({
              where: {id},
              data: {viewCount: {increment: 1}}
            })
          ])
        }
      } else if (role === 'TEACHER') {
        const alreadyViewed = await prisma.postView.findFirst({
          where: {postId: id, teacherId: session.user.id}
        })

        if (!alreadyViewed) {
          await prisma.$transaction([
            prisma.postView.create({
              data: {postId: id, teacherId: session.user.id, viewerRole: 'TEACHER'}
            }),
            prisma.post.update({
              where: {id},
              data: {viewCount: {increment: 1}}
            })
          ])
        }
      }
    }
    const lang = req.nextUrl.searchParams.get('lang') ?? 'ru'
    return NextResponse.json(localizePost(post, lang))
  } catch (error) {
    console.error('[GET /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
