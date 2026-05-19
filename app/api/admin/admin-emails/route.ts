import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const emails = await prisma.adminEmail.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ emails })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  try {
    const created = await prisma.adminEmail.create({ data: { email: email.trim().toLowerCase() } })
    return NextResponse.json({ email: created })
  } catch {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // prevent removing the last admin
  const count = await prisma.adminEmail.count()
  if (count <= 1) return NextResponse.json({ error: 'Cannot remove last admin' }, { status: 400 })
  await prisma.adminEmail.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
