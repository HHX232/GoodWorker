import { NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { isTeacherVipActive } from '@/shared/lib/tutorFiles/access'
import { isStudentVipActive } from '@/shared/lib/studentDrive/drive'
import type { LectureNote } from '@prisma/client'
import { auth } from '../../../../auth'

/** ADMIN is the seed tutor account → stored as TEACHER with the same id, like the chat. */
export interface LectureUser {
  id: string
  role: 'STUDENT' | 'TEACHER'
  isAdmin: boolean
}

export async function getLectureUser(): Promise<LectureUser | null> {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id) return null
  if (role === 'ADMIN') return { id: session.user.id, role: 'TEACHER', isAdmin: true }
  if (role === 'TEACHER' || role === 'STUDENT') return { id: session.user.id, role, isAdmin: false }
  return null
}

/** /lecture is VIP (student or tutor); admins have no limits. */
export async function hasLectureAccess(user: LectureUser): Promise<boolean> {
  if (user.isAdmin) return true
  return user.role === 'STUDENT' ? isStudentVipActive(user.id) : isTeacherVipActive(user.id)
}

export function vipRequired(): NextResponse {
  return NextResponse.json({ error: 'VIP_REQUIRED' }, { status: 403 })
}

type Guard = { user: LectureUser; lecture: LectureNote; response?: undefined } | { response: NextResponse; user?: undefined; lecture?: undefined }

/** Session + ownership of one lecture. `write` also requires active VIP (reading your own stays open). */
export async function requireOwnLecture(id: string, opts: { write?: boolean } = {}): Promise<Guard> {
  const user = await getLectureUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const lecture = await prisma.lectureNote.findUnique({ where: { id } })
  if (!lecture || lecture.ownerId !== user.id || lecture.ownerRole !== user.role) {
    return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  if (opts.write && !(await hasLectureAccess(user))) return { response: vipRequired() }
  return { user, lecture }
}
