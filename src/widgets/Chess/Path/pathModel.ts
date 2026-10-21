// Путь задач (G30): ступень = одна задача, 20 ступеней = уровень (своя «местность»), сложность растёт по ступеням.
// Пройдено ступеней = решено задач начисто (ChessProfile.solved у вошедшего, localStorage у гостя).

export const LEVEL_SIZE = 20
export const PATH_START = 800
export const PATH_STEP = 8
export const PATH_MAX_RATING = 2400

export type PathStep = { step: number; level: number; inLevel: number; minRating: number }

/** Ступень (с 1) → уровень, номер в уровне (1..20) и нижняя граница рейтинга задачи. */
export function pathStep(step: number): PathStep {
  const i = Math.max(1, Math.floor(step)) - 1
  return {
    step: i + 1,
    level: Math.floor(i / LEVEL_SIZE) + 1,
    inLevel: (i % LEVEL_SIZE) + 1,
    minRating: Math.min(PATH_MAX_RATING, PATH_START + PATH_STEP * i),
  }
}

export type PathPos = { current: PathStep; done: number; pct: number; toNext: number }

/** Решено `solved` ступеней → текущая ступень и прогресс внутри её уровня. */
export function pathAt(solved: number): PathPos {
  const n = Number.isFinite(solved) ? Math.max(0, Math.floor(solved)) : 0
  const done = n % LEVEL_SIZE
  return { current: pathStep(n + 1), done, pct: Math.round((done / LEVEL_SIZE) * 100), toNext: LEVEL_SIZE - done }
}

/** Решено было `before`, стало `after`: номер нового уровня, если граница уровня пройдена, иначе null. */
export function levelUp(before: number, after: number): number | null {
  const a = pathAt(before).current.level
  const b = pathAt(after).current.level
  return b > a ? b : null
}

const PIECES = ['P', 'N', 'B', 'R', 'Q', 'K'] as const
export type PathPiece = (typeof PIECES)[number]
/** Фишка путника на уровне: пешка «превращается» с каждым уровнем, с 6-го — король. */
export const levelPiece = (level: number): PathPiece => PIECES[Math.min(PIECES.length, Math.max(1, level)) - 1]

export const TERRAINS = ['meadow', 'shore', 'autumn', 'snow', 'night'] as const
export type Terrain = (typeof TERRAINS)[number]
export const levelTerrain = (level: number): Terrain => TERRAINS[(Math.max(1, level) - 1) % TERRAINS.length]
