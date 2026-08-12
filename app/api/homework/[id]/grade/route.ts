import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'

async function filesToBase64(form: FormData, field: string): Promise<string[]> {
  const entries = form.getAll(field)
  const results: string[] = []
  for (const entry of entries) {
    if (!(entry instanceof File) || entry.size === 0) continue
    const buffer = await entry.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    results.push(`data:${entry.type};base64,${base64}`)
  }
  return results
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: assignmentId } = await params

    const existing = await prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      include: { homework: { select: { teacherId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.homework.teacherId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await req.formData()
    const gradeRaw = form.get('grade')
    const grade = gradeRaw !== null ? parseInt(String(gradeRaw), 10) : null
    if (grade === null || isNaN(grade) || grade < 1 || grade > 10) {
      return NextResponse.json({ error: 'Grade must be 1-10' }, { status: 400 })
    }
    const gradeComment = form.get('comment') as string | null
    const newPhotos = await filesToBase64(form, 'photos')
    const clearPhotos = form.get('clearPhotos') === '1'
    const gradePhotos = clearPhotos ? newPhotos : [...(existing.gradePhotos ?? []), ...newPhotos]

    const updated = await prisma.homeworkAssignment.update({
      where: { id: assignmentId },
      data: {
        grade,
        gradeComment: gradeComment?.trim() || null,
        gradePhotos,
        reviewedAt: new Date(),
        status: 'REVIEWED',
      },
    })

    return NextResponse.json({ assignment: updated })
  } catch (e) {
    console.error('[PATCH /api/homework/[id]/grade]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
