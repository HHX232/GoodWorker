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
  assert.doesNotMatch(system + user, /strong\b|силён/i) // «strongest move» — факт, а не похвала ходу соперника
  assert.match(system, /not the strongest/)
  assert.doesNotMatch(system + user, /движ|engine/i)
  assert.match(system, /на «ты»/)
  assert.match(system, /«ход соперника»/)
}

// Дебют: книжный ход объясняется по идее, без сравнения с движком и без оценки «ошибка».
{
  const r = validateCoachInput({ ...base, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', playedUci: 'e2e4', bestUci: 'd2d4', pvUci: ['d2d4'], classification: 'inaccuracy', context: 'opening' })
  assert.ok(r.ok)
  const { system, user } = buildCoachPrompt(r.input, r.facts)
  assert.doesNotMatch(system + user, /better|weaker|лучше|inaccuracy|d4/i)
  assert.match(user, /e4/)
}

// Коротко и по делу: 1–2 предложения, похвалы-вступления запрещены; лучший ход — одно предложение об идее.
{
  const played = validateCoachInput({ ...base, fen: 'k7/8/8/3r4/8/8/8/4K2Q w - - 0 1', playedUci: 'h1h5', bestUci: 'h1d5', pvUci: ['h1d5'], classification: 'mistake' })
  assert.ok(played.ok)
  const { system } = buildCoachPrompt(played.input, played.facts)
  assert.match(system, /1–2 short sentences/)
  assert.doesNotMatch(system, /2–4/)
  assert.match(system, /No praise/)
  assert.match(system, /Молодец/) // перечислена в запрете
  const best = validateCoachInput(base) // Qxf7# — сыгран лучший ход
  assert.ok(best.ok)
  assert.match(buildCoachPrompt(best.input, best.facts).system, /ONE sentence/)
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

// G43: мотивы. Белые Ke1 Ra1 Bf2 Ph2, чёрные Kh8 Nd4. После h3? чёрные Nc2+ — вилка короля e1 и ладьи a1, Nxa1.
// Клиент присылает только линию опровержения; мотив сервер считает сам из позиции.
{
  const FORK = '7k/8/8/8/3n4/8/5B1P/R3K3 w Q - 0 1'
  const fork = { ...base, fen: FORK, playedUci: 'h2h3', bestUci: 'f2d4', pvUci: ['f2d4'], classification: 'blunder', evalBeforeCp: 300, evalAfterCp: -250 }
  const r = validateCoachInput({ ...fork, refutationUci: ['d4c2', 'e1d2', 'c2a1'], refutationMate: null })
  assert.ok(r.ok)
  assert.equal(r.facts.why?.reply?.san, 'Nc2+')
  assert.equal(r.facts.why?.motif?.k, 'fork')
  const { system, user } = buildCoachPrompt(r.input, r.facts)
  assert.match(user, /Opponent's best reply: Nc2\+/)
  assert.match(user, /fork: knight on c2 attacks king on e1 and rook on a1/)
  assert.match(user, /loses 5/)
  assert.match(user, /Bxd4\+ .*captures the knight on d4/)
  assert.match(system, /cause .* consequence/i)
  // мусор отсекается: нелегальная линия, не массив, мат не целым числом, слишком длинная линия
  assert.equal(validateCoachInput({ ...fork, refutationUci: ['a1a8'] }).ok, false)
  assert.equal(validateCoachInput({ ...fork, refutationUci: 'd4c2' }).ok, false)
  assert.equal(validateCoachInput({ ...fork, refutationUci: ['d4c2'], refutationMate: 'mate' }).ok, false)
  assert.equal(validateCoachInput({ ...fork, refutationUci: ['d4c2'], refutationMate: 1.5 }).ok, false)
  assert.equal(validateCoachInput({ ...fork, refutationUci: Array(65).fill('d4c2') }).ok, false)
  // без линии опровержения — как раньше: мотивов нет, в промпте нет и строки о них
  const old = validateCoachInput(fork)
  assert.ok(old.ok)
  assert.equal(old.facts.why, null)
  assert.doesNotMatch(buildCoachPrompt(old.input, old.facts).user, /Tactic/)
}

console.log('coachInput ok')
