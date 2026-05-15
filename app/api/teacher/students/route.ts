import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const AVATAR_PALETTES = [
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#FEF3E2', text: '#9A5A00' },
  { bg: '#E3F0FF', text: '#1A5FAB' },
  { bg: '#F3F0FF', text: '#6B3FA0' },
  { bg: '#E8F8F5', text: '#1A7A5E' },
  { bg: '#FFF0F0', text: '#B03A3A' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function getPalette(id: string) {
  const idx = id.charCodeAt(0) % AVATAR_PALETTES.length
  return AVATAR_PALETTES[idx]
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId, role } = session.user as { id: string; role: string }

  const teacherId = req.nextUrl.searchParams.get('teacherId') ?? sessionId
  if (role !== 'ADMIN' && teacherId !== sessionId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.teacherStudent.findMany({
    where: { teacherId },
    include: { student: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { linkedAt: 'asc' },
  })

  const students = rows.map((r) => {
    const palette = getPalette(r.student.id)
    return {
      id: r.student.id,
      name: r.student.name,
      initials: getInitials(r.student.name),
      subject: '',
      avatarUrl: r.student.avatarUrl ?? null,
      avatarColor: palette.bg,
      avatarTextColor: palette.text,
    }
  })

  return NextResponse.json({ students })
}
