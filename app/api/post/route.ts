// app/api/posts/route.ts
import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const body = await req.json()
    const {title, visibility, categoryIds, content} = body

    if (!title?.trim()) {
      return NextResponse.json({error: 'Title is required'}, {status: 400})
    }

    // categoryIds необязательны — берём первый если передан (у тебя categoryId в Post одиночный)
    const categoryId = categoryIds?.[0] ?? null

    const post = await prisma.post.create({
      data: {
        teacherId: session.user.id,
        title: title.trim(),
        visibility: visibility ?? 'PUBLIC',
        categoryId,
        content, // JSON — блоки поста
        mediaUrls: [], // отдельный массив если понадобится
        aiTopics: []
      }
    })

    return NextResponse.json(post, {status: 201})
  } catch (error) {
    console.error('[POST /api/posts]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
