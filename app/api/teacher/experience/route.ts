import { prisma } from '@/shared/prisma/prisma'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const experiences = await prisma.teacherExperience.findMany({
    where: { teacherId: session.user.id },
    orderBy: { yearFrom: 'desc' },
  })
  return NextResponse.json({ experiences })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { title, organization, yearFrom, yearTo, description } = body
  if (!title || !yearFrom) return NextResponse.json({ error: 'title and yearFrom required' }, { status: 400 })
  const exp = await prisma.teacherExperience.create({
    data: {
      teacherId: session.user.id,
      title,
      organization: organization ?? null,
      yearFrom: Number(yearFrom),
      yearTo: yearTo ? Number(yearTo) : null,
      description: description ?? null,
    },
  })
  return NextResponse.json({ experience: exp }, { status: 201 })
}
