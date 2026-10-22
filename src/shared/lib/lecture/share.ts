import { randomBytes } from 'crypto'
import type { LectureNote, Prisma } from '@prisma/client'
import { prisma } from '@/shared/prisma/prisma'

// Public links to a lecture's notes: /lecture/shared/<token>. Two kinds —
// read-only and read-write — each its own token, created and revoked by the
// owner. No login needed; the token is the permission. People on a link
// never get the AI (it's paid from the owner's lecture tariff).

export type ShareMode = 'view' | 'edit'

export const newShareToken = () => randomBytes(24).toString('base64url')

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/

/** The lecture behind a link and what it allows; null for unknown/revoked tokens. */
export async function resolveShare(token: string): Promise<{ lecture: LectureNote; mode: ShareMode } | null> {
  if (!TOKEN_RE.test(token)) return null
  const lecture = await prisma.lectureNote.findFirst({ where: { OR: [{ shareEditToken: token }, { shareViewToken: token }] } })
  if (!lecture) return null
  return { lecture, mode: lecture.shareEditToken === token ? 'edit' : 'view' }
}

export type DocSave =
  | { ok: true; docVersion: number }
  | { ok: false; docJson: unknown; docVersion: number }

/**
 * Saves the doc unless someone saved a newer one since `baseVersion` (then the
 * caller gets that one back to show instead). No base = plain overwrite.
 */
export async function saveDoc(lectureId: string, doc: Prisma.InputJsonValue, baseVersion: number | null, extra: Prisma.LectureNoteUpdateManyMutationInput = {}): Promise<DocSave> {
  const data = { ...extra, docJson: doc, docVersion: { increment: 1 } }
  if (baseVersion === null) {
    const row = await prisma.lectureNote.update({ where: { id: lectureId }, data, select: { docVersion: true } })
    return { ok: true, docVersion: row.docVersion }
  }
  const { count } = await prisma.lectureNote.updateMany({ where: { id: lectureId, docVersion: baseVersion }, data })
  const row = await prisma.lectureNote.findUnique({ where: { id: lectureId }, select: { docJson: true, docVersion: true } })
  if (count) return { ok: true, docVersion: row?.docVersion ?? baseVersion + 1 }
  return { ok: false, docJson: row?.docJson ?? null, docVersion: row?.docVersion ?? 0 }
}

/** `baseVersion` from a request body: a non-negative integer, or null (not sent). */
export const baseVersionOf = (v: unknown): number | null => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null)
