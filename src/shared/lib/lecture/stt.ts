// Client for stt-server/ (faster-whisper over HTTP). LECTURE_STT_URL points
// at it (Railway private network in prod); STT_API_KEY is shared with it.

export interface SttSegment {
  start: number
  end: number
  text: string
  avgLogprob: number
  noSpeechProb: number
}

export interface SttResult {
  text: string
  segments: SttSegment[]
  durationMs: number
}

export class SttBusyError extends Error {
  constructor() {
    super('STT_BUSY')
    this.name = 'SttBusyError'
  }
}

export function isSttConfigured(): boolean {
  return !!process.env.LECTURE_STT_URL
}

/** A lecture's speech language: Whisper gets it as is, 'auto' = detect per chunk (mixed lectures). */
export type LectureLanguage = 'ru' | 'en' | 'auto'
export const LECTURE_LANGUAGES: LectureLanguage[] = ['ru', 'en', 'auto']
export const asLectureLanguage = (v: unknown): LectureLanguage => (LECTURE_LANGUAGES as unknown[]).includes(v) ? (v as LectureLanguage) : 'ru'

export async function transcribe(audio: Buffer, mime: string, quality: 'draft' | 'final', prompt: string, language: LectureLanguage = 'ru'): Promise<SttResult> {
  const base = process.env.LECTURE_STT_URL
  if (!base) throw new Error('LECTURE_STT_URL is not set')
  const form = new FormData()
  const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), `chunk.${ext}`)
  form.append('quality', quality)
  form.append('prompt', prompt.slice(-400))
  form.append('language', language)
  const res = await fetch(`${base.replace(/\/$/, '')}/transcribe`, {
    method: 'POST',
    headers: { 'X-STT-Key': process.env.STT_API_KEY ?? '' },
    body: form,
    // The big model on CPU can take a while for one chunk under load.
    signal: AbortSignal.timeout(quality === 'final' ? 300_000 : 90_000),
  })
  if (res.status === 429) throw new SttBusyError()
  if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json() as Promise<SttResult>
}

/**
 * The draft as DeepSeek sees it: segments Whisper itself was unsure about
 * are wrapped in ⟨?…⟩ so the model can drop them if they don't fit the
 * lecture (chatter, noise) — lenient STT, strict DeepSeek.
 */
export function markDoubtful(result: SttResult): string {
  if (!result.segments.length) return result.text
  return result.segments
    .map(s => (s.noSpeechProb > 0.5 || s.avgLogprob < -1 ? `⟨?${s.text}⟩` : s.text))
    .join(' ')
    .trim()
}

/** All chunks → one .m4a (stt-server decodes each standalone chunk and re-encodes). */
export async function concatAudio(parts: { bytes: Buffer; mime: string }[]): Promise<Buffer> {
  const base = process.env.LECTURE_STT_URL
  if (!base) throw new Error('LECTURE_STT_URL is not set')
  const form = new FormData()
  parts.forEach((p, i) => form.append('files', new Blob([new Uint8Array(p.bytes)], { type: p.mime }), `${i}.${p.mime.includes('mp4') ? 'm4a' : 'webm'}`))
  const res = await fetch(`${base.replace(/\/$/, '')}/concat`, {
    method: 'POST',
    headers: { 'X-STT-Key': process.env.STT_API_KEY ?? '' },
    body: form,
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) throw new Error(`STT concat ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
