// npx tsx src/widgets/Chess/Path/pathModel.selfcheck.ts → "path ok"
import assert from 'node:assert/strict'
import { levelPiece, levelTerrain, levelUp, pathAt, pathStep } from './pathModel'

// ступень → уровень / номер в уровне / сложность (20 ступеней на уровень, 800 + 8 × (ступень − 1))
assert.deepEqual(pathStep(1), { step: 1, level: 1, inLevel: 1, minRating: 800 })
assert.deepEqual(pathStep(20), { step: 20, level: 1, inLevel: 20, minRating: 952 })
assert.deepEqual(pathStep(21), { step: 21, level: 2, inLevel: 1, minRating: 960 })

// сложность упирается в потолок 2400
assert.equal(pathStep(300).minRating, 2400)

// решено N → текущая ступень N+1, прогресс до следующего уровня
assert.deepEqual(pathAt(0), { current: pathStep(1), done: 0, pct: 0, toNext: 20 })
assert.deepEqual(pathAt(25), { current: pathStep(26), done: 5, pct: 25, toNext: 15 })
assert.deepEqual(pathAt(19), { current: pathStep(20), done: 19, pct: 95, toNext: 1 })
assert.deepEqual(pathAt(20).current.level, 2) // 20 решено — уже второй уровень, полоса с нуля
assert.equal(pathAt(20).done, 0)
assert.deepEqual(pathAt(-3), pathAt(0)) // мусор из localStorage

// переход уровня: решение 20-й ступени открывает уровень 2, остальные — нет
assert.equal(levelUp(19, 20), 2)
assert.equal(levelUp(39, 40), 3)
assert.equal(levelUp(20, 21), null)
assert.equal(levelUp(5, 6), null)
assert.equal(levelUp(6, 6), null)
assert.equal(levelUp(18, 41), 3) // скачок (пришёл свежий счёт с сервера) — последний открытый уровень

// фишка путника «повышается» с уровнем: пешка → конь → слон → ладья → ферзь → король (дальше король)
assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(levelPiece), ['P', 'N', 'B', 'R', 'Q', 'K', 'K'])
// местности по кругу из пяти
assert.deepEqual([1, 2, 3, 4, 5, 6, 11].map(levelTerrain), ['meadow', 'shore', 'autumn', 'snow', 'night', 'meadow', 'meadow'])

console.log('path ok')
