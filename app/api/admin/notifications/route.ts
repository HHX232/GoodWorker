import { prisma } from '@/shared/prisma/prisma'
import { NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { translateNotificationText } from '@/lib/postAI'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// POST /api/admin/notifications — broadcast SYSTEM notification
// Body: { target: 'all' | 'students' | 'teachers' | 'user', title: string, body: string, html?: string, email?: string }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { target, title, body: notifBody, html, email } = body as {
      target: 'all' | 'students' | 'teachers' | 'user'
      title: string
      body: string
      html?: string
      email?: string
    }

    if (!title?.trim() || !notifBody?.trim()) {
      return NextResponse.json({ error: 'Title and body required' }, { status: 400 })
    }
    if (!['all', 'students', 'teachers', 'user'].includes(target)) {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
    }

    const payload = html?.trim() ? { html: html.trim() } : undefined
    const cleanTitle = title.trim()
    const cleanBody = notifBody.trim()

    // Translate once via AI, then apply to all recipients
    const translations = await translateNotificationText(cleanTitle, cleanBody).catch(() => null)
    const titleTranslations = translations?.titleTranslations ?? undefined
    const bodyTranslations = translations?.bodyTranslations ?? undefined

    let created = 0

    // Send to a specific user by email
    if (target === 'user') {
      if (!email?.trim()) {
        return NextResponse.json({ error: 'Email required for target=user' }, { status: 400 })
      }
      const normalizedEmail = email.trim().toLowerCase()
      const teacher = await prisma.teacher.findFirst({ where: { email: normalizedEmail }, select: { id: true } })
      if (teacher) {
        await prisma.notification.create({
          data: {
            type: NOTIFICATION_TYPES.SYSTEM,
            title: cleanTitle,
            body: cleanBody,
            titleTranslations: titleTranslations ?? undefined,
            bodyTranslations: bodyTranslations ?? undefined,
            payload: payload ?? undefined,
            isRead: false,
            teacherId: teacher.id,
          },
        })
        created += 1
      } else {
        const student = await prisma.student.findFirst({ where: { email: normalizedEmail }, select: { id: true } })
        if (student) {
          await prisma.notification.create({
            data: {
              type: NOTIFICATION_TYPES.SYSTEM,
              title: cleanTitle,
              body: cleanBody,
              titleTranslations: titleTranslations ?? undefined,
              bodyTranslations: bodyTranslations ?? undefined,
              payload: payload ?? undefined,
              isRead: false,
              studentId: student.id,
            },
          })
          created += 1
        } else {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
      }
      return NextResponse.json({ ok: true, created })
    }

    if (target === 'all' || target === 'teachers') {
      const teachers = await prisma.teacher.findMany({ select: { id: true } })
      if (teachers.length > 0) {
        await prisma.notification.createMany({
          data: teachers.map(t => ({
            type: NOTIFICATION_TYPES.SYSTEM,
            title: cleanTitle,
            body: cleanBody,
            titleTranslations: titleTranslations ?? undefined,
            bodyTranslations: bodyTranslations ?? undefined,
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
            title: cleanTitle,
            body: cleanBody,
            titleTranslations: titleTranslations ?? undefined,
            bodyTranslations: bodyTranslations ?? undefined,
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
