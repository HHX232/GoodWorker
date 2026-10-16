// npx tsx src/shared/lib/chess/server/coachInput.selfcheck.ts → "coachInput ok"
import assert from 'node:assert/strict'
import { buildCoachPrompt, validateCoachInput } from './coachInput'

// Детский мат: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? — белые ставят мат Qxf7#.
const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
const base = {
  fen: SCHOLAR, playedUci: 'h5f7', bestUci: 'h5f7', pvUci: ['h5f7'], classification: 'best',
  evalBeforeCp: 100000, evalAfterCp: 100000, context: 'game', locale: 'ru',
}

{
  const r = validateCoachInput(base)
  assert.ok(r.ok)
  assert.equal(r.facts.playedSan, 'Qxf7#')
  assert.equal(r.facts.bestSan, 'Qxf7#')
  assert.deepEqual(r.facts.pvSan, ['Qxf7#'])
  assert.equal(r.facts.captured, 'p')
  assert.equal(r.facts.check, true)
  assert.equal(r.facts.mate, true)
  assert.equal(r.facts.materialBefore, 0) // белые − чёрные, в пешках
  assert.equal(r.facts.materialAfter, 1)
}

// Ферзь уходит на h5 под удар ладьи d5 — без защиты; лучше было Qxd5+.
{
  const r = validateCoachInput({ ...base, fen: 'k7/8/8/3r4/8/8/8/4K2Q w - - 0 1', playedUci: 'h1h5', bestUci: 'h1d5', pvUci: ['h1d5'] })
  assert.ok(r.ok)
  assert.deepEqual(r.facts.attackedAfter, [{ square: 'h5', piece: 'q', defended: false }])
  assert.equal(r.facts.captured, null)
  assert.equal(r.facts.bestSan, 'Qxd5+') // по диагонали шах королю a8
  assert.equal(r.facts.check, false)
}

// Ладья a1→d1 встаёт под удар ладьи d5 (d4–d2 пусты), но её защищает король e1 (соседнее поле).
{
  const r = validateCoachInput({ ...base, fen: 'k7/8/8/3r4/8/8/8/R3K3 w - - 0 1', playedUci: 'a1d1', bestUci: 'a1d1', pvUci: ['a1d1'] })
  assert.ok(r.ok)
  assert.equal(r.facts.playedSan, 'Rd1')
  assert.deepEqual(r.facts.attackedAfter, [{ square: 'd1', piece: 'r', defended: true }])
}

// Ход движка-соперника с ошибкой: промпт не должен просить объяснить, чем ход «силён».
{
  const r = validateCoachInput({ ...base, fen: 'k7/8/8/3r4/8/8/8/4K2Q w - - 0 1', playedUci: 'h1h5', bestUci: 'h1d5', pvUci: ['h1d5'], classification: 'mistake', context: 'engine-move' })
  assert.ok(r.ok)
  const { system, user } = buildCoachPrompt(r.input, r.facts)
  assert.doesNotMatch(system + user, /strong|силён/i)
  assert.match(system, /weaker/)
}

// Дебют: книжный ход объясняется по идее, без сравнения с движком и без оценки «ошибка».
{
  const r = validateCoachInput({ ...base, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playedUci: 'e2e4', bestUci: 'd2d4', pvUci: ['d2d4'], classification: 'inaccuracy', context: 'opening' })
  assert.ok(r.ok)
  const { system, user } = buildCoachPrompt(r.input, r.facts)
  assert.doesNotMatch(system + user, /better|weaker|лучше|inaccuracy|d4/i)
  assert.match(user, /e4/)
}

// Отказы: нелегальный ход, мусорный FEN, неизвестный enum, нелегальная линия.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const opening = { ...base, fen: START, playedUci: 'e2e4', bestUci: 'd2d4', pvUci: ['d2d4'] }
assert.ok(validateCoachInput(opening).ok)
assert.equal(validateCoachInput({ ...opening, playedUci: 'e2e5' }).ok, false)
assert.equal(validateCoachInput({ ...opening, bestUci: 'e7e5' }).ok, false) // ход не той стороны
assert.equal(validateCoachInput({ ...opening, fen: 'not a fen' }).ok, false)
assert.equal(validateCoachInput({ ...opening, classification: 'brilliant' }).ok, false)
assert.equal(validateCoachInput({ ...opening, context: 'chat' }).ok, false)
assert.equal(validateCoachInput({ ...opening, locale: 'de' }).ok, false)
assert.equal(validateCoachInput({ ...opening, evalBeforeCp: 'x' }).ok, false)
assert.equal(validateCoachInput({ ...opening, pvUci: ['d2d4', 'd2d4'] }).ok, false)
assert.equal(validateCoachInput(null).ok, false)

// Линия обрезается до 8 ходов: 10 легальных ходов конями туда-обратно → 8 SAN.
{
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6']
  const r = validateCoachInput({ ...opening, bestUci: 'g1f3', pvUci: shuffle })
  assert.ok(r.ok)
  assert.deepEqual(r.facts.pvSan, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'])
  assert.equal(r.input.pvUci.length, 8)
}

console.log('coachInput ok')
