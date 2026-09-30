import type { Editor, JSONContent } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { AI_META } from './extensions'

export interface SectionAttrs {
  fromSeq: number
  toSeq: number
  startMs: number
  final: boolean
}

export interface NoteInfo {
  id: string
  text: string
  quote: string
  pos: number
}

/**
 * Where notes for this stretch of audio go: before the first section of later audio (a
 * re-conspected gap lands in its place), otherwise — the live case — at the very end.
 * Never "right after the previous section": whatever the student added or moved after
 * it (own text, board photos, a topic dragged to the end) would end up below the new notes.
 */
export function sectionInsertPos(doc: PMNode, toSeq: number): number {
  let at = doc.content.size
  doc.forEach((child, pos) => {
    if (child.type.name === 'aiSection' && child.attrs.fromSeq > toSeq && pos < at) at = pos
  })
  return at
}

/** Adds AI notes as a section the AI may later refresh, in recording order (sectionInsertPos). Not in the undo history. */
export function appendAiSection(editor: Editor, blocks: JSONContent[], attrs: SectionAttrs): void {
  if (!blocks.length) return
  const node = { type: 'aiSection', attrs: { ...attrs, edited: false }, content: blocks }
  const doc = editor.state.doc
  // An empty doc still has one empty paragraph — replace it instead of leaving a gap.
  const onlyEmpty = doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph' && doc.firstChild.content.size === 0
  const at = sectionInsertPos(doc, attrs.toSeq)
  editor
    .chain()
    .command(({ tr }) => { tr.setMeta(AI_META, true).setMeta('addToHistory', false); return true })
    .insertContentAt(onlyEmpty ? { from: 0, to: doc.content.size } : at, node, { updateSelection: false })
    .run()
}

/** Chunk seqs already turned into notes (any AI section, edited or not). */
export function coveredSeqs(editor: Editor): Set<number> {
  const out = new Set<number>()
  editor.state.doc.forEach(node => {
    if (node.type.name !== 'aiSection') return
    for (let s = node.attrs.fromSeq; s <= node.attrs.toSeq; s++) out.add(s)
  })
  return out
}

/** The AI sections the student hasn't touched and that still carry draft text. */
export function refreshableSections(editor: Editor): (SectionAttrs & { pos: number })[] {
  const out: (SectionAttrs & { pos: number })[] = []
  editor.state.doc.forEach((node, pos) => {
    if (node.type.name === 'aiSection' && !node.attrs.edited && !node.attrs.final) {
      out.push({ pos, fromSeq: node.attrs.fromSeq, toSeq: node.attrs.toSeq, startMs: node.attrs.startMs, final: false })
    }
  })
  return out
}

/** Swaps an untouched section's content for the final-text version (skipped if edited meanwhile). */
export function replaceSection(editor: Editor, fromSeq: number, toSeq: number, blocks: JSONContent[]): boolean {
  let target: { pos: number; node: PMNode } | null = null
  editor.state.doc.forEach((node, pos) => {
    if (node.type.name === 'aiSection' && node.attrs.fromSeq === fromSeq && node.attrs.toSeq === toSeq) target = { pos, node }
  })
  const found = target as { pos: number; node: PMNode } | null
  if (!found || found.node.attrs.edited || !blocks.length) return false
  const { pos, node } = found
  editor
    .chain()
    .command(({ tr }) => { tr.setMeta(AI_META, true).setMeta('addToHistory', false); return true })
    .insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: 'aiSection', attrs: { ...node.attrs, final: true }, content: blocks }, { updateSelection: false })
    .run()
  return true
}

/** Plain text of the doc up to `pos` (for DeepSeek's "don't repeat this" context). */
export function textBefore(editor: Editor, pos: number, max = 1500): string {
  return docText(editor.state.doc, 0, pos).slice(-max)
}

/** Text of a range with formulas as $latex$ — what DeepSeek reads. */
export function docText(doc: PMNode, from: number, to: number): string {
  return doc.textBetween(Math.max(0, from), Math.min(doc.content.size, to), '\n', leaf =>
    leaf.type.name === 'mathInline' ? `$${leaf.attrs.latex}$` : leaf.type.name === 'mathBlock' ? `\n$$${leaf.attrs.latex}$$\n` : leaf.type.name === 'hardBreak' ? '\n' : '')
}

export function collectNotes(doc: PMNode): NoteInfo[] {
  const byId = new Map<string, NoteInfo>()
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    for (const mark of node.marks) {
      if (mark.type.name !== 'lectureNote' || !mark.attrs.id) continue
      const prev = byId.get(mark.attrs.id)
      if (prev) prev.quote += node.text ?? ''
      else byId.set(mark.attrs.id, { id: mark.attrs.id, text: mark.attrs.text ?? '', quote: node.text ?? '', pos })
    }
    return false
  })
  return [...byId.values()].sort((a, b) => a.pos - b.pos)
}

/** [from, to] of a mark carrying `attrs.id === id` (notes, pending photo fixes). */
export function markRange(doc: PMNode, markName: string, id: string): { from: number; to: number } | null {
  let from = -1
  let to = -1
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    if (node.marks.some(m => m.type.name === markName && m.attrs.id === id)) {
      if (from < 0) from = pos
      to = pos + node.nodeSize
    }
    return false
  })
  return from < 0 ? null : { from, to }
}

/** A single-paragraph answer goes in inline (no stray line break); anything bigger as blocks. */
export function fragmentFor(blocks: JSONContent[]): JSONContent | JSONContent[] {
  if (blocks.length === 1 && blocks[0].type === 'paragraph') return blocks[0].content ?? []
  return blocks
}

/**
 * A pending "fix by photo"/"ask AI" mark can't survive a reload — its request is gone.
 * Nor can a graph block inserted but never filled in (its editor was open when the tab closed).
 */
export function stripPending(doc: JSONContent | null): JSONContent | null {
  if (!doc) return doc
  const walk = (n: JSONContent): JSONContent => ({
    ...n,
    ...(n.marks ? { marks: n.marks.filter(m => m.type !== 'pendingFix') } : {}),
    ...(n.content ? { content: n.content.filter(c => !(c.type === 'graphBlock' && !c.attrs?.spec)).map(walk) } : {}),
  })
  return walk(doc)
}
