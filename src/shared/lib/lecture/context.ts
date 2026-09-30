// Lecture context: what the lecture is about. Prisma-free — the page imports the type too.

export interface LectureContext {
  subject: string
  topic: string
  subtopics: string[]
  /** Key terms and notation used in this lecture (helps STT and reading unclear formulas). */
  terms: string[]
  /** Fields the student set by hand — the AI never overwrites these. */
  pinned: ('subject' | 'topic' | 'subtopics')[]
}

export const EMPTY_CONTEXT: LectureContext = { subject: '', topic: '', subtopics: [], terms: [], pinned: [] }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const list = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? [...new Set(v.map(x => str(x, max)).filter(Boolean))].slice(0, n) : []

export function parseContext(raw: unknown): LectureContext {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pinned = list(o.pinned, 3, 20).filter((p): p is LectureContext['pinned'][number] => p === 'subject' || p === 'topic' || p === 'subtopics')
  return { subject: str(o.subject, 80), topic: str(o.topic, 160), subtopics: list(o.subtopics, 12, 120), terms: list(o.terms, 30, 80), pinned }
}

/**
 * The AI's updated context merged into the current one: pinned fields stay
 * as the student set them; subtopics and terms only grow (a later chunk
 * can't erase what an earlier part of the lecture covered).
 */
export function mergeContext(current: LectureContext, incoming: unknown): LectureContext {
  const next = parseContext(incoming)
  const keep = (k: 'subject' | 'topic' | 'subtopics') => current.pinned.includes(k)
  return {
    subject: keep('subject') ? current.subject : next.subject || current.subject,
    topic: keep('topic') ? current.topic : next.topic || current.topic,
    subtopics: keep('subtopics') ? current.subtopics : [...new Set([...current.subtopics, ...next.subtopics])].slice(0, 12),
    terms: [...new Set([...current.terms, ...next.terms])].slice(-30),
    pinned: current.pinned,
  }
}

/** The context as a prompt block (empty string when nothing is known yet). */
// What the AI is told about the lecture's language (the student picks it on the page).
const LANGUAGE_NOTE: Record<string, string> = {
  en: 'Язык лекции: английский. Расшифровка — английская речь: исправляй её как английскую и пиши конспект на английском.',
  auto: 'Язык лекции: смешанный (например, пара иностранного языка: преподаватель говорит и на иностранном, и по-русски). Каждую фразу понимай на том языке, на котором она сказана. Лексику, примеры, фразы, правила и цитаты на изучаемом языке оставляй на нём, не переводи; пояснения пиши на том языке, на котором объяснял преподаватель.',
}

export function contextPrompt(ctx: LectureContext, title: string, language?: string): string {
  const lines = [
    language && LANGUAGE_NOTE[language],
    title && `Название лекции (дал студент): ${title}`,
    ctx.subject && `Предмет: ${ctx.subject}`,
    ctx.topic && `Тема: ${ctx.topic}`,
    ctx.subtopics.length ? `Подтемы, которые уже прошли: ${ctx.subtopics.join('; ')}` : '',
    ctx.terms.length ? `Термины и обозначения этой лекции: ${ctx.terms.join(', ')}` : '',
  ].filter(Boolean)
  return lines.length ? `КОНТЕКСТ ЛЕКЦИИ:\n${lines.join('\n')}` : ''
}

/** Short vocabulary hint for Whisper's initial prompt. */
export function sttHint(ctx: LectureContext, title: string): string {
  // Whisper hears words, not LaTeX — formulas in `terms` would only add noise.
  const words = ctx.terms.filter(term => !/[$\\^_{}]/.test(term))
  return [title, ctx.subject, ctx.topic, ...ctx.subtopics.slice(-3), ...words.slice(-12)].filter(Boolean).join('. ')
}
