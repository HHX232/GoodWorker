import {
  AlignmentType, CommentRangeEnd, CommentRangeStart, CommentReference, Document, HeadingLevel, ImageRun, ImportedXmlComponent,
  LevelFormat, Packer, Paragraph, ShadingType, TextRun, type ParagraphChild,
} from 'docx'
import type { PMMark, PMNode } from './markdownToDoc'

// Server-side export of the lecture doc (TipTap JSON) to .docx. Formulas
// become real Word equations (LaTeX → MathML via mathlive → OMML via
// mathml2omml — LGPL, which is why this runs on the server only, never in
// the browser bundle); notes become Word comments; colour and highlight stay.

const HEADINGS = { 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 } as const

// ESM-only packages, loaded once on first export.
let latexToMathMl: ((latex: string) => string) | null = null
let mathMlToOmml: ((mathml: string) => string) | null = null

async function loadMath(): Promise<void> {
  if (latexToMathMl && mathMlToOmml) return
  const [ml, om] = await Promise.all([import('mathlive/ssr'), import('mathml2omml')])
  latexToMathMl = ml.convertLatexToMathMl
  mathMlToOmml = om.mml2omml
}

/** Base text size in half-points (12 pt) — the document default below. */
const BASE_HALF_POINTS = 24

type Align = 'left' | 'center' | 'right' | 'justify'
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const
const alignOf = (v: unknown) => (typeof v === 'string' && v in ALIGN ? ALIGN[v as Align] : undefined)

/** "18px" (TipTap FontSize) → Word half-points (1 px = 0.75 pt). */
function halfPoints(fontSize: unknown): number | undefined {
  const px = typeof fontSize === 'string' ? parseFloat(fontSize) : NaN
  return Number.isFinite(px) && px > 4 && px < 200 ? Math.round(px * 1.5) : undefined
}

function omml(latex: string, block: boolean, opts: { size?: number; align?: string } = {}): ParagraphChild {
  try {
    if (!latexToMathMl || !mathMlToOmml) throw new Error('math not loaded')
    const convertLatexToMathMl = latexToMathMl
    const mml2omml = mathMlToOmml
    const mathml = convertLatexToMathMl(latex).replace(/<mo>&#x2061;<\/mo>/g, '').replace(/\u2061/g, '')
    let xml = mml2omml(`<math xmlns="http://www.w3.org/1998/Math/MathML">${mathml}</math>`)
    // Formula scale → an explicit run size on every math run.
    const size = Number(opts.size) || 1
    if (size !== 1) {
      const sz = Math.round(BASE_HALF_POINTS * size * (block ? 1.15 : 1))
      xml = xml.replace(/<m:r>(<m:rPr>[\s\S]*?<\/m:rPr>)?/g, (_m, rpr = '') => `<m:r>${rpr}<w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`)
    }
    if (block) {
      const jc = opts.align === 'left' || opts.align === 'right' ? `<m:oMathParaPr><m:jc m:val="${opts.align}"/></m:oMathParaPr>` : ''
      xml = `<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${jc}${xml}</m:oMathPara>`
    }
    // fromXmlString wraps the parse in a nameless root (serialises as
    // </undefined>) — its first child is the real <m:oMath>/<m:oMathPara>.
    const root = ImportedXmlComponent.fromXmlString(xml) as unknown as { root: unknown[] }
    const element = root.root.find(c => typeof c === 'object')
    if (!element) throw new Error('empty omml')
    return element as ParagraphChild
  } catch {
    return new TextRun({ text: latex, font: 'Cambria Math' })
  }
}

function hex(color: unknown): string | undefined {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : undefined
}

export interface DocxPhoto { bytes: Buffer; width: number; height: number; mime: string }

interface Ctx {
  comments: { id: number; text: string; date: Date }[]
  noteIds: Map<string, number>
  photos: Map<string, DocxPhoto>
}

/** Page content width ≈ 6.3" at 96 dpi. */
const MAX_IMAGE_PX = 600

function photoParagraph(photo: DocxPhoto): Paragraph {
  const scale = Math.min(1, MAX_IMAGE_PX / photo.width)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      type: photo.mime === 'image/png' ? 'png' : 'jpg',
      data: photo.bytes,
      transformation: { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) },
    })],
  })
}

function runsFor(nodes: PMNode[] | undefined, ctx: Ctx): ParagraphChild[] {
  const out: ParagraphChild[] = []
  let openNote: number | null = null
  const closeNote = () => {
    if (openNote === null) return
    out.push(new CommentRangeEnd(openNote), new TextRun({ children: [new CommentReference(openNote)] }))
    openNote = null
  }
  for (const n of nodes ?? []) {
    const marks: PMMark[] = n.marks ?? []
    const note = marks.find(m => m.type === 'lectureNote' && m.attrs?.id)
    const noteId = note ? String(note.attrs!.id) : null
    const current = noteId ? ctx.noteIds.get(noteId) ?? null : null
    if (openNote !== null && current !== openNote) closeNote()
    if (noteId && current === null) {
      const id = ctx.comments.length
      ctx.noteIds.set(noteId, id)
      ctx.comments.push({ id, text: String(note!.attrs!.text ?? ''), date: new Date(String(note!.attrs!.createdAt ?? Date.now())) })
      out.push(new CommentRangeStart(id))
      openNote = id
    } else if (noteId && openNote === null && current !== null) {
      out.push(new CommentRangeStart(current))
      openNote = current
    }

    if (n.type === 'mathInline') { out.push(omml(String(n.attrs?.latex ?? ''), false, { size: Number(n.attrs?.size) || 1 })); continue }
    if (n.type === 'hardBreak') { out.push(new TextRun({ break: 1 })); continue }
    if (n.type !== 'text' || !n.text) continue
    const textStyle = marks.find(m => m.type === 'textStyle')?.attrs
    const color = hex(textStyle?.color)
    const fill = hex(marks.find(m => m.type === 'highlight')?.attrs?.color)
    out.push(new TextRun({
      text: n.text,
      bold: marks.some(m => m.type === 'bold'),
      italics: marks.some(m => m.type === 'italic'),
      underline: marks.some(m => m.type === 'underline') ? {} : undefined,
      strike: marks.some(m => m.type === 'strike'),
      color,
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      font: marks.some(m => m.type === 'code') ? 'Consolas' : undefined,
      size: halfPoints(textStyle?.fontSize),
    }))
  }
  closeNote()
  return out
}

function blocksFor(nodes: PMNode[] | undefined, ctx: Ctx, list?: { ordered: boolean; level: number; instance: number }): Paragraph[] {
  const out: Paragraph[] = []
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'aiSection':
      case 'blockquote':
        out.push(...blocksFor(n.content, ctx, list))
        break
      case 'heading':
        out.push(new Paragraph({ heading: HEADINGS[(n.attrs?.level as 2 | 3 | 4) ?? 2] ?? HeadingLevel.HEADING_2, alignment: alignOf(n.attrs?.textAlign), children: runsFor(n.content, ctx) }))
        break
      case 'paragraph':
        out.push(new Paragraph({
          alignment: alignOf(n.attrs?.textAlign),
          children: runsFor(n.content, ctx),
          ...(list ? (list.ordered ? { numbering: { reference: 'lecture-ordered', level: list.level, instance: list.instance } } : { bullet: { level: list.level } }) : {}),
        }))
        break
      case 'bulletList':
      case 'orderedList': {
        const level = list ? Math.min(list.level + 1, 8) : 0
        const instance = n.type === 'orderedList' ? ++orderedInstance : 0
        for (const item of n.content ?? []) {
          const [first, ...rest] = item.content ?? []
          out.push(...blocksFor(first ? [first] : [], ctx, { ordered: n.type === 'orderedList', level, instance }))
          out.push(...blocksFor(rest, ctx, { ordered: n.type === 'orderedList', level, instance }))
        }
        break
      }
      case 'mathBlock':
        out.push(new Paragraph({
          alignment: alignOf(n.attrs?.align) ?? AlignmentType.CENTER,
          children: [omml(String(n.attrs?.latex ?? ''), true, { size: Number(n.attrs?.size) || 1, align: String(n.attrs?.align ?? 'center') })],
        }))
        break
      case 'boardBlock':
      case 'graphBlock':
      case 'lecturePhoto': {
        const photo = ctx.photos.get(String(n.attrs?.photoId ?? ''))
        if (photo && photo.mime !== 'image/webp') out.push(photoParagraph(photo))
        break
      }
      case 'codeBlock':
        out.push(new Paragraph({ children: [new TextRun({ text: (n.content ?? []).map(c => c.text ?? '').join(''), font: 'Consolas' })] }))
        break
      case 'horizontalRule':
        out.push(new Paragraph({ border: { bottom: { style: 'single', size: 6, color: 'CCCCCC', space: 1 } }, children: [] }))
        break
      default:
        if (n.content) out.push(...blocksFor(n.content, ctx, list))
    }
  }
  return out
}

let orderedInstance = 0

/** Photo ids placed in the doc — the export route loads just these. */
export function photoIdsIn(doc: PMNode | null): string[] {
  const ids: string[] = []
  const walk = (n: PMNode) => { if ((n.type === 'lecturePhoto' || n.type === 'boardBlock' || n.type === 'graphBlock') && n.attrs?.photoId) ids.push(String(n.attrs.photoId)); n.content?.forEach(walk) }
  if (doc) walk(doc)
  return [...new Set(ids)]
}

/** A lecture's TipTap doc → .docx bytes. */
export async function lectureToDocx(doc: PMNode | null, title: string, author: string, photos: Map<string, DocxPhoto> = new Map()): Promise<Buffer> {
  orderedInstance = 0
  await loadMath()
  const ctx: Ctx = { comments: [], noteIds: new Map(), photos }
  const body = blocksFor(doc?.content ?? [], ctx)
  const document = new Document({
    creator: author,
    title,
    comments: { children: ctx.comments.map(c => ({ id: c.id, author, initials: author.slice(0, 2), date: c.date, children: [new Paragraph({ children: [new TextRun(c.text)] })] })) },
    numbering: {
      config: [{
        reference: 'lecture-ordered',
        levels: Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })),
      }],
    },
    styles: { default: { document: { run: { font: 'Calibri', size: BASE_HALF_POINTS } } } },
    sections: [{ children: [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title || 'Конспект лекции')] }), ...body] }],
  })
  return Packer.toBuffer(document)
}
