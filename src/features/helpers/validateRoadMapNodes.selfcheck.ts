// npx tsx src/features/helpers/validateRoadMapNodes.selfcheck.ts → "validateRoadMapNodes chess ok"
import assert from 'node:assert/strict'
import {RoadMapBlockType} from '@/shared/types/RoadMap/RoadMap.types'
import {validateRoadMapNodes} from './validateRoadMapNodes'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorOf = (chess: any) =>
  validateRoadMapNodes([{id: 'n', position: {x: 0, y: 0}, data: {type: RoadMapBlockType.CHESS, inputs: {}, chess}}])[0]?.message ?? null

assert.equal(errorOf({mode: 'puzzle', fen: START, solution: ['e2e4']}), null)
assert.equal(errorOf({mode: 'study', fen: START, moves: [{uci: 'e2e4', comment: 'центр'}, {uci: 'e7e5'}]}), null)
assert.ok(errorOf(undefined), 'node without chess data')
assert.ok(errorOf({mode: 'puzzle', fen: START, solution: []}), 'empty solution')
assert.ok(errorOf({mode: 'puzzle', fen: START, solution: ['e2e5']}), 'illegal solution move')
assert.ok(errorOf({mode: 'puzzle', fen: '8/8/8/8/8/8/8/8 w - - 0 1', solution: ['e2e4']}), 'no kings')
assert.ok(errorOf({mode: 'study', fen: START, moves: [{uci: 'e2e4'}, {uci: 'e2e4'}]}), 'illegal study line')
// a puzzle node keeps an old study line around; only the active mode is validated
assert.equal(errorOf({mode: 'puzzle', fen: START, solution: ['g1f3'], moves: [{uci: 'a1a8'}]}), null)

console.log('validateRoadMapNodes chess ok')
