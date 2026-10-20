// npx tsx src/shared/lib/chess/data/data.selfcheck.ts → "data ok"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { OPENINGS, TACTICS, BOTS, bookMove, botUnlocked, getBot } from '.'
import { BADGE_CODES } from '../server/progressModel'

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

// G21/G22 bots: 8 level bots (one per engine level) + 5 special ones, each unlocked by an existing badge
assert.equal(new Set(BOTS.map((b) => b.id)).size, BOTS.length, 'bot ids unique')
assert.deepEqual(BOTS.filter((b) => !b.unlock).map((b) => b.level), [1, 2, 3, 4, 5, 6, 7, 8])
const special = BOTS.filter((b) => b.unlock)
assert.equal(special.length, 5)
for (const b of special) {
  assert.ok((BADGE_CODES as readonly string[]).includes(b.unlock!), `${b.id}: unknown badge ${b.unlock}`)
  assert.ok(b.opening && OPENINGS.some((o) => o.id === b.opening), `${b.id}: unknown opening ${b.opening}`)
}
for (const locale of ['ru', 'en', 'hi', 'zh']) {
  const msgs = JSON.parse(readFileSync(join(__dirname, '../../../../../messages/chess/play', `${locale}.json`), 'utf8'))
  for (const b of BOTS)
    for (const k of [b.nameKey, b.sayKey, ...(b.unlock ? [b.hiKey, b.winKey, b.loseKey] : [])])
      assert.equal(typeof msgs[k], 'string', `${locale}: missing ${k}`)
}

// favourite opening: the bot plays its book line while the game follows it, then the engine takes over
const gambit = BOTS.find((b) => b.opening === 'kings-gambit')!
assert.equal(bookMove(gambit, true, []), 'e4', 'white bot opens the line')
assert.equal(bookMove(gambit, true, ['e4', 'e5']), 'f4')
assert.equal(bookMove(gambit, true, ['e4', 'c5']), null, 'opponent left the book')
assert.equal(bookMove(gambit, false, []), null, 'custom start position: no book')
assert.equal(bookMove(getBot('pip')!, true, []), null, 'level bots have no book')

// unlocking: by the badge code from GET /api/chess/profile/me; guests (null) have none
assert.equal(botUnlocked(getBot('pip')!, null), true)
assert.equal(botUnlocked(gambit, null), false)
assert.equal(botUnlocked(gambit, []), false)
assert.equal(botUnlocked(gambit, [gambit.unlock!]), true)

console.log('data ok')
