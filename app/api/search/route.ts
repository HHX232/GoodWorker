import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'

const LIMIT = 4

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q || q.length < 2) return NextResponse.json({posts: [], teachers: [], roadmaps: []})

    const session = await auth()
    const isTeacher = session?.user?.role === 'TEACHER'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postWhere: any = {title: {contains: q, mode: 'insensitive'}}
    if (!isTeacher) postWhere.visibility = {in: ['PUBLIC', 'STUDENTS']}

    const [posts, teachers, roadmaps] = await Promise.all([
      prisma.post.findMany({
        where: postWhere,
        take: LIMIT,
        orderBy: {viewCount: 'desc'},
        select: {id: true, title: true, teacher: {select: {name: true}}}
      }),
      prisma.teacher.findMany({
        where: {name: {contains: q, mode: 'insensitive'}},
        take: LIMIT,
        orderBy: {createdAt: 'desc'},
        select: {id: true, name: true, avatarUrl: true}
      }),
      prisma.roadmap.findMany({
        where: {title: {contains: q, mode: 'insensitive'}},
        take: LIMIT,
        orderBy: {createdAt: 'desc'},
        select: {id: true, title: true, teacher: {select: {name: true}}}
      })
    ])

    return NextResponse.json({posts, teachers, roadmaps})
  } catch (error) {
    console.error('[GET /api/search]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
