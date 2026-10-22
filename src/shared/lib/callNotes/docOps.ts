import { markdownToBlocks, nodeText, type PMNode } from '@/shared/lib/lecture/markdownToDoc'

// The call's notes document (TipTap JSON, same shape as a lecture's) edited on
// the server, no editor. Prisma-free: `docOps.selfcheck.ts` runs it directly.
//
// "Flat blocks" — the numbering DeepSeek sees: top-level nodes outside AI
// sections plus the children of each `aiSection`, in document order.

export interface Doc { type: 'doc'; content: PMNode[] }

/** A doc from `LectureNote.docJson` (null / junk → empty). */
export function asDoc(raw: unknown): Doc {
  const content = (raw as { content?: unknown } | null)?.content
  return { type: 'doc', content: Array.isArray(content) ? (content as PMNode[]) : [] }
}

const section = (blocks: PMNode[], seq: number): PMNode => ({
  type: 'aiSection', attrs: { fromSeq: seq, toSeq: seq, final: true, edited: false, startMs: 0 }, content: blocks,
})

const isEmptyParagraph = (n: PMNode) => n.type === 'paragraph' && !(n.content ?? []).length

/**
 * New AI notes as a section: at the end, or right after AI section number
 * `afterSection` (index into sectionTitles) when the AI said they only add to it.
 */
export function appendSection(raw: unknown, blocks: PMNode[], seq: number, afterSection: number | null): Doc {
  const doc = asDoc(raw)
  if (!blocks.length) return doc
  // A fresh editor doc is one empty paragraph — replace it instead of leaving a gap.
  const content = doc.content.length === 1 && isEmptyParagraph(doc.content[0]) ? [] : [...doc.content]
  let at = content.length
  if (afterSection !== null) {
    let n = -1
    content.forEach((node, i) => { if (node.type === 'aiSection' && ++n === afterSection) at = i + 1 })
  }
  content.splice(at, 0, section(blocks, seq))
  return { type: 'doc', content }
}

export interface FlatBlock { text: string; path: [number] | [number, number] }

/** Every block DeepSeek can point at, numbered by position in this list. */
export function flatBlocks(raw: unknown): FlatBlock[] {
  const out: FlatBlock[] = []
  asDoc(raw).content.forEach((node, i) => {
    if (node.type !== 'aiSection') out.push({ text: nodeText(node).trim(), path: [i] })
    else (node.content ?? []).forEach((b, j) => out.push({ text: nodeText(b).trim(), path: [i, j] }))
  })
  return out
}

/** The array a flat block lives in (top level or its section) and its index there. */
function locate(doc: Doc, path: FlatBlock['path']): { list: PMNode[]; at: number } {
  if (path.length === 1) return { list: doc.content, at: path[0] }
  return { list: (doc.content[path[0]].content ??= []), at: path[1] }
}

export interface BoardItem {
  action: 'new' | 'continuation' | 'fix' | 'duplicate'
  /** Flat block: continuation goes after it, fix replaces it. */
  block: number | null
  markdown: string
}

/**
 * What the board inspection decided, applied without asking: `continuation` after
 * block N, `fix` replaces block N, `new` → one new section at the end, `duplicate`
 * skipped. A section the user edited is never changed: a fix there is skipped, its
 * continuations become one new section right after it. Edits run from the last block
 * back so the model's numbering stays valid.
 */
export function applyBoardItems(raw: unknown, items: BoardItem[], seq: number): Doc {
  const doc = structuredClone(asDoc(raw))
  const flat = flatBlocks(doc)
  const editedAt = (block: number) => {
    const path = flat[block].path
    return path.length === 2 && doc.content[path[0]].attrs?.edited ? path[0] : null
  }
  const fresh: PMNode[] = []
  const edits: { block: number; kind: 'after' | 'fix' | 'section'; i: number; blocks: PMNode[] }[] = []
  const besideEdited = new Map<number, { block: number; i: number; blocks: PMNode[] }[]>()
  items.forEach((item, i) => {
    if (item.action === 'duplicate') return
    const blocks = markdownToBlocks(item.markdown)
    if (!blocks.length) return
    const block = item.block
    if (item.action === 'new' || block === null || !Number.isInteger(block) || block < 0 || block >= flat.length) { fresh.push(...blocks); return }
    const edited = editedAt(block)
    if (edited === null) edits.push({ block, kind: item.action === 'fix' ? 'fix' : 'after', i, blocks })
    else if (item.action === 'continuation') besideEdited.set(edited, [...(besideEdited.get(edited) ?? []), { block, i, blocks }])
  })
  for (const group of besideEdited.values()) {
    group.sort((a, b) => a.block - b.block || a.i - b.i)
    edits.push({ block: Math.max(...group.map(g => g.block)), kind: 'section', i: -1, blocks: group.flatMap(g => g.blocks) })
  }
  // Last block first; on one block: continuations (later ones first, so they keep the
  // model's order) before its fix — they stay after whatever replaced it.
  edits.sort((a, b) => b.block - a.block || Number(a.kind === 'fix') - Number(b.kind === 'fix') || b.i - a.i)
  const fixed = new Set<number>()
  for (const e of edits) {
    const path = flat[e.block].path
    if (e.kind === 'section') { doc.content.splice(path[0] + 1, 0, section(e.blocks, seq)); continue }
    const { list, at } = locate(doc, path)
    if (e.kind === 'after') { list.splice(at + 1, 0, ...e.blocks); continue }
    if (fixed.has(e.block)) continue
    fixed.add(e.block)
    list.splice(at, 1, ...e.blocks)
  }
  return fresh.length ? appendSection(doc, fresh, seq, null) : doc
}

/** An AI section the tidy pass may touch: newer than the last pass and not edited by hand. */
const tidyable = (node: PMNode | undefined, sinceSeq: number) =>
  node?.type === 'aiSection' && Number(node.attrs?.toSeq) > sinceSeq && !node.attrs?.edited

/** Blocks of the sections the tidy pass looks at (`n` — flat number), nothing older. */
export function newSectionsBlocks(raw: unknown, sinceSeq: number): { n: number; text: string }[] {
  const doc = asDoc(raw)
  return flatBlocks(doc)
    .map((b, n) => ({ n, text: b.text, path: b.path }))
    .filter(b => b.path.length === 2 && tidyable(doc.content[b.path[0]], sinceSeq))
    .map(({ n, text }) => ({ n, text }))
}

/**
 * The tidy pass's verdict: drop / rewrite flat blocks — only inside tidyable sections
 * (anything else the model names is ignored). A section left empty is removed.
 */
export function applyTidy(raw: unknown, sinceSeq: number, verdict: { remove: number[]; replace: { n: number; markdown: string }[] }): Doc {
  const doc = structuredClone(asDoc(raw))
  const flat = flatBlocks(doc)
  const ops = new Map<number, PMNode[]>()
  for (const n of verdict.remove) ops.set(n, [])
  for (const r of verdict.replace) if (!ops.has(r.n)) ops.set(r.n, markdownToBlocks(r.markdown))
  const touched = new Set<number>()
  for (const n of [...ops.keys()].sort((a, b) => b - a)) {
    const path = flat[n]?.path
    if (path?.length !== 2 || !tidyable(doc.content[path[0]], sinceSeq)) continue
    locate(doc, path).list.splice(path[1], 1, ...(ops.get(n) as PMNode[]))
    touched.add(path[0])
  }
  doc.content = doc.content.filter((node, i) => !touched.has(i) || (node.content ?? []).length > 0)
  return doc
}

/** AI sections' titles for `structureTranscript` (`continues` = index here): first heading, else opening words. */
export function sectionTitles(raw: unknown): string[] {
  return asDoc(raw).content.filter(n => n.type === 'aiSection').map(s => {
    const heading = (s.content ?? []).find(b => b.type === 'heading')
    return ((heading ? nodeText(heading) : nodeText(s)).replace(/\s+/g, ' ').trim().slice(0, 100)) || '…'
  })
}

/** The end of the notes as text — "don't repeat this" context for the next fragment. */
export function docTail(raw: unknown, chars: number): string {
  return asDoc(raw).content.map(nodeText).join('').trim().slice(-chars)
}
