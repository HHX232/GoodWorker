// Chapter markers for the lecture's .m4a, written straight into the MP4 the
// stt-server glued (no ffmpeg on the app side). Two flavours, as ffmpeg's own
// muxer does: a Nero `chpl` box in moov/udta (VLC, mpv, foobar, ffmpeg…) and a
// QuickTime chapter text track referenced by `tref/chap` from the audio track
// (Apple: QuickTime, Music/Books, iOS). The audio itself is left untouched —
// the old moov is moved to the end with its chunk offsets adjusted.

export interface AudioChapter {
  /** Offset in the audio, ms. */
  ms: number
  title: string
}

interface Box { type: string; start: number; header: number; size: number }

function boxes(buf: Buffer, from: number, to: number): Box[] {
  const out: Box[] = []
  let at = from
  while (at + 8 <= to) {
    let size = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    let header = 8
    if (size === 1) { size = Number(buf.readBigUInt64BE(at + 8)); header = 16 }
    else if (size === 0) size = to - at
    if (size < header || at + size > to) throw new Error(`bad mp4 box ${type}`)
    out.push({ type, start: at, header, size })
    at += size
  }
  return out
}

const children = (buf: Buffer, b: Box, skip = 0) => boxes(buf, b.start + b.header + skip, b.start + b.size)
const child = (buf: Buffer, b: Box, type: string, skip = 0) => children(buf, b, skip).find(c => c.type === type)

function box(type: string, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts)
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + body.length)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}
const u8 = (v: number) => Buffer.from([v & 0xff])
const u16 = (v: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b }
const u32 = (v: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(Math.max(0, Math.round(v)) >>> 0); return b }
const u64 = (v: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(v); return b }
const zeros = (n: number) => Buffer.alloc(n)
const MATRIX = Buffer.concat([u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)])

/** UTF-8 cut to `max` bytes without splitting a character. */
function utf8(s: string, max: number): Buffer {
  let b = Buffer.from(s, 'utf8')
  if (b.length <= max) return b
  b = b.subarray(0, max)
  let end = b.length
  while (end > 0 && (b[end - 1] & 0xc0) === 0x80) end--
  if (end > 0 && b[end - 1] >= 0xc0) end--
  return b.subarray(0, end)
}

/**
 * The .m4a with chapters. Chapters are sorted, deduplicated, clamped into the audio;
 * the first one is moved to 0:00 (players expect it). Any parsing surprise → the
 * original bytes (markers are a nicety, never a reason to lose the recording).
 */
export function addM4aChapters(input: Buffer, chapters: AudioChapter[]): Buffer {
  try {
    return withChapters(input, chapters)
  } catch (e) {
    console.error('[m4aChapters] skipped', e)
    return input
  }
}

function withChapters(input: Buffer, chapters: AudioChapter[]): Buffer {
  const top = boxes(input, 0, input.length)
  const moovBox = top.find(b => b.type === 'moov')
  if (!moovBox) return input
  const mvhd = child(input, moovBox, 'mvhd')
  if (!mvhd) return input
  const mvVersion = input[mvhd.start + mvhd.header]
  const movieScale = input.readUInt32BE(mvhd.start + mvhd.header + (mvVersion ? 20 : 12))
  const movieDur = mvVersion ? Number(input.readBigUInt64BE(mvhd.start + mvhd.header + 24)) : input.readUInt32BE(mvhd.start + mvhd.header + 16)
  const totalMs = Math.floor((movieDur / movieScale) * 1000)
  const traks = children(input, moovBox).filter(b => b.type === 'trak')
  const audio = traks.find(t => {
    const mdia = child(input, t, 'mdia')
    const hdlr = mdia && child(input, mdia, 'hdlr')
    return hdlr && input.toString('latin1', hdlr.start + hdlr.header + 8, hdlr.start + hdlr.header + 12) === 'soun'
  })
  if (!audio || totalMs <= 0) return input

  const list = chapters
    .map(c => ({ ms: Math.max(0, Math.min(totalMs - 1, Math.round(c.ms))), title: c.title.replace(/\s+/g, ' ').trim() }))
    .filter(c => c.title)
    .sort((a, b) => a.ms - b.ms)
    .filter((c, i, a) => !i || c.ms > a[i - 1].ms)
    .slice(0, 255)
  if (!list.length) return input
  list[0].ms = 0

  // ── Nero chpl (100 ns units) ──
  const chpl = box('chpl', u32(0x01000000), u32(0), u8(list.length), ...list.flatMap(c => {
    const t = utf8(c.title, 255)
    return [u64(BigInt(c.ms) * BigInt(10_000)), u8(t.length), t]
  }))

  // ── QuickTime chapter text track: samples in their own mdat before the new moov ──
  const samples = list.map(c => {
    const t = utf8(c.title, 1000)
    return Buffer.concat([u16(t.length), t, u32(12), Buffer.from('encd', 'latin1'), u32(0x100)])
  })
  const durations = list.map((c, i) => Math.max(1, (list[i + 1]?.ms ?? totalMs) - c.ms))
  const nextTrackAt = mvhd.start + mvhd.size - 4
  const trackId = Math.max(input.readUInt32BE(nextTrackAt), traks.length + 1)

  const head = input.subarray(0, moovBox.start)
  const tail = input.subarray(moovBox.start + moovBox.size)
  const body = Buffer.concat([head, tail])
  const mdatData = Buffer.concat(samples)
  const mdat = box('mdat', mdatData)
  const sampleOffset = body.length + 8
  if (sampleOffset + mdatData.length > 0xffffffff) return input

  const textEntry = box('text', zeros(6), u16(1), Buffer.from([
    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0x0d, 0x66, 0x74, 0x61, 0x62, 0, 1, 0, 1, 0,
  ]))
  const stts: Buffer[] = []
  for (let i = 0; i < durations.length;) {
    let j = i
    while (j + 1 < durations.length && durations[j + 1] === durations[i]) j++
    stts.push(u32(j - i + 1), u32(durations[i]))
    i = j + 1
  }
  const chunkOffsets = [sampleOffset]
  const stbl = box('stbl',
    box('stsd', u32(0), u32(1), textEntry),
    box('stts', u32(0), u32(stts.length / 2), ...stts),
    box('stsc', u32(0), u32(1), u32(1), u32(samples.length), u32(1)),
    box('stsz', u32(0), u32(0), u32(samples.length), ...samples.map(s => u32(s.length))),
    box('stco', u32(0), u32(chunkOffsets.length), ...chunkOffsets.map(u32)),
  )
  const gmhd = box('gmhd',
    box('gmin', u32(0), u16(0x40), u16(0x8000), u16(0x8000), u16(0x8000), u16(0), u16(0)),
    box('text', u16(1), u32(0), u32(0), u32(0), u32(1), u32(0), u32(0), u32(0), u32(0x4000), u16(0)),
  )
  const dinf = box('dinf', box('dref', u32(0), u32(1), box('url ', u32(1))))
  const mdhd = box('mdhd', u32(0), u32(0), u32(0), u32(1000), u32(totalMs), u16(0x55c4), u16(0))
  const hdlr = box('hdlr', u32(0), u32(0), Buffer.from('text', 'latin1'), zeros(12), Buffer.from('Chapters\0', 'latin1'))
  // Disabled track (flags 0): players list it as chapters, not as subtitles.
  const tkhd = box('tkhd', u32(0), u32(0), u32(0), u32(trackId), u32(0), u32(movieDur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(0), u32(0))
  const chapterTrak = box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', gmhd, dinf, stbl)))

  // ── Rebuild moov: audio trak gets tref/chap, udta gets chpl, mvhd the next track id ──
  const tref = box('tref', box('chap', u32(trackId)))
  // Audio stored after the old moov moves back by its size once the moov goes to the end.
  const moved = (trak: Buffer) => { shiftOffsetsPast(trak, moovBox.start, -moovBox.size); return trak }
  const parts: Buffer[] = []
  let hadUdta = false
  for (const b of children(input, moovBox)) {
    const raw = input.subarray(b.start, b.start + b.size)
    if (b.type === 'mvhd') {
      const copy = Buffer.from(raw)
      copy.writeUInt32BE(trackId + 1, copy.length - 4)
      parts.push(copy)
    } else if (b.start === audio.start) {
      const inner = children(input, b).filter(c => c.type !== 'tref')
      const rebuilt: Buffer[] = []
      for (const c of inner) {
        rebuilt.push(input.subarray(c.start, c.start + c.size))
        if (c.type === 'tkhd') rebuilt.push(tref)
      }
      parts.push(moved(box('trak', ...rebuilt)))
    } else if (b.type === 'udta') {
      hadUdta = true
      const keep = children(input, b).filter(c => c.type !== 'chpl').map(c => input.subarray(c.start, c.start + c.size))
      parts.push(box('udta', ...keep, chpl))
    } else {
      parts.push(b.type === 'trak' ? moved(Buffer.from(raw)) : raw)
    }
  }
  parts.push(chapterTrak)
  if (!hadUdta) parts.push(box('udta', chpl))
  return Buffer.concat([body, mdat, box('moov', ...parts)])
}

/** In a trak (a copy, edited in place): stco/co64 offsets ≥ `from` move by `delta`. */
function shiftOffsetsPast(trak: Buffer, from: number, delta: number) {
  const walk = (a: number, b: number) => {
    for (const x of boxes(trak, a, b)) {
      if (['trak', 'mdia', 'minf', 'stbl'].includes(x.type)) walk(x.start + x.header, x.start + x.size)
      else if (x.type === 'stco' || x.type === 'co64') {
        const wide = x.type === 'co64'
        const n = trak.readUInt32BE(x.start + x.header + 4)
        for (let i = 0; i < n; i++) {
          const p = x.start + x.header + 8 + i * (wide ? 8 : 4)
          const v = wide ? Number(trak.readBigUInt64BE(p)) : trak.readUInt32BE(p)
          if (v < from) continue
          if (wide) trak.writeBigUInt64BE(BigInt(v + delta), p)
          else trak.writeUInt32BE(v + delta, p)
        }
      }
    }
  }
  const root = boxes(trak, 0, trak.length)[0]
  walk(root.start + root.header, root.start + root.size)
}
