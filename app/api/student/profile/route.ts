import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const AVATAR_PALETTES = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#FEF3E2', text: '#9A5A00' },
  { bg: '#E3F0FF', text: '#1A5FAB' },
  { bg: '#F3F0FF', text: '#6B3FA0' },
]

function getPalette(id: string) {
  return AVATAR_PALETTES[id.charCodeAt(0) % AVATAR_PALETTES.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const studentId = session.user.id

    const [student, errorCount, callCount] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: {
          createdAt: true,
          teachers: {
            include: {
              teacher: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { linkedAt: 'asc' },
          },
          roadmapAccess: {
            include: {
              roadmap: {
                select: {
                  id: true,
                  title: true,
                  previewImageUrl: true,
                  price: true,
                  teacher: { select: { id: true, name: true, avatarUrl: true } },
                  _count: { select: { comments: true, ratings: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          serviceBookings: {
            include: {
              service: {
                select: {
                  id: true,
                  title: true,
                  duration: true,
                  timeFrom: true,
                  timeTo: true,
                  price: true,
                  photoUrl: true,
                  category: {
                    select: {
                      translations: { where: { langCode: 'ru' }, select: { langCode: true, name: true } },
                    },
                  },
                  teacher: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      }),
      prisma.studentError.count({ where: { studentId } }),
      prisma.conferenceParticipant.count({ where: { studentId, role: 'STUDENT' } }),
    ])

    if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build teachers with palette
    const teachers = student.teachers.map(ts => {
      const palette = getPalette(ts.teacher.id)
      return {
        id: ts.teacher.id,
        name: ts.teacher.name,
        avatarUrl: ts.teacher.avatarUrl,
        initials: getInitials(ts.teacher.name),
        avatarColor: palette.bg,
        avatarTextColor: palette.text,
        linkedAt: ts.linkedAt.toISOString(),
      }
    })

    // Derive subject from booked services per teacher
    const subjectByTeacher: Record<string, string> = {}
    for (const booking of student.serviceBookings) {
      const tid = booking.service.teacher.id
      if (!subjectByTeacher[tid]) {
        const catName = booking.service.category?.translations[0]?.name ?? ''
        if (catName) subjectByTeacher[tid] = catName
      }
    }

    const teachersWithSubject = teachers.map(t => ({
      ...t,
      subject: subjectByTeacher[t.id] ?? '',
    }))

    return NextResponse.json({
      memberSince: student.createdAt.toISOString(),
      teacherCount: teachers.length,
      callCount,
      errorCount,
      teachers: teachersWithSubject,
      roadmapAccess: student.roadmapAccess.map(ra => ({
        roadmapId: ra.roadmapId,
        grantedBy: ra.grantedBy,
        createdAt: ra.createdAt.toISOString(),
        roadmap: ra.roadmap,
      })),
      serviceBookings: student.serviceBookings.map(sb => ({
        id: sb.id,
        status: sb.status,
        finalPrice: sb.finalPrice,
        createdAt: sb.createdAt.toISOString(),
        service: sb.service,
      })),
    })
  } catch (e) {
    console.error('[GET /api/student/profile]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
