import assert from 'node:assert/strict'
import { appendSection, applyBoardItems, applyTidy, docTail, flatBlocks, newSectionsBlocks, sectionTitles } from './docOps'

// npx tsx src/shared/lib/callNotes/docOps.selfcheck.ts

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const sec = (seq: number, blocks: ReturnType<typeof p>[], edited = false) => ({
  type: 'aiSection', attrs: { fromSeq: seq, toSeq: seq, final: true, edited, startMs: 0 }, content: blocks,
})
type N = { type: string; text?: string; content?: N[] }
const texts = (doc: { content?: N[] }) =>
  (doc.content ?? []).map(n => n.type === 'aiSection' ? (n.content ?? []).map(b => b.content?.[0]?.text) : n.content?.[0]?.text)

// appendSection: empty doc → one call section with the spec's attrs.
{
  const doc = appendSection(null, [p('a')], 0, null)
  assert.deepEqual(doc, { type: 'doc', content: [{ type: 'aiSection', attrs: { fromSeq: 0, toSeq: 0, final: true, edited: false, startMs: 0 }, content: [p('a')] }] })
}

// appendSection: goes to the end by default.
{
  const doc = { type: 'doc', content: [sec(0, [p('a')]), p('mine')] }
  assert.deepEqual(texts(appendSection(doc, [p('b')], 1, null)), [['a'], 'mine', ['b']])
}

// appendSection: `continues: 1` → right after the second AI section (own text doesn't count).
{
  const doc = { type: 'doc', content: [sec(0, [p('a')]), p('mine'), sec(1, [p('b')]), sec(2, [p('c')])] }
  assert.deepEqual(texts(appendSection(doc, [p('b2')], 3, 1)), [['a'], 'mine', ['b'], ['b2'], ['c']])
  // a section number that isn't there → the end
  assert.deepEqual(texts(appendSection(doc, [p('z')], 3, 7)), [['a'], 'mine', ['b'], ['c'], ['z']])
}

// flatBlocks: own blocks + children of AI sections, in doc order.
const board = { type: 'doc', content: [p('own0'), sec(0, [p('a'), p('b')]), sec(1, [p('c')])] }
assert.deepEqual(flatBlocks(board).map(b => b.text), ['own0', 'a', 'b', 'c'])

// applyBoardItems: every index refers to the doc as the model saw it (applied from the end).
{
  const out = applyBoardItems(board, [
    { action: 'continuation', block: 1, markdown: 'a2' },
    { action: 'fix', block: 3, markdown: 'C' },
    { action: 'duplicate', block: 2, markdown: 'b' },
    { action: 'new', block: null, markdown: 'n1' },
    { action: 'continuation', block: 0, markdown: 'own1' },
    { action: 'continuation', block: 1, markdown: 'a3' },
    { action: 'new', block: null, markdown: 'n2' },
  ], 5)
  assert.deepEqual(texts(out), ['own0', 'own1', ['a', 'a2', 'a3', 'b'], ['C'], ['n1', 'n2']])
  const last = out.content[out.content.length - 1]
  assert.deepEqual(last.attrs, { fromSeq: 5, toSeq: 5, final: true, edited: false, startMs: 0 })
  // continuation of a block that isn't there → new, at the end
  assert.deepEqual(texts(applyBoardItems(board, [{ action: 'continuation', block: 9, markdown: 'x' }], 6)), ['own0', ['a', 'b'], ['c'], ['x']])
  // only duplicates → nothing changes
  assert.deepEqual(applyBoardItems(board, [{ action: 'duplicate', block: 1, markdown: 'a' }], 6), board)
}

// applyBoardItems by hand: edited sections, and fix + continuation on one block.
{
  const doc = { type: 'doc', content: [sec(0, [p('a')]), sec(1, [p('b'), p('c')], true), sec(2, [p('d')])] }
  // flat: 0 a · 1 b (edited) · 2 c (edited) · 3 d
  // a fix inside a section the user edited is skipped
  assert.deepEqual(texts(applyBoardItems(doc, [{ action: 'fix', block: 1, markdown: 'B' }], 7)), [['a'], ['b', 'c'], ['d']])
  // fix and continuation on the same block: the fix replaces it, the continuation follows — in either order
  const pair = (first: 'fix' | 'continuation') => applyBoardItems(doc, first === 'fix'
    ? [{ action: 'fix', block: 0, markdown: 'A' }, { action: 'continuation', block: 0, markdown: 'x' }]
    : [{ action: 'continuation', block: 0, markdown: 'x' }, { action: 'fix', block: 0, markdown: 'A' }], 7)
  assert.deepEqual(texts(pair('fix')), [['A', 'x'], ['b', 'c'], ['d']])
  assert.deepEqual(texts(pair('continuation')), [['A', 'x'], ['b', 'c'], ['d']])
  // continuations of an edited section don't go inside it: one new section right after it, in block then item order
  const out = applyBoardItems(doc, [{ action: 'continuation', block: 2, markdown: 'c2' }, { action: 'continuation', block: 1, markdown: 'b2' }, { action: 'continuation', block: 2, markdown: 'c3' }], 7)
  assert.deepEqual(texts(out), [['a'], ['b', 'c'], ['b2', 'c2', 'c3'], ['d']])
  assert.deepEqual(out.content[2].attrs, { fromSeq: 7, toSeq: 7, final: true, edited: false, startMs: 0 })
}

// Tidy: only sections newer than the last pass (toSeq > sinceSeq), never edited ones.
{
  const doc = { type: 'doc', content: [p('own'), sec(2, [p('a'), p('b')]), sec(4, [p('c'), p('d')]), sec(5, [p('e')], true), sec(6, [p('f')])] }
  // flat: 0 own · 1 a · 2 b · 3 c · 4 d · 5 e (edited) · 6 f
  assert.deepEqual(newSectionsBlocks(doc, 3), [{ n: 3, text: 'c' }, { n: 4, text: 'd' }, { n: 6, text: 'f' }])
  const out = applyTidy(doc, 3, { remove: [0, 1, 3, 5, 6], replace: [{ n: 4, markdown: 'D' }, { n: 2, markdown: 'B' }] })
  // own text, the old section and the edited one untouched; the emptied section is gone
  assert.deepEqual(texts(out), ['own', ['a', 'b'], ['D'], ['e']])
  // a replacement with nothing in it is a removal
  assert.deepEqual(texts(applyTidy(doc, 3, { remove: [], replace: [{ n: 6, markdown: '  ' }] })), ['own', ['a', 'b'], ['c', 'd'], ['e']])
  assert.deepEqual(newSectionsBlocks(doc, 6), [])
}

// sectionTitles: one per AI section (the numbering `continues` uses) — heading first, else opening words.
{
  const h = { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Производная' }] }
  const doc = { type: 'doc', content: [p('own'), sec(0, [p('вступление'), h]), sec(1, [p('без заголовка')])] }
  assert.deepEqual(sectionTitles(doc), ['Производная', 'без заголовка'])
  assert.equal(docTail(doc, 9), 'заголовка')
}

console.log('docOps ok')
