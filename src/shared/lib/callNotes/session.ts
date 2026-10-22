import type { LectureNote, LectureStatus, Prisma, VideoCallRoom } from '@prisma/client'
import { createHash } from 'crypto'
import { after } from 'next/server'
import { prisma } from '@/shared/prisma/prisma'
import { hasAIProvider, type VisionImage } from '@/lib/openrouter'
import { MAX_FOLDER_DEPTH } from '@/shared/lib/tutorFiles/constants'
import { cleanTranscript, structureTranscript } from '@/shared/lib/lecture/ai'
import { contextPrompt, mergeContext, parseContext, type LectureContext } from '@/shared/lib/lecture/context'
import { markdownToBlocks, type PMNode } from '@/shared/lib/lecture/markdownToDoc'
import { saveDoc } from '@/shared/lib/lecture/share'
import { lectureToDocx } from '@/shared/lib/lecture/docx'
import { studentSubjectFolder, subjectFolderName, tutorSubjectFolder } from '@/shared/lib/lecture/subjects'
import { CALL_NOTES_FOLDER, ensureTutorRootFolder, fileName, saveLectureDocx } from '@/shared/lib/lecture/saveToFiles'
import type { LectureUser } from '@/shared/lib/lecture/access'
import { DriveError, ensureLecturesFolder } from '@/shared/lib/studentDrive/drive'
import { createNotification, NOTIFICATION_TYPES } from '@/shared/lib/notifications'
import { appendSection, applyBoardItems, applyTidy, asDoc, docTail, flatBlocks, newSectionsBlocks, sectionTitles, type Doc } from './docOps'
import { chooseFolder, LESSON_NOTE, nameNote, readBoard, tidySections } from './ai'
import { errorsFor } from './errorsSection'

// Video-call auto-notes. The room owner's client ticks once a minute (new lines +
// board tiles) into the master notes — a LectureNote with callRoomId, owned by the
// room owner. When the lesson ends, the finale names it and files a copy for every
// participant. No chunks, recordedMs 0 → the lecture tariff prices it at 0.

interface Person { id: string; role: 'STUDENT' | 'TEACHER' }

/** Every N ticks the new sections get a junk pass. */
const TIDY_EVERY = 3
/** How often the notes are quietly filed into everyone's storage during the call (spec A7). */
const SAVE_EVERY_MS = 10 * 60_000
/** Fingerprint of a doc — `savedHash` says whether the notes changed since the last quiet save. */
const docHash = (doc: Doc) => createHash('sha1').update(JSON.stringify(doc)).digest('hex')
/** Ten minutes since the last quiet save (or the start) and the notes changed since it. */
const saveDue = (m: Pick<LectureNote, 'savedAt' | 'savedHash' | 'createdAt'>, doc: Doc) =>
  Date.now() - (m.savedAt ?? m.createdAt).getTime() >= SAVE_EVERY_MS && docHash(doc) !== m.savedHash

const asRole = (role: string | null): Person['role'] | null => (role === 'STUDENT' ? 'STUDENT' : role === 'TEACHER' || role === 'ADMIN' ? 'TEACHER' : null)
const roomOwner = (room: VideoCallRoom): Person => ({ id: room.ownerId, role: asRole(room.ownerRole) ?? 'TEACHER' })
const masterKey = (room: VideoCallRoom, p: Person) => ({ callRoomId_ownerId_ownerRole: { callRoomId: room.id, ownerId: p.id, ownerRole: p.role } })

/** The room by name, if `user` is its owner (ADMIN = TEACHER) — the one check of the tick and the finish route. */
export async function ownedRoom(roomName: string, user: LectureUser): Promise<VideoCallRoom | 'NOT_FOUND' | 'FORBIDDEN'> {
  const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
  if (!room) return 'NOT_FOUND'
  const owner = roomOwner(room)
  return owner.id === user.id && owner.role === user.role ? room : 'FORBIDDEN'
}

// The tick running for a room right now — the finale waits for it before taking the notes.
// ponytail: one Node process; with several instances this needs a flag in the DB.
const inFlight = new Map<string, Promise<unknown>>()
const TICK_WAIT_MS = 60_000
// The quiet mid-call save running for a room — the finale waits for it (same process, see above).
const saving = new Map<string, Promise<void>>()

async function categoryName(categoryId: string | null): Promise<string> {
  if (!categoryId) return ''
  const rows = await prisma.categoryTranslation.findMany({ where: { categoryId }, select: { langCode: true, name: true } })
  return (rows.find(r => r.langCode === 'ru') ?? rows[0])?.name ?? ''
}

/**
 * The lecture context block + "this is a two-sided lesson". No title: the master's is the
 * AI's own early name (first quiet save) — fed back it would stick to the final one.
 */
const promptOf = (ctx: LectureContext, note: Pick<LectureNote, 'language'>) =>
  [contextPrompt(ctx, '', note.language), LESSON_NOTE].filter(Boolean).join('\n')

/** Made on the first tick that has something in it — an empty lesson leaves nothing behind. */
async function ensureMaster(room: VideoCallRoom, owner: Person): Promise<LectureNote> {
  const subject = await categoryName(room.categoryId)
  // The room name is the default topic and often a random slug — not worth telling the AI.
  const topic = room.topic && room.topic !== room.name ? room.topic : ''
  const context: LectureContext = { subject, topic, subtopics: [], terms: [], pinned: subject ? ['subject'] : [] }
  return prisma.lectureNote.upsert({
    where: masterKey(room, owner),
    create: { ownerId: owner.id, ownerRole: owner.role, title: '', callRoomId: room.id, context: context as unknown as Prisma.InputJsonValue },
    update: {},
  })
}

export type TickResult = {
  ok: boolean
  reason?: 'NOT_FOUND' | 'FORBIDDEN' | 'NO_AI'
  board?: 'failed'
  /** When the master exists and this tick saved it: for the owner's status line and the `call_notes_updated` signal. */
  docVersion?: number
  sections?: number
  savedAt?: string | null
  /** Present (true) only when this tick ran the junk pass over the new sections. */
  tidied?: true
}

/**
 * One tick: new transcript lines → a section (lecture pipeline), board tiles → added /
 * continued / fixed blocks, every TIDY_EVERY ticks → junk out of the new sections.
 * Throws when the AI fails or a save conflicts while recording (the route answers 502,
 * the client resends). `board: 'failed'` — text kept, the client resends the board.
 */
export async function callNotesTick(opts: { user: LectureUser; roomName: string; transcript: string; photos: VisionImage[] }): Promise<TickResult> {
  const run = tick(opts)
  inFlight.set(opts.roomName, run)
  try {
    return await run
  } finally {
    if (inFlight.get(opts.roomName) === run) inFlight.delete(opts.roomName)
  }
}

async function tick(opts: { user: LectureUser; roomName: string; transcript: string; photos: VisionImage[] }): Promise<TickResult> {
  const room = await ownedRoom(opts.roomName, opts.user)
  if (typeof room === 'string') return { ok: false, reason: room }
  if (!hasAIProvider()) return { ok: false, reason: 'NO_AI' }
  const transcript = opts.transcript.trim()
  if (!transcript && !opts.photos.length) return { ok: true }

  const owner = roomOwner(room)
  // A closed room's finale already ran — don't start a master nobody will file.
  const master = room.endedAt ? await prisma.lectureNote.findUnique({ where: masterKey(room, owner) }) : await ensureMaster(room, owner)
  if (!master || master.status !== 'RECORDING') {
    console.warn('[callNotes] tick for a finished lesson dropped', opts.roomName, master?.status ?? 'no notes')
    return { ok: true }
  }
  const lectureId = master.id
  // The section number is the server's own, so a reloaded owner tab can't reuse old ones.
  const seq = Math.max(master.processedSeq, master.tidiedSeq) + 1
  let context = parseContext(master.context)
  let doc: Doc = asDoc(master.docJson)

  if (transcript) {
    const cleaned = await cleanTranscript({ lectureId, context: promptOf(context, master), transcript })
    if (cleaned) {
      const res = await structureTranscript({ lectureId, context: promptOf(context, master), previousNotes: docTail(doc, 1500), transcript: cleaned, sections: sectionTitles(doc) })
      doc = appendSection(doc, markdownToBlocks(res.markdown), seq, res.continues)
      if (res.context) context = mergeContext(context, res.context)
    }
  }

  let board: 'failed' | undefined
  if (opts.photos.length) {
    try {
      const items = await readBoard({ lectureId, lecture: promptOf(context, master), outline: flatBlocks(doc).map(b => b.text), photos: opts.photos })
      doc = applyBoardItems(doc, items, seq)
    } catch (e) {
      // Board alone → 502. With text: the text is saved, the client resends the board.
      if (!transcript) throw e
      console.error('[callNotes] board read failed', opts.roomName, e)
      board = 'failed'
    }
  }

  let tidiedSeq = master.tidiedSeq
  if (seq - tidiedSeq >= TIDY_EVERY) {
    try {
      doc = applyTidy(doc, tidiedSeq, await tidySections({ lectureId, context: promptOf(context, master), blocks: newSectionsBlocks(doc, tidiedSeq) }))
      tidiedSeq = seq
    } catch (e) {
      console.error('[callNotes] tidy failed — next tick retries', opts.roomName, e)
    }
  }

  const saved = await saveDoc(lectureId, doc as unknown as Prisma.InputJsonValue, master.docVersion, { context: context as unknown as Prisma.InputJsonValue, tidiedSeq, processedSeq: seq })
  if (!saved.ok) {
    const now = await prisma.lectureNote.findUnique({ where: { id: lectureId }, select: { status: true } })
    if (now?.status === 'RECORDING') throw new Error('call notes: save conflict while recording')
    console.warn('[callNotes] tick lost to the finale', opts.roomName)
    return board ? { ok: true, board } : { ok: true }
  }
  // Ten minutes since the last quiet save (or the start) and the notes changed since it → file them again, after the response.
  const due = saveDue(master, doc)
  if (due) {
    const save = () => checkpoint(room, lectureId)
    try { after(save) } catch { void save() }
  }
  const info = {
    docVersion: saved.docVersion,
    sections: sectionTitles(doc).length,
    // A save just started → no time yet (the client keeps the last one); the next tick reports it.
    ...(!due && { savedAt: master.savedAt?.toISOString() ?? null }),
    ...(tidiedSeq !== master.tidiedSeq && { tidied: true as const }),
  }
  return board ? { ok: true, board, ...info } : { ok: true, ...info }
}

/**
 * Quiet mid-call save: the same filing as the finale, without the bell. One at a time,
 * never once the finale took the notes (needs RECORDING; the finale waits for it).
 * `savedAt` / `savedHash` are stamped only after the filing went through.
 */
function checkpoint(room: VideoCallRoom, masterId: string): Promise<void> {
  const running = saving.get(room.name)
  if (running) return running
  const run = (async () => {
    // Re-checked under the lock: a tick that queued this before the last save stamped has nothing to do.
    const now = await prisma.lectureNote.findUnique({ where: { id: masterId }, select: { status: true, savedAt: true, savedHash: true, createdAt: true, docJson: true } })
    if (now?.status !== 'RECORDING' || !saveDue(now, asDoc(now.docJson))) return
    const filed = await fileNotes(room, masterId, false)
    if (filed) await prisma.lectureNote.updateMany({ where: { id: masterId, status: 'RECORDING' }, data: { savedAt: new Date(), savedHash: docHash(filed) } })
  })()
    .catch(e => console.error('[callNotes] quiet save failed', room.name, e))
    .finally(() => saving.delete(room.name))
  saving.set(room.name, run)
  return run
}

export interface CallNotesView { id: string | null; doc: Doc | null; docVersion: number; sections: number; title: string; status: LectureStatus | null; savedAt: string | null }

/**
 * The live notes for the call panel — the owner and the participants the token route
 * recorded. Once the lesson is filed, a participant gets their own copy (theirs has only
 * their own mistakes) — `id` is the note shown (master during the call). No notes yet → `id/doc: null`.
 */
export async function readCallNotes(roomName: string, user: LectureUser): Promise<CallNotesView | 'NOT_FOUND' | 'FORBIDDEN'> {
  const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
  if (!room) return 'NOT_FOUND'
  const owner = roomOwner(room)
  const isOwner = owner.id === user.id && owner.role === user.role
  if (!isOwner) {
    const rows = await prisma.videoCallParticipant.findMany({ where: { roomId: room.id, userId: user.id }, select: { userRole: true } })
    if (!rows.some(r => asRole(r.userRole) === user.role)) return 'FORBIDDEN'
  }
  const select = { id: true, docJson: true, docVersion: true, title: true, status: true, savedAt: true } as const
  const master = await prisma.lectureNote.findUnique({ where: masterKey(room, owner), select })
  const note = master && !isOwner && master.status !== 'RECORDING' ? await prisma.lectureNote.findUnique({ where: masterKey(room, user), select }) : master
  if (!note) return { id: null, doc: null, docVersion: 0, sections: 0, title: '', status: null, savedAt: null }
  return {
    id: note.id,
    doc: note.docJson ? asDoc(note.docJson) : null,
    docVersion: note.docVersion,
    sections: sectionTitles(note.docJson).length,
    title: note.title,
    status: note.status,
    savedAt: master?.savedAt?.toISOString() ?? null,
  }
}

/**
 * End of the lesson (owner left / the empty room closed). Idempotent: only the call
 * that moves the master RECORDING → FINALIZING does the work.
 */
export async function finishCallNotes(roomName: string): Promise<void> {
  const room = await prisma.videoCallRoom.findUnique({ where: { name: roomName } })
  if (!room) return
  // A tick in flight right now is let in first (the client's last flush may still be running).
  const pending = inFlight.get(roomName)
  if (pending) await Promise.race([pending.catch(() => {}), new Promise(r => setTimeout(r, TICK_WAIT_MS))])
  const master = await prisma.lectureNote.findUnique({ where: masterKey(room, roomOwner(room)), select: { id: true } })
  if (!master) return
  // The version bump makes a tick still in flight lose its save (saveDoc baseVersion).
  const { count } = await prisma.lectureNote.updateMany({ where: { id: master.id, status: 'RECORDING' }, data: { status: 'FINALIZING', docVersion: { increment: 1 } } })
  if (!count) return
  // A quiet save still filing copies finishes first — the finale then replaces those files in place.
  await saving.get(roomName)
  // ponytail: no retry — an after() killed mid-way leaves the master FINALIZING, a failed
  // finalize() still marks it READY without copies; add a sweeper/retry if that shows up.
  try {
    await fileNotes(room, master.id, true)
  } catch (e) {
    console.error('[callNotes] finale failed', roomName, e)
  } finally {
    await prisma.lectureNote.updateMany({ where: { id: master.id }, data: { status: 'READY' } })
  }
}

/**
 * Names the notes and files a copy (+ .docx) for everyone on the call. `final` — the
 * finale: last tidy, the master gets its title, every copy its «Ошибки и поправки», and
 * the bell rings. Otherwise a quiet mid-call save: the master isn't touched, no bell.
 */
async function fileNotes(room: VideoCallRoom, masterId: string, final: boolean): Promise<Doc | null> {
  const master = await prisma.lectureNote.findUniqueOrThrow({ where: { id: masterId } })
  let doc = asDoc(master.docJson)
  if (!doc.content.length) { if (final) await prisma.lectureNote.delete({ where: { id: masterId } }); return null }
  const context = parseContext(master.context)
  const prompt = promptOf(context, master)
  const ai = hasAIProvider()

  if (final && ai) {
    try {
      doc = applyTidy(doc, master.tidiedSeq, await tidySections({ lectureId: masterId, context: prompt, blocks: newSectionsBlocks(doc, master.tidiedSeq) }))
    } catch (e) {
      console.error('[callNotes] last tidy failed', room.name, e)
    }
  }

  const subject = (await categoryName(room.categoryId)) || context.subject
  const date = room.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  // Named once by the first quiet save (kept on the master), named again by the finale.
  const kept = final || !master.title ? '' : master.title
  const title = kept || (ai ? await nameNote({ context: prompt, transcriptHead: flatBlocks(doc).map(b => b.text).join('\n') }) : '') || `${subjectFolderName(subject || context.topic) || 'Урок'} — ${date}`

  // Everyone who was on the call: the owner + participants the token route recorded.
  const owner = roomOwner(room)
  const isOwner = (p: Person) => p.id === owner.id && p.role === owner.role
  const rows = await prisma.videoCallParticipant.findMany({ where: { roomId: room.id, userId: { not: null } }, select: { userId: true, userRole: true } })
  const people = new Map<string, Person>([[`${owner.role}:${owner.id}`, owner]])
  for (const r of rows) {
    const role = asRole(r.userRole)
    if (r.userId && role) people.set(`${role}:${r.userId}`, { id: r.userId, role })
  }
  const named = await Promise.all([...people.values()].map(async p => ({ ...p, name: await personName(p) })))
  const teacherName = named.find(p => p.role === 'TEACHER')?.name ?? ''
  const studentName = named.filter(p => p.role === 'STUDENT').map(p => p.name).join(', ')

  // The finale's last section: the call's mistakes (after the tutor confirmed them) — a
  // student their own, the owner / a tutor everyone's by student. None → no section.
  const errors = final
    ? (await prisma.studentError.findMany({
        where: { sourceType: 'video_call', sourceId: room.name },
        orderBy: { createdAt: 'asc' },
        select: { studentId: true, description: true, fragment: true, isCorrection: true, student: { select: { name: true } } },
      })).map(e => ({ ...e, studentName: e.student.name }))
    : []
  const seq = Math.max(master.processedSeq, master.tidiedSeq) + 1
  const docOf = (p: Person): Doc => {
    const md = errorsFor(errors, p)
    return md ? appendSection(doc, markdownToBlocks(md), seq, null) : doc
  }
  if (final) await prisma.lectureNote.update({ where: { id: masterId }, data: { title, docJson: docOf(owner) as unknown as Prisma.InputJsonValue, docVersion: { increment: 1 } } })
  // Title only — the doc stays the ticks' (no version bump, no clash with their saves).
  else if (title !== master.title) await prisma.lectureNote.update({ where: { id: masterId }, data: { title } })

  const name = fileName(title, room.createdAt)
  const lesson = { subject, topic: context.topic, teacherName, studentName, studentIds: named.filter(p => p.role === 'STUDENT').map(p => p.id) }

  // Everyone at once (folder AI + upload each), so a lesson with several students fits in
  // the route's maxDuration; one person failing doesn't stop the others.
  const results = await Promise.allSettled(named.map(async person => {
    const personDoc = docOf(person)
    const docJson = personDoc as unknown as Prisma.InputJsonValue
    // ponytail: each save overwrites the copy — edits a participant makes to it during the
    // call are lost; keep them (merge / skip `edited` copies) if people start doing that.
    const note = isOwner(person)
      ? { id: masterId, fileId: master.fileId }
      : await prisma.lectureNote.upsert({
          where: masterKey(room, person),
          create: { ownerId: person.id, ownerRole: person.role, callRoomId: room.id, title, docJson, context: master.context ?? undefined, language: master.language, tidiedSeq: master.tidiedSeq, status: 'READY' },
          update: { title, docJson, docVersion: { increment: 1 } },
        })
    // ponytail: board/graph blocks from the AI have no snapshot yet, so this .docx lacks them;
    // they appear only after the notes are opened in the editor and saved to files FROM THERE (the
    // profile button runs export before the editor opens, so it adds no snapshots).
    const bytes = await lectureToDocx(personDoc as PMNode, title, teacherName || named[0].name, new Map())
    return fileCopy(person, note, bytes, name, title, lesson, final)
  }))
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[callNotes] copy failed', room.name, named[i].role, named[i].id, r.reason)
  })
  // Null when no copy reached anyone's storage — the quiet save then isn't stamped.
  return results.some(r => r.status === 'fulfilled' && r.value) ? doc : null
}

async function personName(p: Person): Promise<string> {
  const row = p.role === 'STUDENT'
    ? await prisma.student.findUnique({ where: { id: p.id }, select: { name: true } })
    : await prisma.teacher.findUnique({ where: { id: p.id }, select: { name: true } })
  return row?.name ?? ''
}

interface Lesson { subject: string; topic: string; teacherName: string; studentName: string; studentIds: string[] }

/**
 * The .docx into the folder picked for this person (once — a file already saved is
 * replaced where it lies), then the bell if `bell`. Out of space → the bell points at the editor.
 * True when the file reached storage.
 */
async function fileCopy(person: Person, note: { id: string; fileId: string | null }, bytes: Buffer, name: string, title: string, lesson: Lesson, bell: boolean): Promise<boolean> {
  let stored = false
  const notify = async (ru: [string, string], en: [string, string], folderId: string | null, href: string) => {
    if (!bell) return
    await createNotification({
      type: NOTIFICATION_TYPES.CALL_NOTES_SAVED,
      title: ru[0], body: ru[1],
      titleTranslations: { en: en[0] }, bodyTranslations: { en: en[1] },
      payload: { lectureNoteId: note.id, folderId, href },
      ...(person.role === 'STUDENT' ? { studentId: person.id } : { teacherId: person.id }),
    })
  }
  try {
    const filed = !note.fileId ? null : person.role === 'STUDENT'
      ? await prisma.studentFile.findFirst({ where: { id: note.fileId, studentId: person.id }, select: { folderId: true } })
      : await prisma.tutorFile.findFirst({ where: { id: note.fileId, teacherId: person.id }, select: { folderId: true } })
    // Filed by an earlier save → saveLectureDocx replaces that file and ignores the folder.
    const folderId = filed ? (filed.folderId ?? '') : await pickFolder(person, lesson)
    const saved = await saveLectureDocx({ lecture: note, ownerId: person.id, role: person.role, folderId, bytes, name })
    // Replaced in place keeps the old name — the finale's title renames it.
    if (!saved.created && saved.name !== name) {
      const where = { id: saved.fileId }
      await (person.role === 'STUDENT' ? prisma.studentFile.update({ where, data: { name } }) : prisma.tutorFile.update({ where, data: { name } }))
    }
    stored = true
    const path = saved.folderId ? await folderPath(person, saved.folderId) : ''
    const q = saved.folderId ? `folder=${saved.folderId}` : ''
    const href = person.role === 'STUDENT' ? `/files?tab=mine${q ? `&${q}` : ''}` : `/files${q ? `?${q}` : ''}`
    await notify(['Конспект урока сохранён', `«${title}» — в папке «${path || 'Мои файлы'}»`], ['Lesson notes saved', `"${title}" — in the folder "${path || 'My files'}"`], saved.folderId, href)
  } catch (e) {
    const noSpace = e instanceof DriveError && e.code === 'QUOTA_EXCEEDED'
    const shared = e instanceof SharedRootError
    if (!noSpace && !shared) console.error('[callNotes] saving to files failed', person.role, person.id, e)
    const why = noSpace ? ['не хватило места в хранилище', 'not enough storage space']
      : shared ? [`папка «${CALL_NOTES_FOLDER}» открыта другим ученикам`, `the "${CALL_NOTES_FOLDER}" folder is shared with other students`]
      : ['не удалось сохранить в файлы', 'could not save to files']
    await notify(['Конспект урока готов', `«${title}»: ${why[0]} — конспект открыт в редакторе`], ['Lesson notes are ready', `"${title}": ${why[1]} — the notes are in the editor`], null, `/lecture/${note.id}`)
  }
  return stored
}

/**
 * The AI picks the folder per person. Student: any of their folders or a new path.
 * Tutor: only inside «Конспекты уроков» (library folders may be open to students).
 * No AI / nothing usable → «Конспекты уроков/<Предмет>».
 */
async function pickFolder(person: Person, lesson: Lesson): Promise<string> {
  const ai = hasAIProvider()
  const ask = { subject: lesson.subject, topic: lesson.topic, teacherName: lesson.teacherName }
  if (person.role === 'STUDENT') {
    if (ai) {
      const rows = await prisma.studentFolder.findMany({ where: { studentId: person.id }, select: { id: true, name: true, ancestorIds: true }, take: 500 })
      const pick = await chooseFolder({ role: 'STUDENT', ...ask, folders: withPaths(rows) })
      const id = pick.folderId ?? (await ensurePath(person, null, [], pick.newPath))
      if (id) return id
    }
    return studentSubjectFolder(person.id, await ensureLecturesFolder(person.id, CALL_NOTES_FOLDER), lesson.subject)
  }
  const root = await ensureTutorRootFolder(person.id, CALL_NOTES_FOLDER)
  // Never a folder shared with / pinned to a student who wasn't on this lesson.
  const blocked = (id: string) => sharedElsewhere(person.id, id, lesson.studentIds)
  // The root itself is open to someone else's student → no folders, no file at all (the copy stays in the editor).
  // Checked before any subfolder is made; a freshly made root has no grants, so it passes.
  if (await blocked(root)) throw new SharedRootError()
  let id: string | null = null
  if (ai) {
    const rows = await prisma.tutorFolder.findMany({ where: { teacherId: person.id, OR: [{ id: root }, { ancestorIds: { has: root } }] }, select: { id: true, name: true, ancestorIds: true }, take: 500 })
    const bad = await badFolderIds(rows.map(r => r.id), lesson.studentIds)
    const open = rows.filter(r => ![r.id, ...r.ancestorIds].some(a => bad.has(a)))
    const rule = `Можно только папки внутри «${CALL_NOTES_FOLDER}»; newPath — путь внутри неё.`
    const pick = await chooseFolder({ role: 'TEACHER', ...ask, studentName: lesson.studentName || undefined, folders: withPaths(open), rule })
    const inside = pick.newPath[0]?.trim().toLocaleLowerCase('ru') === CALL_NOTES_FOLDER.toLocaleLowerCase('ru') ? pick.newPath.slice(1) : pick.newPath
    id = pick.folderId ?? (await ensurePath(person, root, [root], inside, blocked))
  }
  id ??= await tutorSubjectFolder(person.id, root, lesson.subject)
  if (!(await blocked(id))) return id
  return root
}

/** The tutor's «Конспекты уроков» is shared with a student who wasn't on the lesson. */
class SharedRootError extends Error {}

/** Of `ids`, the folders granted to or restricted to a student outside `students`. */
async function badFolderIds(ids: string[], students: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const [restricted, grants] = await Promise.all([
    prisma.tutorFolder.findMany({ where: { id: { in: ids }, restrictedToStudentId: { not: null, notIn: students } }, select: { id: true } }),
    prisma.tutorFolderGrant.findMany({ where: { folderId: { in: ids }, studentId: { notIn: students } }, select: { folderId: true } }),
  ])
  return new Set([...restricted.map(f => f.id), ...grants.map(g => g.folderId)])
}

/** The folder or one of its ancestors is open to / pinned on someone else's student. */
async function sharedElsewhere(teacherId: string, folderId: string, students: string[]): Promise<boolean> {
  const folder = await prisma.tutorFolder.findFirst({ where: { id: folderId, teacherId }, select: { ancestorIds: true } })
  if (!folder) return true
  return (await badFolderIds([folderId, ...folder.ancestorIds], students)).size > 0
}

function withPaths(rows: { id: string; name: string; ancestorIds: string[] }[]): { id: string; path: string }[] {
  const names = new Map(rows.map(r => [r.id, r.name]))
  return rows.map(r => ({ id: r.id, path: [...r.ancestorIds.map(a => names.get(a) ?? '…'), r.name].join(' / ') }))
}

/**
 * Walks / makes `names` under `parentId` (same-named folders reused unless `blocked`),
 * within MAX_FOLDER_DEPTH. Null when nothing usable.
 */
async function ensurePath(person: Person, parentId: string | null, chain: string[], names: string[], blocked?: (id: string) => Promise<boolean>): Promise<string | null> {
  let parent = parentId
  let made = false
  for (const raw of names) {
    const name = subjectFolderName(raw)
    if (!name) continue
    if (chain.length + 1 > MAX_FOLDER_DEPTH) break
    const where = { parentId: parent, name: { equals: name, mode: 'insensitive' as const } }
    const found = person.role === 'STUDENT'
      ? await prisma.studentFolder.findFirst({ where: { studentId: person.id, ...where }, select: { id: true } })
      : await prisma.tutorFolder.findFirst({ where: { teacherId: person.id, ...where }, select: { id: true } })
    if (found && blocked && (await blocked(found.id))) break
    const id = found?.id ?? (person.role === 'STUDENT'
      ? await prisma.studentFolder.create({ data: { studentId: person.id, parentId: parent, name, ancestorIds: chain } })
      : await prisma.tutorFolder.create({ data: { teacherId: person.id, parentId: parent, name, ancestorIds: chain } })).id
    parent = id
    chain = [...chain, id]
    made = true
  }
  return made ? parent : null
}

/** «Конспекты уроков / Математика» — for the notification. */
async function folderPath(person: Person, folderId: string): Promise<string> {
  const folder = person.role === 'STUDENT'
    ? await prisma.studentFolder.findUnique({ where: { id: folderId }, select: { name: true, ancestorIds: true } })
    : await prisma.tutorFolder.findUnique({ where: { id: folderId }, select: { name: true, ancestorIds: true } })
  if (!folder) return ''
  const up = person.role === 'STUDENT'
    ? await prisma.studentFolder.findMany({ where: { id: { in: folder.ancestorIds } }, select: { id: true, name: true } })
    : await prisma.tutorFolder.findMany({ where: { id: { in: folder.ancestorIds } }, select: { id: true, name: true } })
  const names = new Map(up.map(f => [f.id, f.name]))
  return [...folder.ancestorIds.map(a => names.get(a) ?? ''), folder.name].filter(Boolean).join(' / ')
}
