// Чистое ядро онлайн-партий (T12): часы, ходы, окончания, ничья/сдача/отмена, Эло, подбор. Без Prisma — проверяется selfcheck.
import { Chess } from 'chess.js'

export type Side = 'w' | 'b'
export type GameResult = '1-0' | '0-1' | '1/2-1/2'

export function parseTimeControl(tc: unknown): { baseMs: number; incMs: number } | null {
  const m = typeof tc === 'string' ? /^(\d{1,2})\+(\d{1,2})$/.exec(tc) : null
  if (!m) return null
  const base = Number(m[1])
  const inc = Number(m[2])
  return base >= 1 && base <= 60 && inc <= 30 ? { baseMs: base * 60_000, incMs: inc * 1000 } : null
}

export const ELO_K = 32

/** Изменение Эло обоих (K=32). */
export function eloDeltas(white: number, black: number, result: GameResult) {
  const expected = 1 / (1 + 10 ** ((black - white) / 400))
  const score = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5
  const d = Math.round(ELO_K * (score - expected))
  return { white: d, black: -d || 0 }
}

export type GameStatus = 'waiting' | 'active' | 'finished' | 'aborted'
/** Поля партии, которые меняет ядро (подмножество строки ChessGame). */
export type OnlineGame = {
  initialFen: string
  moves: string // UCI через пробел
  timeControl: string
  whiteMs: number
  blackMs: number
  turnStartedAt: Date | null
  status: GameStatus
  result: GameResult | null
  termination: string | null
  drawOfferBy: Side | null
}
export type GamePatch = Partial<OnlineGame>
export type MoveError = 'NOT_ACTIVE' | 'STALE' | 'NOT_YOUR_TURN' | 'ILLEGAL' | 'GAME_OVER'

/** До 2-го полухода часы стоят, партию можно отменить; столько ждём первый ход, потом партия отменяется сама. */
export const UNTIMED_PLIES = 2
export const FIRST_MOVE_TIMEOUT_MS = 60_000

export const moveList = (g: Pick<OnlineGame, 'moves'>) => (g.moves ? g.moves.split(' ') : [])
export const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')
const winOf = (s: Side): GameResult => (s === 'w' ? '1-0' : '0-1')

export function sideToMove(g: Pick<OnlineGame, 'initialFen' | 'moves'>): Side {
  const first: Side = g.initialFen.split(' ')[1] === 'b' ? 'b' : 'w'
  return moveList(g).length % 2 ? other(first) : first
}

export function replay(g: Pick<OnlineGame, 'initialFen' | 'moves'>): Chess {
  const chess = new Chess(g.initialFen)
  for (const uci of moveList(g)) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  return chess
}

/** Часы на момент now: идут только у стороны хода, только в активной партии после первых двух полуходов. */
export function clocksAt(g: OnlineGame, now: Date): { whiteMs: number; blackMs: number } {
  const c = { whiteMs: g.whiteMs, blackMs: g.blackMs }
  if (g.status !== 'active' || !g.turnStartedAt || moveList(g).length < UNTIMED_PLIES) return c
  const spent = Math.max(0, now.getTime() - g.turnStartedAt.getTime())
  if (sideToMove(g) === 'w') c.whiteMs = Math.max(0, c.whiteMs - spent)
  else c.blackMs = Math.max(0, c.blackMs - spent)
  return c
}

/** Сторона не может поставить мат ничем: один король или король с одной лёгкой фигурой. */
function cannotMate(chess: Chess, side: Side): boolean {
  const pieces = chess.board().flat().filter((p) => p && p.color === side && p.type !== 'k')
  return pieces.length === 0 || (pieces.length === 1 && (pieces[0]!.type === 'n' || pieces[0]!.type === 'b'))
}

/** Окончание по времени или «первый ход не сделан» — проверяется и при чтении. null — партия идёт. */
export function settle(g: OnlineGame, now: Date): GamePatch | null {
  if (g.status !== 'active' || !g.turnStartedAt) return null
  if (moveList(g).length < UNTIMED_PLIES)
    return now.getTime() - g.turnStartedAt.getTime() > FIRST_MOVE_TIMEOUT_MS
      ? { status: 'aborted', termination: 'no_start', drawOfferBy: null }
      : null
  const c = clocksAt(g, now)
  const side = sideToMove(g)
  if ((side === 'w' ? c.whiteMs : c.blackMs) > 0) return null
  const draw = cannotMate(replay(g), other(side))
  return { ...c, status: 'finished', result: draw ? '1/2-1/2' : winOf(other(side)), termination: 'timeout', drawOfferBy: null }
}

function endOf(chess: Chess, mover: Side): GamePatch | null {
  const end = (result: GameResult, termination: string): GamePatch => ({ status: 'finished', result, termination, drawOfferBy: null })
  if (chess.isCheckmate()) return end(winOf(mover), 'checkmate')
  if (chess.isStalemate()) return end('1/2-1/2', 'stalemate')
  if (chess.isInsufficientMaterial()) return end('1/2-1/2', 'insufficient')
  if (chess.isThreefoldRepetition()) return end('1/2-1/2', 'repetition')
  if (chess.isDrawByFiftyMoves()) return end('1/2-1/2', 'fifty')
  return null
}

/**
 * Ход стороны side. ply — число ходов, которое видел клиент: второй ход с тем же ply получает STALE.
 * GAME_OVER несёт patch (флаг/отмена, найденные при попытке хода) — его нужно сохранить.
 */
export function applyMove(
  g: OnlineGame,
  side: Side,
  uci: string,
  ply: number,
  now: Date,
): { ok: true; patch: GamePatch } | { ok: false; error: MoveError; patch?: GamePatch } {
  if (g.status !== 'active') return { ok: false, error: 'NOT_ACTIVE' }
  const settled = settle(g, now)
  if (settled) return { ok: false, error: 'GAME_OVER', patch: settled }
  const list = moveList(g)
  if (ply !== list.length) return { ok: false, error: 'STALE' }
  if (sideToMove(g) !== side) return { ok: false, error: 'NOT_YOUR_TURN' }
  const chess = replay(g)
  let played: string
  try {
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    played = m.from + m.to + (m.promotion ?? '')
  } catch {
    return { ok: false, error: 'ILLEGAL' }
  }
  const c = clocksAt(g, now)
  if (list.length >= UNTIMED_PLIES) {
    const inc = parseTimeControl(g.timeControl)?.incMs ?? 0
    if (side === 'w') c.whiteMs += inc
    else c.blackMs += inc
  }
  return {
    ok: true,
    patch: {
      moves: [...list, played].join(' '),
      ...c,
      turnStartedAt: now,
      drawOfferBy: g.drawOfferBy === side ? side : null, // ход соперника отклоняет его предложение ничьей
      ...endOf(chess, side),
    },
  }
}

export type GameAction = 'resign' | 'offer' | 'accept' | 'decline' | 'abort'
export const GAME_ACTIONS: GameAction[] = ['resign', 'offer', 'accept', 'decline', 'abort']

/** Сдача, ничья (предложить/принять/отклонить), отмена до 2-го полухода (или ожидающей партии). */
export function applyAction(
  g: OnlineGame,
  side: Side,
  action: GameAction,
  now: Date,
): { ok: true; patch: GamePatch } | { ok: false; error: 'NOT_ACTIVE' | 'NO_OFFER' | 'TOO_LATE' | 'GAME_OVER'; patch?: GamePatch } {
  if (action === 'abort' && g.status === 'waiting') return { ok: true, patch: { status: 'aborted', termination: 'abort', drawOfferBy: null } }
  if (g.status !== 'active') return { ok: false, error: 'NOT_ACTIVE' }
  const settled = settle(g, now)
  if (settled) return { ok: false, error: 'GAME_OVER', patch: settled }
  const finish = (result: GameResult, termination: string): GamePatch => ({ ...clocksAt(g, now), status: 'finished', result, termination, drawOfferBy: null })
  switch (action) {
    case 'abort':
      return moveList(g).length < UNTIMED_PLIES
        ? { ok: true, patch: { status: 'aborted', termination: 'abort', drawOfferBy: null } }
        : { ok: false, error: 'TOO_LATE' }
    case 'resign':
      return { ok: true, patch: finish(winOf(other(side)), 'resign') }
    case 'offer':
      return { ok: true, patch: { drawOfferBy: g.drawOfferBy ?? side } }
    case 'accept':
      return g.drawOfferBy === other(side) ? { ok: true, patch: finish('1/2-1/2', 'agreement') } : { ok: false, error: 'NO_OFFER' }
    case 'decline':
      return g.drawOfferBy === other(side) ? { ok: true, patch: { drawOfferBy: null } } : { ok: false, error: 'NO_OFFER' }
  }
}

// ─── подбор ───────────────────────────────────────────────────────────────────
export type SeekRow = { userId: string; timeControl: string; rating: number; createdAt: Date }

/** Окно рейтинга: ±200, расширяется на 100 за каждые 10 с ожидания. */
export const seekWindow = (waitedMs: number) => 200 + 100 * Math.floor(Math.max(0, waitedMs) / 10_000)

/** Чужой seek того же контроля в окне (по дольше ждущему из пары), ближайший по рейтингу, при равенстве — старший. */
export function pickOpponent(me: SeekRow, seeks: SeekRow[], now: Date): string | null {
  const t = now.getTime()
  const fit = seeks
    .filter((s) => s.userId !== me.userId && s.timeControl === me.timeControl)
    .filter((s) => Math.abs(s.rating - me.rating) <= seekWindow(t - Math.min(s.createdAt.getTime(), me.createdAt.getTime())))
    .sort((a, b) => Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating) || a.createdAt.getTime() - b.createdAt.getTime())
  return fit[0]?.userId ?? null
}
