import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { hasLectureAccess, requireOwnLecture } from '@/shared/lib/lecture/access'
import { getLectureSettings, LECTURE_BILLING_ENABLED } from '@/shared/lib/lecture/pricing'
import { isSttConfigured } from '@/shared/lib/lecture/stt'
import type { Prisma } from '@prisma/client'

interface Params {
  params: Promise<{ id: string }>
}

const MAX_DOC_BYTES = 4 * 1024 * 1024

// GET /api/lecture/[id] — the lecture, its transcript chunks and the tariff.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const { lecture, user } = guard
    const [chunks, tariff, access] = await Promise.all([
      prisma.lectureChunk.findMany({
        where: { lectureId: id },
        orderBy: { seq: 'asc' },
        select: { seq: true, startMs: true, durationMs: true, draftText: true, finalText: true, audioKey: true, audioBytes: true, createdAt: true },
      }),
      getLectureSettings(),
      hasLectureAccess(user),
    ])
    // Replay is possible while audio is held for the final pass, or kept for good.
    const held = new Set((await prisma.lectureChunk.findMany({ where: { lectureId: id, audioData: { not: null } }, select: { seq: true } })).map(c => c.seq))
    return NextResponse.json({
      lecture,
      chunks: chunks.map(c => ({
        seq: c.seq, startMs: c.startMs, durationMs: c.durationMs,
        text: c.finalText ?? c.draftText, isFinal: c.finalText !== null,
        hasAudio: !!c.audioKey || held.has(c.seq),
      })),
      // The tariff's internals (markup, token prices, tiers) are for admins only —
      // everyone else just sees the resulting price.
      tariff: user.isAdmin ? { ...tariff, billingEnabled: LECTURE_BILLING_ENABLED } : { billingEnabled: LECTURE_BILLING_ENABLED },
      access,
      isAdmin: user.isAdmin,
      sttConfigured: isSttConfigured(),
    })
  } catch (e) {
    console.error('[GET /api/lecture/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/lecture/[id] — autosave {docJson?, title?, keepAudio?}.
// Saving your own notes stays open without VIP (only recording/AI need it).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    const text = await req.text()
    if (text.length > MAX_DOC_BYTES) return NextResponse.json({ error: 'DOC_TOO_LARGE' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const data: Prisma.LectureNoteUpdateInput = {}
    if (typeof body.title === 'string') data.title = body.title.trim().slice(0, 200)
    if (typeof body.keepAudio === 'boolean') data.keepAudio = body.keepAudio
    if (body.docJson !== undefined) {
      const doc = body.docJson as { type?: unknown } | null
      if (!doc || typeof doc !== 'object' || doc.type !== 'doc') return NextResponse.json({ error: 'docJson must be a ProseMirror doc' }, { status: 400 })
      data.docJson = doc as Prisma.InputJsonValue
    }
    const lecture = await prisma.lectureNote.update({ where: { id }, data, select: { id: true, title: true, keepAudio: true, updatedAt: true } })
    return NextResponse.json({ lecture })
  } catch (e) {
    console.error('[PATCH /api/lecture/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/lecture/[id] — the lecture and its chunks. A .docx already
// saved to files stays (it's a separate file the owner manages there).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const guard = await requireOwnLecture(id)
    if (guard.response) return guard.response
    await prisma.lectureNote.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/lecture/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
