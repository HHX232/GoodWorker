import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { getChatSessionUser } from '@/shared/lib/chat/access'
import { unauthorized, type PlayerHit } from '@/shared/lib/chess/server/onlineStore'

// GET /api/chess/players?q=<≥2 символов> → 200 {players: PlayerHit[] /*≤20, без себя*/} · 400 {error:'SHORT'} · 401
export async function GET(req: NextRequest) {
  try {
    const user = await getChatSessionUser()
    if (!user) return unauthorized()
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
    if (q.length < 2) return NextResponse.json({ error: 'SHORT' }, { status: 400 })
    const where = { name: { contains: q, mode: 'insensitive' as const }, id: { not: user.id } }
    const select = { id: true, name: true, avatarUrl: true } as const
    const [teachers, students] = await Promise.all([
      prisma.teacher.findMany({ where, select: { ...select, categories: { where: { category: { slug: 'chess' } }, select: { categoryId: true } } }, take: 10, orderBy: { name: 'asc' } }),
      prisma.student.findMany({ where, select, take: 10, orderBy: { name: 'asc' } }),
    ])
    const ids = [...teachers, ...students].map((p) => p.id)
    const ratings = new Map((await prisma.chessProfile.findMany({ where: { userId: { in: ids } }, select: { userId: true, rating: true } })).map((r) => [r.userId, r.rating]))
    const players: PlayerHit[] = [
      ...teachers.map(({ categories, ...t }) => ({ ...t, isTeacher: true, isChessTutor: categories.length > 0, rating: ratings.get(t.id) ?? 1200 })),
      ...students.map((s) => ({ ...s, isTeacher: false, isChessTutor: false, rating: ratings.get(s.id) ?? 1200 })),
    ].sort((a, b) => Number(b.isChessTutor) - Number(a.isChessTutor) || a.name.localeCompare(b.name))
    return NextResponse.json({ players })
  } catch (e) {
    console.error('[GET /api/chess/players]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
