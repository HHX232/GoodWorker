// app/api/me/route.ts
import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../auth'

export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const {id, role} = session.user as {id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN'}

  try {
    if (role === 'TEACHER' || role === 'ADMIN') {
      const teacher = await prisma.teacher.findUnique({
        where: {id},
        select: {
          id: true,
          name: true,
          nameTransliterated: true,
          email: true,
          avatarUrl: true,
          langCode: true,
          phone: true,
          pasportConfirmed: true,
          createdAt: true,
          updatedAt: true,
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  slug: true,
                  translations: true
                }
              }
            }
          }
        }
      })

      if (!teacher) {
        return NextResponse.json({error: 'Unauthorized'}, {status: 401})
      }

      return NextResponse.json({role: 'TEACHER', ...teacher})
    }

    const student = await prisma.student.findUnique({
      where: {id},
      select: {
        id: true,
        name: true,
        nameTransliterated: true,
        email: true,
        avatarUrl: true,
        langCode: true,
        phone: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!student) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    return NextResponse.json({role: 'STUDENT', ...student})
  } catch {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }
}
