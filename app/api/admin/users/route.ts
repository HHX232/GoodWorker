import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

// ─── Types ────────────────────────────────────────────────

interface UserItem {
  id: string
  name: string
  email: string
  role: 'STUDENT' | 'TEACHER'
  avatarUrl: string | null
  isVip: boolean
  vipExpiresAt: string | null
  isBanned: boolean
  bannedAt: string | null
  banReason: string | null
  createdAt: string
  lastSeenAt: string | null
  _count: { posts?: number; roadmaps?: number; teachers?: number; students?: number }
}

// ─── GET — paginated user list ─────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const role   = searchParams.get('role')   ?? 'all'   // all | TEACHER | STUDENT
  const status = searchParams.get('status') ?? 'all'   // all | active | banned | vip
  const q      = (searchParams.get('q') ?? '').trim()
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit  = Math.max(1, parseInt(searchParams.get('limit') ?? '20'))

  // build shared where clause fields
  const searchWhere = q
    ? { OR: [
        { name:  { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ]}
    : {}

  const bannedWhere = status === 'banned' ? { isBanned: true }
    : status === 'active' ? { isBanned: false }
    : {}

  const vipWhere = status === 'vip' ? { isVip: true } : {}

  const commonWhere = { ...searchWhere, ...bannedWhere, ...vipWhere }

  const students: UserItem[] = []
  const teachers: UserItem[] = []

  if (role === 'all' || role === 'STUDENT') {
      const rows = await (prisma.student as any).findMany({
      where: commonWhere,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isVip: true,
        vipExpiresAt: true,
        isBanned: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { teachers: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      students.push({
        id: r.id,
        name: r.name,
        email: r.email,
        role: 'STUDENT',
        avatarUrl: r.avatarUrl ?? null,
        isVip: r.isVip,
        vipExpiresAt: r.vipExpiresAt ? new Date(r.vipExpiresAt).toISOString() : null,
        isBanned: r.isBanned ?? false,
        bannedAt: r.bannedAt ? new Date(r.bannedAt).toISOString() : null,
        banReason: r.banReason ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
        lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
        _count: { teachers: r._count?.teachers ?? 0 },
      })
    }
  }

  if (role === 'all' || role === 'TEACHER') {
      const rows = await (prisma.teacher as any).findMany({
      where: commonWhere,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isVip: true,
        vipExpiresAt: true,
        isBanned: true,
        bannedAt: true,
        banReason: true,
        createdAt: true,
        lastSeenAt: true,
        _count: { select: { posts: true, roadmaps: true, students: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      teachers.push({
        id: r.id,
        name: r.name,
        email: r.email,
        role: 'TEACHER',
        avatarUrl: r.avatarUrl ?? null,
        isVip: r.isVip,
        vipExpiresAt: r.vipExpiresAt ? new Date(r.vipExpiresAt).toISOString() : null,
        isBanned: r.isBanned ?? false,
        bannedAt: r.bannedAt ? new Date(r.bannedAt).toISOString() : null,
        banReason: r.banReason ?? null,
        createdAt: new Date(r.createdAt).toISOString(),
        lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
        _count: { posts: r._count?.posts ?? 0, roadmaps: r._count?.roadmaps ?? 0, students: r._count?.students ?? 0 },
      })
    }
  }

  // merge and sort by createdAt desc
  const merged = [...students, ...teachers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const total      = merged.length
  const totalPages = Math.ceil(total / limit)
  const items      = merged.slice((page - 1) * limit, page * limit)

  return NextResponse.json({ items, total, totalPages })
}

// ─── PATCH — update user fields ────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, role, isBanned, banReason, isVip, vipExpiresAt } = body

  if (!id || !role || !['TEACHER', 'STUDENT'].includes(role)) {
    return NextResponse.json({ error: 'id and valid role required' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (typeof isBanned === 'boolean') {
    data.isBanned = isBanned
    data.bannedAt = isBanned ? new Date() : null
    if (!isBanned) data.banReason = null
  }

  if (typeof banReason !== 'undefined') {
    data.banReason = banReason
  }

  if (typeof isVip === 'boolean') {
    data.isVip = isVip
    if (!isVip) data.vipExpiresAt = null
  }

  if (vipExpiresAt !== undefined) {
    data.vipExpiresAt = vipExpiresAt ? new Date(vipExpiresAt) : null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  if (role === 'STUDENT') {
      await (prisma.student as any).update({ where: { id }, data })
  } else {
    await (prisma.teacher as any).update({ where: { id }, data })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE — hard delete user ─────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const id   = searchParams.get('id')
  const role = searchParams.get('role')

  if (!id || !role || !['TEACHER', 'STUDENT'].includes(role)) {
    return NextResponse.json({ error: 'id and valid role required' }, { status: 400 })
  }

  if (role === 'STUDENT') {
    await prisma.student.delete({ where: { id } })
  } else {
    await prisma.teacher.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
