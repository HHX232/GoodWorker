import {prisma} from '@/shared/prisma/prisma'
import {NextResponse} from 'next/server'
import {auth} from '../../../../auth'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  }

  const {id, role} = session.user as {id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN'}
  const now = new Date()

  try {
    if (role === 'TEACHER' || role === 'ADMIN') {
      await prisma.teacher.update({where: {id}, data: {lastSeenAt: now}})
    } else {
      await prisma.student.update({where: {id}, data: {lastSeenAt: now}})
    }
  } catch {
    // Non-critical — ignore DB errors silently
  }

  return NextResponse.json({ok: true})
}
