import { NextRequest, NextResponse } from 'next/server'
import { baseVersionOf, resolveShare, saveDoc } from '@/shared/lib/lecture/share'
import type { Prisma } from '@prisma/client'

interface Params {
  params: Promise<{ token: string }>
}

const MAX_DOC_BYTES = 4 * 1024 * 1024
const noStore = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }

// GET /api/lecture/shared/[token]?since=N — a public link's notes, no login:
// {mode, title, docVersion, docJson?} (docJson only when newer than N — the
// page polls it, so a lecture being recorded fills in live).
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const share = await resolveShare((await params).token)
    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
    const { lecture, mode } = share
    const since = Number(req.nextUrl.searchParams.get('since'))
    const fresh = !(req.nextUrl.searchParams.has('since') && Number.isInteger(since) && since >= lecture.docVersion)
    return NextResponse.json(
      { mode, title: lecture.title, docVersion: lecture.docVersion, ...(fresh ? { docJson: lecture.docJson } : {}) },
      { headers: noStore },
    )
  } catch (e) {
    console.error('[GET /api/lecture/shared/[token]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/lecture/shared/[token] {docJson, baseVersion} — edit links only.
// Same versioning as the owner's autosave: 409 CONFLICT with the newer doc.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const share = await resolveShare((await params).token)
    if (!share) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (share.mode !== 'edit') return NextResponse.json({ error: 'READ_ONLY' }, { status: 403 })
    const text = await req.text()
    if (text.length > MAX_DOC_BYTES) return NextResponse.json({ error: 'DOC_TOO_LARGE' }, { status: 413 })
    let body: Record<string, unknown>
    try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const doc = body.docJson as { type?: unknown } | null
    if (!doc || typeof doc !== 'object' || doc.type !== 'doc') return NextResponse.json({ error: 'docJson must be a ProseMirror doc' }, { status: 400 })
    const base = baseVersionOf(body.baseVersion)
    if (base === null) return NextResponse.json({ error: 'baseVersion required' }, { status: 400 })
    const saved = await saveDoc(share.lecture.id, doc as Prisma.InputJsonValue, base)
    if (!saved.ok) return NextResponse.json({ error: 'CONFLICT', docJson: saved.docJson, docVersion: saved.docVersion }, { status: 409 })
    return NextResponse.json({ docVersion: saved.docVersion })
  } catch (e) {
    console.error('[PATCH /api/lecture/shared/[token]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
