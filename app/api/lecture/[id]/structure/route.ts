import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { structureTranscript } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/structure — {fromSeq, toSeq, previousNotes} →
// {blocks} (TipTap JSON) for that transcript range. The client wraps them in
// an AI section tagged with the range; after the final pass it calls this
// again for sections the student hasn't edited, and the final text is used.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id, { write: true })
    if (guard.response) return guard.response
    const { lecture } = guard

    const body = await req.json().catch(() => ({}))
    const fromSeq = Number(body.fromSeq)
    const toSeq = Number(body.toSeq)
    if (!Number.isInteger(fromSeq) || !Number.isInteger(toSeq) || fromSeq < 0 || toSeq < fromSeq || toSeq - fromSeq > 40) {
      return NextResponse.json({ error: 'fromSeq/toSeq invalid' }, { status: 400 })
    }
    const previousNotes = typeof body.previousNotes === 'string' ? body.previousNotes.slice(-3000) : ''

    const chunks = await prisma.lectureChunk.findMany({
      where: { lectureId: id, seq: { gte: fromSeq, lte: toSeq } },
      orderBy: { seq: 'asc' },
      select: { draftText: true, finalText: true },
    })
    const transcript = chunks.map(c => c.finalText ?? c.draftText).join(' ').trim()
    if (!transcript) return NextResponse.json({ blocks: [], markdown: '', isFinal: false })

    const markdown = await structureTranscript({ lectureId: id, title: lecture.title, previousNotes, transcript })
    if (lecture.processedSeq < toSeq) await prisma.lectureNote.update({ where: { id }, data: { processedSeq: toSeq } })
    return NextResponse.json({ blocks: markdownToBlocks(markdown), markdown, isFinal: chunks.every(c => c.finalText !== null) })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/structure]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
