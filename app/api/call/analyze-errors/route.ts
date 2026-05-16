import { prisma } from '@/shared/prisma/prisma'
import { analyzeTranscriptErrors, type Participant } from '@/shared/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// POST /api/call/analyze-errors
// Body: { roomName: string } | { transcript: string, participants: Participant[] }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    let transcript: string
    let participants: Participant[]

    if (body.roomName) {
      // Fetch transcript from DB
      const room = await prisma.videoCallRoom.findUnique({
        where: { name: body.roomName },
        include: { participants: true },
      })
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      if (!room.transcriptRaw) return NextResponse.json({ error: 'No transcript for this room' }, { status: 400 })

      transcript = room.transcriptRaw

      // Resolve participant names from DB
      const studentIds = room.participants.filter(p => p.userRole === 'STUDENT').map(p => p.userId).filter(Boolean) as string[]
      const teacherIds = room.participants.filter(p => p.userRole === 'TEACHER').map(p => p.userId).filter(Boolean) as string[]

      const [students, teachers] = await Promise.all([
        studentIds.length ? prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true } }) : [],
        teacherIds.length ? prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }) : [],
      ])

      participants = [
        ...teachers.map(t => ({ userId: t.id, name: t.name, role: 'TEACHER' as const })),
        ...students.map(s => ({ userId: s.id, name: s.name, role: 'STUDENT' as const })),
      ]
    } else {
      if (!body.transcript) return NextResponse.json({ error: 'transcript required' }, { status: 400 })
      transcript = body.transcript
      participants = body.participants ?? []
    }

    if (!participants.some(p => p.role === 'STUDENT')) {
      return NextResponse.json({ errors: [], message: 'No students found in the call' })
    }

    // Fetch all categories
    const categories = await prisma.category.findMany({
      include: { translations: { where: { langCode: 'ru' } } },
      orderBy: { levelNumber: 'asc' },
    })

    const categoryRefs = categories.map(c => ({
      id: c.id,
      name: c.translations[0]?.name ?? c.slug,
    }))

    const validCategoryIds = new Set(categoryRefs.map(c => c.id))

    // Call Gemini
    const detected = await analyzeTranscriptErrors(transcript, participants, categoryRefs)

    if (detected.length === 0) {
      return NextResponse.json({ errors: [], message: 'No errors detected' })
    }

    // Build student name → id map
    const studentParticipants = participants.filter(p => p.role === 'STUDENT')
    const nameToId = new Map<string, string>()
    for (const p of studentParticipants) {
      if (p.userId) nameToId.set(p.name.toLowerCase(), p.userId)
    }

    const sourceId = body.roomName ?? 'manual'

    // Save errors
    const saved = await prisma.$transaction(async (tx) => {
      const result = []

      for (const detected_error of detected) {
        const validCatIds = detected_error.categoryIds.filter(id => validCategoryIds.has(id))

        const targetStudentIds: string[] =
          detected_error.studentName === 'ALL_STUDENTS'
            ? studentParticipants.map(p => p.userId).filter(Boolean) as string[]
            : (() => {
                const id = nameToId.get(detected_error.studentName.toLowerCase())
                return id ? [id] : studentParticipants.map(p => p.userId).filter(Boolean) as string[]
              })()

        for (const studentId of targetStudentIds) {
          const error = await tx.studentError.create({
            data: {
              studentId,
              sourceType: 'video_call',
              sourceId,
              description: detected_error.description,
              fragment: detected_error.fragment ?? null,
              isCorrection: detected_error.type === 'correction',
              categories: validCatIds.length
                ? {
                    create: validCatIds.map(categoryId => ({ categoryId })),
                  }
                : undefined,
            },
            include: {
              student: { select: { name: true } },
              categories: { include: { category: { include: { translations: { where: { langCode: 'ru' } } } } } },
            },
          })
          result.push(error)
        }
      }

      return result
    })

    return NextResponse.json({ errors: saved, count: saved.length })
  } catch (e: any) {
    console.error('[analyze-errors]', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// GET /api/call/analyze-errors?studentId=xxx — fetch saved errors for a student
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId') ?? session.user.id
    const sourceId = searchParams.get('sourceId') ?? undefined

    const where = {
      studentId,
      ...(sourceId ? { sourceId } : {}),
      sourceType: 'video_call',
    }

    const errors = await prisma.studentError.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        categories: {
          include: {
            category: {
              include: { translations: { where: { langCode: 'ru' } } },
            },
          },
        },
      },
    })

    return NextResponse.json(errors)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
