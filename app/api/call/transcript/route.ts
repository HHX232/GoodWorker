/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function toLocalTime(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// POST /api/call/transcript — save transcript after a call ends
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomName, transcriptRaw, transcriptJson, participants } = await req.json()
    if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

    const callEndedAt = new Date()

    await prisma.videoCallRoom.update({
      where: { id: room.id },
      data: {
        endedAt: callEndedAt,
        transcriptRaw: transcriptRaw ?? null,
        transcriptJson: transcriptJson ?? null,
      },
    })

    // Upsert participants
    if (Array.isArray(participants) && participants.length > 0) {
      await prisma.$transaction(
        participants.map((p: { identity: string; userId?: string; userRole?: string }) =>
          prisma.videoCallParticipant.upsert({
            where: { id: `${room.id}::${p.identity}` },
            create: {
              id: `${room.id}::${p.identity}`,
              roomId: room.id,
              identity: p.identity,
              userId: p.userId ?? null,
              userRole: (p.userRole as any) ?? null,
            },
            update: {},
          })
        )
      )
    }

    // ── Auto-complete scheduled calendar meetings ──────────────────────────────
    // Only do this if the room owner is a teacher
    if (room.ownerRole === 'TEACHER') {
      try {
        const teacherId = room.ownerId
        const teacher = await prisma.teacher.findUnique({
          where: { id: teacherId },
          select: { calendar: true },
        })

        if (teacher?.calendar) {
          const calData = teacher.calendar as { events?: unknown[]; tasks?: unknown[] }
          const events = (calData.events ?? []) as Array<Record<string, unknown>>

          const callDate = toLocalDate(callEndedAt)
          const callTime = toLocalTime(callEndedAt)
          const callMins = timeToMins(callTime)

          // Find student names from participants (students who called)
          const studentIds = (Array.isArray(participants) ? participants : [])
            .filter((p: any) => p.userRole === 'STUDENT' && p.userId)
            .map((p: any) => p.userId as string)

          let studentNames: string[] = []
          if (studentIds.length > 0) {
            const students = await prisma.student.findMany({
              where: { id: { in: studentIds } },
              select: { id: true, name: true },
            })
            studentNames = students.map(s => s.name.toLowerCase())
          }

          let changed = false
          const updatedEvents = events.map((ev) => {
            if (ev.status !== 'scheduled') return ev
            if (ev.date !== callDate) return ev

            const studentMatch =
              studentNames.length === 0 ||
              (ev.studentName &&
                studentNames.some(n => (ev.studentName as string).toLowerCase().includes(n) || n.includes((ev.studentName as string).toLowerCase())))

            if (!studentMatch) return ev

            const scheduledMins = timeToMins((ev.startTime as string) ?? '00:00')
            const diffMins = Math.abs(callMins - scheduledMins)

            if (diffMins <= 60) {
              // Called close to scheduled time — mark completed, keep times
              changed = true
              return { ...ev, status: 'completed' }
            } else {
              // Called same day but different time — completed at actual time
              changed = true
              const durMins: number = ((ev.durationMinutes as number | null | undefined)
                ?? (ev.endTime ? timeToMins(ev.endTime as string) - scheduledMins : 0)
              ) || 60
              const endMins = callMins + durMins
              const endH = Math.floor(endMins / 60) % 24
              const endM = endMins % 60
              return {
                ...ev,
                status: 'completed',
                startTime: callTime,
                endTime: `${pad(endH)}:${pad(endM)}`,
              }
            }
          })

          if (changed) {
            await prisma.teacher.update({
              where: { id: teacherId },
              data: { calendar: { events: updatedEvents, tasks: calData.tasks ?? [] } as any },
            })
          }
        }
      } catch (calErr) {
        // Non-fatal — don't fail the whole request
        console.error('[transcript] calendar auto-complete error:', calErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}

// GET /api/call/transcript?roomName=xxx — fetch transcript
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roomName = new URL(req.url).searchParams.get('roomName')
    if (!roomName) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

    const room = await prisma.videoCallRoom.findUnique({
      where: { name: roomName },
      include: { participants: true },
    })
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      transcriptRaw: room.transcriptRaw,
      transcriptJson: room.transcriptJson,
      participants: room.participants,
      endedAt: room.endedAt,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
