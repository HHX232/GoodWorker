import assert from 'node:assert/strict'
import { shellKey } from './shellKeys'

// Ticket 18: N — new game, P — puzzles, / — player search, ? — key help.
const k = (key: string, more: Partial<Parameters<typeof shellKey>[0]> = {}) => shellKey({ key, ...more })

assert.equal(k('n'), 'new')
assert.equal(k('N', { shiftKey: true }), 'new') // caps / shift
assert.equal(k('p'), 'puzzles')
assert.equal(k('/'), 'search')
assert.equal(k('?', { shiftKey: true }), 'keys')
// Russian layout: the same physical keys (KeyN = «т», KeyP = «з»)
assert.equal(k('т', { code: 'KeyN' }), 'new')
assert.equal(k('з', { code: 'KeyP' }), 'puzzles')
assert.equal(k('x'), null)

// typing a name or a PGN must not open anything
assert.equal(k('n', { target: { tagName: 'INPUT' } }), null)
assert.equal(k('p', { target: { tagName: 'TEXTAREA' } }), null)
assert.equal(k('/', { target: { tagName: 'DIV', isContentEditable: true } }), null)
// browser shortcuts stay the browser's: Cmd+P prints, Ctrl+N opens a window
assert.equal(k('p', { metaKey: true }), null)
assert.equal(k('n', { ctrlKey: true }), null)
assert.equal(k('n', { altKey: true }), null)

console.log('shellKeys ok')
