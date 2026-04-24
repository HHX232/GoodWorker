import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../auth'

interface Params {
  params: {id: string}
}

export async function PATCH(req: NextRequest, {params}: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const post = await prisma.post.findUnique({where: {id: params.id}})
    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})
    if (post.teacherId !== session.user.id) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }

    const body = await req.json()
    const {title, visibility, categoryIds, content} = body
    const categoryId = categoryIds?.[0] ?? post.categoryId

    const updated = await prisma.post.update({
      where: {id: params.id},
      data: {
        ...(title && {title: title.trim()}),
        ...(visibility && {visibility}),
        ...(categoryId !== undefined && {categoryId}),
        ...(content && {content})
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function DELETE(req: NextRequest, {params}: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const post = await prisma.post.findUnique({where: {id: params.id}})
    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})
    if (post.teacherId !== session.user.id) {
      return NextResponse.json({error: 'Forbidden'}, {status: 403})
    }

    await prisma.post.delete({where: {id: params.id}})
    return NextResponse.json({success: true})
  } catch (error) {
    console.error('[DELETE /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}

export async function GET(req: NextRequest, {params}: Params) {
  try {
    const post = await prisma.post.findUnique({
      where: {id: params.id},
      include: {
        teacher: {select: {id: true, name: true, avatarUrl: true}},
        category: true
      }
    })

    if (!post) return NextResponse.json({error: 'Not found'}, {status: 404})
    return NextResponse.json(post)
  } catch (error) {
    console.error('[GET /api/posts/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
