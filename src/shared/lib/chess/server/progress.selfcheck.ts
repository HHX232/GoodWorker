// npx tsx src/shared/lib/chess/server/progress.selfcheck.ts → "progress ok"
import assert from 'node:assert/strict'
import { applyActivity, BADGE_CODES, EMPTY_PROGRESS, DAILY_BOT_POINTS_CAP, extendVipExpiry, parseActivity, vipExpiryAfterReward, streakState, vipDaysFor, VIP_REWARDS } from './progressModel'

const MSK = -180 // getTimezoneOffset() для Москвы (UTC+3)
const at = (iso: string) => new Date(iso)

// серия: первая активность → 1
let r = applyActivity(EMPTY_PROGRESS, [], { kind: 'puzzle', tzOffsetMin: MSK }, at('2026-10-19T10:00:00Z'))
assert.equal(r.next.streakCurrent, 1)
assert.equal(r.next.lastActiveDay, '2026-10-19')
assert.equal(r.streakChanged, true)

const s5 = { ...EMPTY_PROGRESS, botPoints: 0, streakCurrent: 5, streakBest: 9, lastActiveDay: '2026-10-19' }
// тот же день — без изменений
r = applyActivity(s5, [], { kind: 'puzzle', tzOffsetMin: MSK }, at('2026-10-19T20:00:00Z')) // 23:00 МСК
assert.equal(r.next.streakCurrent, 5)
assert.equal(r.streakChanged, false)
// вчера → +1: 00:30 МСК 20-го — это ещё 19-е по UTC, но день считается в поясе пользователя
r = applyActivity(s5, [], { kind: 'puzzle', tzOffsetMin: MSK }, at('2026-10-19T21:30:00Z'))
assert.equal(r.next.lastActiveDay, '2026-10-20')
assert.equal(r.next.streakCurrent, 6)
assert.equal(r.next.streakBest, 9)
// разрыв в день → 1
r = applyActivity(s5, [], { kind: 'puzzle', tzOffsetMin: MSK }, at('2026-10-21T10:00:00Z'))
assert.equal(r.next.streakCurrent, 1)
assert.equal(r.streakChanged, true)
// смена пояса: последний раз — 19-е в МСК, теперь пользователь в Нью-Йорке (UTC−4), где ещё 18-е → серия не рвётся, день не откатывается
r = applyActivity(s5, [], { kind: 'puzzle', tzOffsetMin: 240 }, at('2026-10-19T02:00:00Z'))
assert.equal(r.next.streakCurrent, 5)
assert.equal(r.next.lastActiveDay, '2026-10-19')
// лучшая серия растёт вместе с текущей
r = applyActivity({ ...EMPTY_PROGRESS, botPoints: 0, streakCurrent: 9, streakBest: 9, lastActiveDay: '2026-10-18' }, [], { kind: 'puzzle', tzOffsetMin: 0 }, at('2026-10-19T12:00:00Z'))
assert.equal(r.next.streakBest, 10)

// очки за бота: победа 10×уровень, ничья 5×уровень, поражение 0
const noon = at('2026-10-19T12:00:00Z')
const bot = (result: 'win' | 'draw' | 'loss', botLevel: number, plies = 40) => ({ kind: 'bot' as const, tzOffsetMin: 0, botLevel, result, plies })
assert.equal(applyActivity(EMPTY_PROGRESS, [], bot('win', 3), noon).next.botPoints, 30)
assert.equal(applyActivity(EMPTY_PROGRESS, [], bot('draw', 8), noon).next.botPoints, 40)
assert.equal(applyActivity(EMPTY_PROGRESS, [], bot('loss', 8), noon).next.botPoints, 0)
assert.equal(applyActivity({ ...EMPTY_PROGRESS, botPoints: 70 }, [], bot('win', 1), noon).next.botPoints, 80)
// < 10 полуходов — партия не засчитывается вовсе: ни очков, ни серии, ни значков
r = applyActivity(EMPTY_PROGRESS, [], bot('win', 5, 9), noon)
assert.equal(r.counted, false)
assert.equal(r.next.botPoints, 0)
assert.equal(r.next.streakCurrent, 0)
assert.deepEqual(r.newBadges, [])
assert.equal(applyActivity(EMPTY_PROGRESS, [], bot('win', 5, 10), noon).next.botPoints, 50)

// значки: первая победа над уровнем, пороги очков, серии, шторм, онлайн
r = applyActivity(EMPTY_PROGRESS, [], bot('win', 1), noon)
assert.deepEqual(r.newBadges, ['first_win_l1'])
assert.deepEqual(applyActivity(EMPTY_PROGRESS, [], bot('draw', 1), noon).newBadges, []) // ничья — не победа
// порог очков: 95 + 10 = 105 → points_100; 490 + 40 (ур. 4) = 530 → points_500 (100 уже есть)
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, botPoints: 95, lastActiveDay: '2026-10-19', streakCurrent: 1 }, ['first_win_l1'], bot('win', 1), noon).newBadges, ['points_100'])
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, botPoints: 490 }, ['first_win_l4', 'points_100'], bot('win', 4), noon).newBadges, ['points_500'])
// 99 → 99: порог не пересечён
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, botPoints: 99 }, [], bot('loss', 3), noon).newBadges, [])
// однократность: уже полученный значок не выдаётся снова, даже если условие выполнено
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, botPoints: 300 }, ['first_win_l2', 'points_100'], bot('win', 2), noon).newBadges, [])
// серия 2 → 3 даёт streak_3; 6 → 7 даёт streak_7
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, streakCurrent: 2, streakBest: 2, lastActiveDay: '2026-10-18' }, [], { kind: 'puzzle', tzOffsetMin: 0 }, noon).newBadges, ['streak_3'])
assert.deepEqual(applyActivity({ ...EMPTY_PROGRESS, streakCurrent: 6, streakBest: 6, lastActiveDay: '2026-10-18' }, ['streak_3'], { kind: 'puzzle', tzOffsetMin: 0 }, noon).newBadges, ['streak_7'])
// шторм: 20 очков сразу даёт оба значка
assert.deepEqual(applyActivity(EMPTY_PROGRESS, [], { kind: 'storm', tzOffsetMin: 0, score: 20 }, noon).newBadges.sort(), ['storm_10', 'storm_20', ].sort())
assert.deepEqual(applyActivity(EMPTY_PROGRESS, [], { kind: 'storm', tzOffsetMin: 0, score: 9 }, noon).newBadges, [])
// онлайн: первая победа
assert.deepEqual(applyActivity(EMPTY_PROGRESS, [], { kind: 'online', tzOffsetMin: 0, result: 'win' }, noon).newBadges, ['online_first_win'])
assert.deepEqual(applyActivity(EMPTY_PROGRESS, [], { kind: 'online', tzOffsetMin: 0, result: 'draw' }, noon).newBadges, [])
assert.equal(applyActivity(EMPTY_PROGRESS, [], { kind: 'online', tzOffsetMin: 0, result: 'win' }, noon).next.botPoints, 0) // онлайн очков бота не даёт

// VIP: плейсхолдер — все null, начисления нет
assert.equal(BADGE_CODES.length, 20)
for (const c of BADGE_CODES) assert.equal(VIP_REWARDS[c], null)
assert.equal(vipDaysFor(['first_win_l1', 'points_100']), 0)
// на фейковой таблице: дни складываются только по значкам с числом
const fake = { first_win_l1: 3, points_100: null, streak_7: 7 }
assert.equal(vipDaysFor(['first_win_l1', 'points_100'], fake), 3)
assert.equal(vipDaysFor(['first_win_l1', 'streak_7'], fake), 10)
assert.equal(vipDaysFor([], fake), 0)
// продление как у промокодов/рефералов: от текущего срока, если он в будущем, иначе от «сейчас»
assert.equal(extendVipExpiry(null, 3, noon).toISOString(), '2026-10-22T12:00:00.000Z')
assert.equal(extendVipExpiry(at('2026-11-01T00:00:00Z'), 3, noon).toISOString(), '2026-11-04T00:00:00.000Z')
assert.equal(extendVipExpiry(at('2026-10-01T00:00:00Z'), 3, noon).toISOString(), '2026-10-22T12:00:00.000Z')

// огонёк: сегодня играл / серия под угрозой (последний раз вчера) / серия прервана
assert.equal(streakState('2026-10-19', '2026-10-19'), 'today')
assert.equal(streakState('2026-10-18', '2026-10-19'), 'threat')
assert.equal(streakState('2026-10-17', '2026-10-19'), 'broken')
assert.equal(streakState(null, '2026-10-19'), 'broken')
assert.equal(streakState('2026-10-20', '2026-10-19'), 'today') // сменил пояс на запад

// валидация тела POST /api/chess/activity
assert.deepEqual(parseActivity({ kind: 'bot', tzOffsetMin: -180, botLevel: 8, result: 'win', plies: 31 }), { kind: 'bot', tzOffsetMin: -180, botLevel: 8, result: 'win', plies: 31 })
assert.equal(parseActivity({ kind: 'bot', tzOffsetMin: 0, botLevel: 9, result: 'win', plies: 31 }), null)
assert.equal(parseActivity({ kind: 'bot', tzOffsetMin: 0, botLevel: 0, result: 'win', plies: 31 }), null)
assert.equal(parseActivity({ kind: 'bot', tzOffsetMin: 0, botLevel: 2, result: 'won', plies: 31 }), null)
assert.equal(parseActivity({ kind: 'bot', tzOffsetMin: 0, botLevel: 2, plies: 31 }), null)
assert.equal(parseActivity({ kind: 'chess960', tzOffsetMin: 0 }), null)
assert.equal(parseActivity({ kind: 'puzzle', tzOffsetMin: 2000 }), null) // пояса бывают от −14 до +12 ч
assert.equal(parseActivity(null), null)
assert.deepEqual(parseActivity({ kind: 'puzzle', tzOffsetMin: 0, botLevel: 3 }), { kind: 'puzzle', tzOffsetMin: 0 }) // лишнее отбрасывается
assert.deepEqual(parseActivity({ kind: 'storm', tzOffsetMin: 0, score: 12 }), { kind: 'storm', tzOffsetMin: 0, score: 12 })

// пояс фиксируется на сутки: тот же момент с UTC−12 (+720) и UTC+14 (−840) — разные календарные дни, но серия +1 один раз
const t0 = at('2026-10-19T12:00:00Z') // 00:00 19-го в UTC−12, 02:00 20-го в UTC+14
r = applyActivity(EMPTY_PROGRESS, [], { kind: 'puzzle', tzOffsetMin: 720 }, t0)
assert.equal(r.next.streakCurrent, 1)
assert.equal(r.next.tzOffsetMin, 720)
const r2 = applyActivity(r.next, [], { kind: 'puzzle', tzOffsetMin: -840 }, t0)
assert.equal(r2.next.streakCurrent, 1)
assert.equal(r2.streakChanged, false)
assert.equal(r2.next.tzOffsetMin, 720)
// через сутки после фиксации новый пояс принимается
const later = at('2026-10-20T12:30:00Z')
const r3 = applyActivity(r.next, [], { kind: 'puzzle', tzOffsetMin: -840 }, later) // 02:30 21-го в UTC+14
assert.equal(r3.next.tzOffsetMin, -840)
assert.equal(r3.next.lastActiveDay, '2026-10-21')
assert.equal(r3.next.streakCurrent, 1) // 19 → 21: разрыв, а не две «вчера» подряд

// дневной потолок очков за ботов
assert.equal(DAILY_BOT_POINTS_CAP, 300)
const capped = { ...EMPTY_PROGRESS, botPoints: 1000, pointsDay: '2026-10-19', pointsToday: 280, tzOffsetMin: 0, tzSetAt: '2026-10-19T00:00:00.000Z', lastActiveDay: '2026-10-19', streakCurrent: 1, streakBest: 1 }
r = applyActivity(capped, [], bot('win', 3), noon) // +30, но до потолка осталось 20
assert.equal(r.next.botPoints, 1020)
assert.equal(r.next.pointsToday, 300)
assert.equal(applyActivity(r.next, [], bot('win', 8), noon).next.botPoints, 1020) // потолок исчерпан
r = applyActivity(r.next, [], bot('win', 3), at('2026-10-20T12:00:00Z')) // новый день — счёт с нуля
assert.equal(r.next.botPoints, 1050)
assert.equal(r.next.pointsToday, 30)

// бессрочный VIP не превращается в срочный; без VIP или со сроком — продление
assert.equal(vipExpiryAfterReward({ isVip: true, vipExpiresAt: null }, 3, noon), null)
assert.equal(vipExpiryAfterReward({ isVip: false, vipExpiresAt: null }, 3, noon)?.toISOString(), '2026-10-22T12:00:00.000Z')
assert.equal(vipExpiryAfterReward({ isVip: true, vipExpiresAt: at('2026-11-01T00:00:00Z') }, 3, noon)?.toISOString(), '2026-11-04T00:00:00.000Z')

console.log('progress ok')
