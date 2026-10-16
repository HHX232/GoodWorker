// npx tsx src/shared/lib/chess/data/data.selfcheck.ts → "data ok"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { OPENINGS, TACTICS } from '.'

// Spec «Дополнения после G2»: 15 tactics (Lichess theme ids), 20 openings.
assert.deepEqual(
  TACTICS.map((t) => t.id).sort(),
  ['attraction', 'backRankMate', 'deflection', 'discoveredAttack', 'doubleAttack', 'fork', 'hangingPiece', 'intermezzo',
    'mateIn1', 'mateIn2', 'mateIn3', 'pin', 'promotion', 'sacrifice', 'skewer'].sort()
)
assert.equal(OPENINGS.length, 20)
assert.equal(new Set(OPENINGS.map((o) => o.id)).size, 20, 'opening ids unique')

for (const o of OPENINGS) {
  const game = new Chess()
  for (const san of o.moves) assert.doesNotThrow(() => game.move(san), `${o.id}: illegal ${san} after ${game.history().join(' ')}`)
  assert.ok(o.moves.length >= 6, `${o.id}: main line too short`)
  assert.match(o.eco, /^[A-E]\d\d$/, `${o.id}: eco`)
  assert.match(o.lichessTag, /^[A-Za-z-]+(_[A-Za-z-]+)*$/, `${o.id}: lichessTag looks like Lichess openingTags`)
}

// Every key the data points to exists in all 4 locale files of the learn area.
for (const locale of ['ru', 'en', 'hi', 'zh']) {
  const msgs = JSON.parse(readFileSync(join(__dirname, '../../../../../messages/chess/learn', `${locale}.json`), 'utf8'))
  for (const k of [...OPENINGS.flatMap((o) => [o.nameKey, o.ideaKey]), ...TACTICS.flatMap((t) => [t.nameKey, t.descKey])]) {
    assert.equal(typeof msgs[k], 'string', `${locale}: missing ${k}`)
  }
}

console.log('data ok')
