import { prisma } from '@/shared/prisma/prisma'
import { NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// POST /api/admin/notifications — broadcast SYSTEM notification
// Body: { target: 'all' | 'students' | 'teachers', title: string, body: string, html?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { target, title, body: notifBody, html } = body as {
      target: 'all' | 'students' | 'teachers'
      title: string
      body: string
      html?: string
    }

    if (!title?.trim() || !notifBody?.trim()) {
      return NextResponse.json({ error: 'Title and body required' }, { status: 400 })
    }
    if (!['all', 'students', 'teachers'].includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
    }

    const payload = html?.trim() ? { html: html.trim() } : undefined
    let created = 0

    if (target === 'all' || target === 'teachers') {
      const teachers = await prisma.teacher.findMany({ select: { id: true } })
      if (teachers.length > 0) {
        await prisma.notification.createMany({
          data: teachers.map(t => ({
            type: NOTIFICATION_TYPES.SYSTEM,
            title: title.trim(),
            body: notifBody.trim(),
            payload: payload ?? undefined,
            isRead: false,
            teacherId: t.id,
          })),
        })
        created += teachers.length
      }
    }

    if (target === 'all' || target === 'students') {
      const students = await prisma.student.findMany({ select: { id: true } })
      if (students.length > 0) {
        await prisma.notification.createMany({
          data: students.map(s => ({
            type: NOTIFICATION_TYPES.SYSTEM,
            title: title.trim(),
            body: notifBody.trim(),
            payload: payload ?? undefined,
            isRead: false,
            studentId: s.id,
          })),
        })
        created += students.length
      }
    }

    return NextResponse.json({ ok: true, created })
  } catch (error) {
    console.error('[POST /api/admin/notifications]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
