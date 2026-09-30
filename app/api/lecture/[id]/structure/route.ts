import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { requireOwnLecture } from '@/shared/lib/lecture/access'
import { cleanTranscript, COMPRESSIONS, structureTranscript, type Compression } from '@/shared/lib/lecture/ai'
import { markdownToBlocks } from '@/shared/lib/lecture/markdownToDoc'
import { contextPrompt, mergeContext, parseContext } from '@/shared/lib/lecture/context'
import type { Prisma } from '@prisma/client'

export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/lecture/[id]/structure — {fromSeq, toSeq, previousNotes, compression?: none|medium|strong, markEmpty?, sections?: string[]} →
// {blocks, continues: index into `sections` | null, …}. `continues` is set only when the AI is sure the
// fragment merely adds to that earlier section (the client then puts it right after it).
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
    if (!Number.isInteger(fromSeq) || !Number.isInteger(toSeq) || fromSeq < 0 || toSeq < fromSeq || toSeq - fromSeq > 60) {
      return NextResponse.json({ error: 'fromSeq/toSeq invalid' }, { status: 400 })
    }
    const previousNotes = typeof body.previousNotes === 'string' ? body.previousNotes.slice(-3000) : ''
    const compression: Compression = COMPRESSIONS.includes(body.compression) ? body.compression : 'none'
    // Titles of the notes' sections (doc order) — the AI may say the fragment only adds to one of them.
    const sections: string[] = Array.isArray(body.sections) ? body.sections.filter((x: unknown): x is string => typeof x === 'string').slice(0, 60).map((x: string) => x.slice(0, 120)) : []
    // The client gives up on an empty range (forced run / full batch) — remember it, so it isn't offered after a reload.
    const markEmpty = body.markEmpty === true
    const giveUp = () => markEmpty
      ? prisma.lectureChunk.updateMany({ where: { lectureId: id, seq: { gte: fromSeq, lte: toSeq } }, data: { noContent: true } })
      : null

    const chunks = await prisma.lectureChunk.findMany({
      where: { lectureId: id, seq: { gte: fromSeq, lte: toSeq } },
      orderBy: { seq: 'asc' },
      select: { draftText: true, finalText: true },
    })
    const transcript = chunks.map(c => c.finalText ?? c.draftText).join(' ').trim()
    const isFinal = chunks.every(c => c.finalText !== null)
    if (!transcript) { await giveUp(); return NextResponse.json({ blocks: [], markdown: '', empty: true, isFinal }) }

    const current = parseContext(lecture.context)
    const ctx = contextPrompt(current, lecture.title)
    // Pass 1 — restore what the teacher said (misheard words, junk out); pass 2 — notes.
    const cleaned = await cleanTranscript({ lectureId: id, context: ctx, transcript })
    if (!cleaned) { await giveUp(); return NextResponse.json({ blocks: [], markdown: '', cleaned, empty: true, isFinal }) }
    const { markdown, context: aiContext, continues } = await structureTranscript({ lectureId: id, context: ctx, previousNotes, transcript: cleaned, compression, sections })
    const context = aiContext ? mergeContext(current, aiContext) : current
    const blocks = markdownToBlocks(markdown)
    // An empty result doesn't advance processedSeq: the range stays available to the next attempt.
    await prisma.lectureNote.update({
      where: { id },
      data: { ...(blocks.length && lecture.processedSeq < toSeq ? { processedSeq: toSeq } : {}), context: context as unknown as Prisma.InputJsonValue },
    })
    if (!blocks.length) await giveUp()
    return NextResponse.json({ blocks, markdown, cleaned, context, empty: !blocks.length, isFinal, continues })
  } catch (e) {
    console.error('[POST /api/lecture/[id]/structure]', e)
    return NextResponse.json({ error: 'AI_FAILED' }, { status: 502 })
  }
}
