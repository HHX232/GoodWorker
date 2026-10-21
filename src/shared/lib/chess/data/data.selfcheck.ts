// npx tsx src/shared/lib/chess/data/data.selfcheck.ts → "data ok"
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'
import { OPENINGS, TACTICS, BOTS, bookMove, getBot } from '.'
import { BADGE_CODES } from '../server/progressModel'
import { SKINS, skinOpen } from '../../../../widgets/Chess/skins'

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

// G23: 8 level bots (one per engine level) + 5 special characters with a favourite opening — all open to everyone
assert.equal(new Set(BOTS.map((b) => b.id)).size, BOTS.length, 'bot ids unique')
assert.equal(BOTS.length, 13)
for (const b of BOTS) assert.ok(!('unlock' in b), `${b.id}: bots are not locked any more`)
assert.deepEqual(BOTS.filter((b) => !b.opening).map((b) => b.level), [1, 2, 3, 4, 5, 6, 7, 8])
const special = BOTS.filter((b) => b.opening)
assert.equal(special.length, 5)
for (const b of special) assert.ok(OPENINGS.some((o) => o.id === b.opening), `${b.id}: unknown opening ${b.opening}`)
for (const locale of ['ru', 'en', 'hi', 'zh']) {
  const msgs = JSON.parse(readFileSync(join(__dirname, '../../../../../messages/chess/play', `${locale}.json`), 'utf8'))
  for (const b of BOTS)
    for (const k of [b.nameKey, b.sayKey, ...(b.opening ? [b.hiKey, b.winKey, b.loseKey] : [])])
      assert.equal(typeof msgs[k], 'string', `${locale}: missing ${k}`)
}

// favourite opening: the bot plays its book line while the game follows it, then the engine takes over
const gambit = BOTS.find((b) => b.opening === 'kings-gambit')!
assert.equal(bookMove(gambit, true, []), 'e4', 'white bot opens the line')
assert.equal(bookMove(gambit, true, ['e4', 'e5']), 'f4')
assert.equal(bookMove(gambit, true, ['e4', 'c5']), null, 'opponent left the book')
assert.equal(bookMove(gambit, false, []), null, 'custom start position: no book')
assert.equal(bookMove(getBot('pip')!, true, []), null, 'level bots have no book')

// G24: reward cosmetics — ≥4 piece sets and ≥4 board colourings, each opened by an existing badge; the 6 old skins open to all
assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length, 'skin ids unique')
const rewards = SKINS.filter((s) => s.unlock)
assert.ok(rewards.filter((s) => s.only !== 'board').length >= 4, 'reward piece sets')
assert.ok(rewards.filter((s) => s.only !== 'pieces').length >= 4, 'reward boards')
for (const s of rewards) assert.ok(BADGE_CODES.includes(s.unlock!), `${s.id}: unknown badge ${s.unlock}`)
assert.deepEqual(SKINS.filter((s) => !s.unlock).map((s) => s.id), ['classic', 'vintage', 'night', 'bordo', 'powder', 'wireframe',
  'monsters', 'vikings', 'candy', 'lair', 'fjord', 'sweets'])
// G37: each themed set names the board it was drawn for — a board colouring, open to all
for (const [set, board] of [['monsters', 'lair'], ['vikings', 'fjord'], ['candy', 'sweets']] as const) {
  const s = SKINS.find((x) => x.id === set)!
  assert.equal(s.only, 'pieces', `${set}: a piece set`)
  assert.equal(s.pair, board, `${set}: paired with ${board}`)
  assert.equal(SKINS.find((x) => x.id === board)?.only, 'board', `${board}: a board colouring`)
}
for (const locale of ['ru', 'en', 'hi', 'zh']) {
  const msgs = JSON.parse(readFileSync(join(__dirname, '../../../../../messages/chess/core', `${locale}.json`), 'utf8'))
  for (const s of SKINS) assert.equal(typeof msgs[s.labelKey], 'string', `${locale}: missing ${s.labelKey}`)
}
// opened by the badge codes from GET /api/chess/profile/me; a guest (null) has none
const gold = rewards[0]
assert.equal(skinOpen(SKINS[0], null), true)
assert.equal(skinOpen(gold, null), false)
assert.equal(skinOpen(gold, ['first_win_l1']), false)
assert.equal(skinOpen(gold, [gold.unlock!]), true)

console.log('data ok')
