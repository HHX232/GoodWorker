// npx tsx src/shared/lib/chess/server/online.selfcheck.ts → "online ok"
import assert from 'node:assert/strict'
import { applyAction, applyMove, clocksAt, eloDeltas, parseTimeControl, pickOpponent, seekWindow, settle, type OnlineGame } from './online'

// контроль времени
assert.deepEqual(parseTimeControl('3+2'), { baseMs: 180_000, incMs: 2_000 })
assert.deepEqual(parseTimeControl('1+0'), { baseMs: 60_000, incMs: 0 })
assert.equal(parseTimeControl('0+5'), null)
assert.equal(parseTimeControl('abc'), null)

// Эло, K=32: равные — победа ±16, ничья 0; 1200 против 1600, победа слабого: E = 1/(1+10) ≈ 0.0909 → 32·0.909 ≈ +29
assert.deepEqual(eloDeltas(1500, 1500, '1-0'), { white: 16, black: -16 })
assert.deepEqual(eloDeltas(1500, 1500, '1/2-1/2'), { white: 0, black: 0 })
assert.deepEqual(eloDeltas(1200, 1600, '1-0'), { white: 29, black: -29 })
assert.deepEqual(eloDeltas(1200, 1600, '0-1'), { white: -3, black: 3 }) // 32·0.0909 ≈ 2.9

// ход с часами: первые два полухода без времени, дальше списание с turnStartedAt и инкремент
const T0 = new Date('2026-10-19T10:00:00Z')
const sec = (n: number) => new Date(T0.getTime() + n * 1000)
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const fresh: OnlineGame = { initialFen: START, moves: '', timeControl: '3+2', whiteMs: 180_000, blackMs: 180_000, turnStartedAt: T0, status: 'active', result: null, termination: null, drawOfferBy: null }
const play = (g: OnlineGame, side: 'w' | 'b', uci: string, at: Date) => {
  const r = applyMove(g, side, uci, g.moves ? g.moves.split(' ').length : 0, at)
  assert.ok(r.ok, `${uci}: ${JSON.stringify(r)}`)
  return { ...g, ...r.patch }
}
let g = play(fresh, 'w', 'e2e4', sec(30))
assert.equal(g.whiteMs, 180_000) // первый ход не тратит время
assert.equal(g.moves, 'e2e4')
g = play(g, 'b', 'e7e5', sec(50))
assert.equal(g.blackMs, 180_000)
g = play(g, 'w', 'g1f3', sec(60)) // 10 с на ход: 180 − 10 + 2
assert.equal(g.whiteMs, 172_000)
assert.equal(g.blackMs, 180_000)
assert.deepEqual(g.turnStartedAt, sec(60))
// права и гонки
assert.deepEqual(applyMove(g, 'w', 'b1c3', 3, sec(61)), { ok: false, error: 'NOT_YOUR_TURN' })
assert.deepEqual(applyMove(g, 'b', 'b8c6', 2, sec(61)), { ok: false, error: 'STALE' }) // второй одновременный ход с тем же ply
assert.deepEqual(applyMove(g, 'b', 'e5e4', 3, sec(61)), { ok: false, error: 'ILLEGAL' })
assert.deepEqual(applyMove({ ...g, status: 'finished' }, 'b', 'b8c6', 3, sec(61)), { ok: false, error: 'NOT_ACTIVE' })

// флаг: у чёрных 180 с, ход чёрных с 60-й секунды → на 239-й ещё идёт, на 241-й — время вышло, белые выиграли
assert.equal(settle(g, sec(239)), null)
assert.deepEqual(clocksAt(g, sec(239)), { whiteMs: 172_000, blackMs: 1_000 })
assert.deepEqual(settle(g, sec(241)), { whiteMs: 172_000, blackMs: 0, status: 'finished', result: '1-0', termination: 'timeout', drawOfferBy: null })
// ход после флага не принимается, а флаг возвращается на сохранение
const late = applyMove(g, 'b', 'b8c6', 3, sec(241))
assert.equal(late.ok, false)
assert.equal(!late.ok && late.error, 'GAME_OVER')
assert.equal(!late.ok && late.patch?.result, '1-0')
// флаг при голом короле соперника — ничья: у белых только король, у чёрных ферзь, время вышло у чёрных
const bare: OnlineGame = { ...fresh, initialFen: '8/8/8/4k3/8/8/3q4/K7 b - - 0 60', moves: 'd2d3 a1b2', turnStartedAt: T0, blackMs: 5_000 }
assert.equal(settle(bare, sec(6))?.result, '1/2-1/2')
// первый ход не сделан за минуту — партия отменяется без результата
assert.equal(settle(fresh, sec(59)), null)
assert.deepEqual(settle(fresh, sec(61)), { status: 'aborted', termination: 'no_start', drawOfferBy: null })

// окончания: детский мат (f3 e5 g4 Qh4#) — чёрные выиграли
let m: OnlineGame = fresh
for (const [i, uci] of ['f2f3', 'e7e5', 'g2g4', 'd8h4'].entries()) m = play(m, i % 2 ? 'b' : 'w', uci, sec(i + 1))
assert.equal(m.status, 'finished')
assert.equal(m.result, '0-1')
assert.equal(m.termination, 'checkmate')
// пат: белые Qc7?? — у чёрного короля на a8 нет ходов
const pat = play({ ...fresh, initialFen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1' }, 'w', 'c1c7', sec(1))
assert.equal(pat.result, '1/2-1/2')
assert.equal(pat.termination, 'stalemate')
// недостаточно материала: взятие последней фигуры → K против K
const ins = play({ ...fresh, initialFen: 'k7/8/8/8/8/8/1n6/K7 w - - 0 1' }, 'w', 'a1b2', sec(1))
assert.equal(ins.termination, 'insufficient')
// 50 ходов: счётчик 99 полуходов, тихий ход короля
const fifty = play({ ...fresh, initialFen: 'k7/8/8/8/8/8/1R6/K7 w - - 99 80' }, 'w', 'a1a2', sec(1))
assert.equal(fifty.termination, 'fifty')
// троекратное повторение: кони туда-обратно дважды
let rep: OnlineGame = fresh
for (const [i, uci] of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'].entries()) rep = play(rep, i % 2 ? 'b' : 'w', uci, sec(i + 1))
assert.equal(rep.termination, 'repetition')
assert.equal(rep.result, '1/2-1/2')

// сдача: выигрывает соперник; часы фиксируются на момент сдачи
assert.deepEqual(applyAction(g, 'b', 'resign', sec(70)), { ok: true, patch: { whiteMs: 172_000, blackMs: 170_000, status: 'finished', result: '1-0', termination: 'resign', drawOfferBy: null } })
// ничья: предложить → соперник принимает; своё предложение принять нельзя; отклонить может только соперник
const offered = { ...g, ...(applyAction(g, 'w', 'offer', sec(61)) as { patch: object }).patch }
assert.equal(offered.drawOfferBy, 'w')
assert.deepEqual(applyAction(offered, 'w', 'accept', sec(62)), { ok: false, error: 'NO_OFFER' })
const agreed = applyAction(offered, 'b', 'accept', sec(62))
assert.ok(agreed.ok && agreed.patch.result === '1/2-1/2' && agreed.patch.termination === 'agreement')
assert.deepEqual(applyAction(offered, 'b', 'decline', sec(62)), { ok: true, patch: { drawOfferBy: null } })
assert.equal(play(offered, 'b', 'b8c6', sec(63)).drawOfferBy, null) // ход соперника = отказ
// отмена: до 2-го полухода можно, после — нет; ожидающую партию отменяет любой участник
assert.deepEqual(applyAction(fresh, 'b', 'abort', sec(5)), { ok: true, patch: { status: 'aborted', termination: 'abort', drawOfferBy: null } })
assert.deepEqual(applyAction(g, 'w', 'abort', sec(61)), { ok: false, error: 'TOO_LATE' })
assert.ok(applyAction({ ...fresh, status: 'waiting', turnStartedAt: null }, 'w', 'abort', sec(5)).ok)
assert.deepEqual(applyAction({ ...fresh, status: 'waiting', turnStartedAt: null }, 'w', 'resign', sec(5)), { ok: false, error: 'NOT_ACTIVE' })
// действие после флага — партия уже окончена по времени
const lateResign = applyAction(g, 'b', 'resign', sec(300))
assert.ok(!lateResign.ok && lateResign.error === 'GAME_OVER' && lateResign.patch?.termination === 'timeout')

// подбор: окно ±200, +100 за каждые 10 с ожидания (берётся дольше ждущий из двух); выбирается ближайший по рейтингу
assert.equal(seekWindow(0), 200)
assert.equal(seekWindow(25_000), 400)
const me = { userId: 'me', timeControl: '3+2', rating: 1200, createdAt: sec(0) }
const seeks = [
  { userId: 'far', timeControl: '3+2', rating: 1500, createdAt: sec(0) },
  { userId: 'near', timeControl: '3+2', rating: 1350, createdAt: sec(0) },
  { userId: 'other-tc', timeControl: '1+0', rating: 1200, createdAt: sec(0) },
  { userId: 'me', timeControl: '3+2', rating: 1200, createdAt: sec(0) },
]
assert.equal(pickOpponent(me, seeks, sec(0)), 'near')
assert.equal(pickOpponent(me, seeks.filter((s) => s.userId !== 'near'), sec(0)), null) // 300 > 200
assert.equal(pickOpponent(me, seeks.filter((s) => s.userId !== 'near'), sec(10)), 'far') // ждали 10 с → окно 300
assert.equal(pickOpponent(me, [{ ...seeks[0], createdAt: sec(-10) }], sec(0)), 'far') // соперник ждёт дольше — окно по нему

console.log('online ok')
