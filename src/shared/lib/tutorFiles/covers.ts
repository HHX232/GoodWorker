// Folder covers — Prisma-free, shared by the API (validation) and the UI
// (rendering). A folder's `cover` is either `preset:<id>` from this list or a
// public S3 URL of an image the tutor uploaded; `null` falls back to a pastel
// picked from the folder id, so an untouched library is still colourful.

export interface CoverPreset {
  id: string
  /** Any CSS `background` value. */
  background: string
  /** Dark artwork → the card switches to light text. */
  dark: boolean
}

export const PASTEL_PRESETS: CoverPreset[] = [
  { id: 'lavender', background: 'linear-gradient(160deg, #F1EEFF 0%, #E4E0FB 100%)', dark: false },
  { id: 'sky', background: 'linear-gradient(160deg, #EAF4FF 0%, #D9E9FB 100%)', dark: false },
  { id: 'peach', background: 'linear-gradient(160deg, #FFF3E8 0%, #FBE3CC 100%)', dark: false },
  { id: 'mint', background: 'linear-gradient(160deg, #EAF8F1 0%, #D5F0E3 100%)', dark: false },
  { id: 'rose', background: 'linear-gradient(160deg, #FFEFF3 0%, #F9DDE5 100%)', dark: false },
  { id: 'sand', background: 'linear-gradient(160deg, #FBF7EC 0%, #F1E9D2 100%)', dark: false },
]

export const ART_PRESETS: CoverPreset[] = [
  { id: 'aurora', background: 'radial-gradient(120% 90% at 10% 10%, #8EF5D2 0%, transparent 55%), radial-gradient(90% 90% at 90% 20%, #9D8CFF 0%, transparent 60%), radial-gradient(100% 100% at 50% 100%, #3B2F8F 0%, #1B1745 100%)', dark: true },
  { id: 'sunset', background: 'radial-gradient(90% 80% at 20% 15%, #FFD29D 0%, transparent 60%), radial-gradient(90% 90% at 85% 30%, #FF8FA3 0%, transparent 60%), linear-gradient(180deg, #F9748F 0%, #6D3BA8 100%)', dark: true },
  { id: 'ocean', background: 'radial-gradient(80% 70% at 80% 10%, #9BE7FF 0%, transparent 60%), radial-gradient(90% 90% at 10% 90%, #1E6FD9 0%, transparent 65%), linear-gradient(160deg, #3AA0E8 0%, #0B2F6B 100%)', dark: true },
  { id: 'dusk', background: 'radial-gradient(70% 60% at 75% 20%, #FFC6E0 0%, transparent 60%), radial-gradient(90% 90% at 20% 80%, #5B4BD6 0%, transparent 65%), linear-gradient(170deg, #B08CF0 0%, #2A1F5C 100%)', dark: true },
  { id: 'meadow', background: 'radial-gradient(80% 70% at 20% 10%, #F4FFB3 0%, transparent 60%), radial-gradient(90% 90% at 90% 70%, #3CB98A 0%, transparent 65%), linear-gradient(160deg, #9ADF8F 0%, #135C4A 100%)', dark: true },
  { id: 'candy', background: 'radial-gradient(80% 80% at 15% 20%, #FFE3F1 0%, transparent 60%), radial-gradient(80% 80% at 85% 25%, #C9E4FF 0%, transparent 60%), radial-gradient(90% 90% at 50% 100%, #E7D6FF 0%, #F5EEFF 100%)', dark: false },
  { id: 'ember', background: 'radial-gradient(80% 70% at 80% 15%, #FFB36B 0%, transparent 60%), radial-gradient(90% 90% at 15% 85%, #D9412B 0%, transparent 65%), linear-gradient(160deg, #F27A3D 0%, #5A1414 100%)', dark: true },
  { id: 'graphite', background: 'radial-gradient(80% 70% at 85% 10%, #6D7390 0%, transparent 60%), linear-gradient(160deg, #3A3F55 0%, #121420 100%)', dark: true },
]

export const COVER_PRESETS: CoverPreset[] = [...PASTEL_PRESETS, ...ART_PRESETS]
const PRESET_BY_ID = new Map(COVER_PRESETS.map(p => [p.id, p]))

export const PRESET_PREFIX = 'preset:'
export const MAX_COVER_BYTES = 10 * 1024 * 1024

export type ResolvedCover =
  | { kind: 'preset'; preset: CoverPreset }
  | { kind: 'image'; url: string }

function hashIndex(id: string, n: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % n
}

/** What to paint for a folder: its chosen cover, or a stable pastel from its id. */
export function resolveCover(folderId: string, cover: string | null | undefined): ResolvedCover {
  if (cover?.startsWith(PRESET_PREFIX)) {
    const preset = PRESET_BY_ID.get(cover.slice(PRESET_PREFIX.length))
    if (preset) return { kind: 'preset', preset }
  } else if (cover) {
    return { kind: 'image', url: cover }
  }
  return { kind: 'preset', preset: PASTEL_PRESETS[hashIndex(folderId, PASTEL_PRESETS.length)] }
}

/**
 * Server-side check before storing: a known preset, or an https/http URL on
 * our own public S3 base (the value ends up inside CSS `url()`, so arbitrary
 * strings are never accepted).
 */
export function isAllowedCover(value: string, publicBase: string | undefined): boolean {
  if (value.startsWith(PRESET_PREFIX)) return PRESET_BY_ID.has(value.slice(PRESET_PREFIX.length))
  if (!publicBase) return false
  const base = publicBase.replace(/\/$/, '') + '/'
  return value.startsWith(base) && /^[\w\-./%]+$/.test(value.slice(base.length))
}
