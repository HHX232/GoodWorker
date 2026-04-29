import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../../auth'

interface Params {
  params: Promise<{id: string}>
}

export async function GET(req: NextRequest, {params}: Params) {
  try {
    const {id} = await params
    const session = await auth()

    const teacher = await prisma.teacher.findUnique({
      where: {id},
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        langCode: true,
        createdAt: true,
        phone: true,
        pasportConfirmed: true,
        categories: {
          include: {
            category: {include: {translations: true}}
          }
        },
        _count: {
          select: {posts: true, students: true}
        }
      }
    })

    if (teacher) {
      return NextResponse.json({...teacher, role: 'TEACHER'})
    }

    const isTeacher = session?.user?.role === 'TEACHER'

    const student = await prisma.student.findUnique({
      where: {id},
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        langCode: true,
        createdAt: true,
        phone: true,
        ...(isTeacher && {
          testAttempts: {
            include: {
              test: {select: {id: true, title: true}},
              studentErrors: {include: {categories: {include: {category: {include: {translations: true}}}}}}
            },
            orderBy: {startedAt: 'desc'}
          },
          errors: {
            include: {
              categories: {include: {category: {include: {translations: true}}}}
            },
            orderBy: {createdAt: 'desc'},
            take: 50
          },
          roadmapProgress: {
            include: {roadmap: {select: {id: true, title: true}}}
          }
        })
      }
    })

    if (student) {
      return NextResponse.json({...student, role: 'STUDENT'})
    }

    return NextResponse.json({error: 'Not found'}, {status: 404})
  } catch (error) {
    console.error('[GET /api/user/:id]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
