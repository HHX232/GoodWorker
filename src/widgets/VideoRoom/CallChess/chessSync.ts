import { Chess, DEFAULT_POSITION, validateFen } from 'chess.js'

/** Shared board of a call. The owner holds the source of truth and broadcasts it as `call_chess_state`. */
export type ChessCallState = {
  fen: string
  lastMove: { from: string; to: string } | null
  moveAllowed: 'all' | 'owner'
  seq: number
}

/** `call_chess_move` payload: `seq` is the state the sender saw when moving. */
export type ChessMoveMsg = { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n'; seq: number }

export function initialChessState(): ChessCallState {
  return { fen: DEFAULT_POSITION, lastMove: null, moveAllowed: 'all', seq: 0 }
}

/** Owner side: validate a move (own or a participant's) against the current state. `null` = rejected. */
export function applyChessMove(state: ChessCallState, move: ChessMoveMsg, byOwner: boolean): ChessCallState | null {
  if (!byOwner && state.moveAllowed === 'owner') return null
  if (move.seq !== state.seq) return null // made on a position that is no longer current
  const chess = new Chess(state.fen)
  let played
  try {
    played = chess.move({ from: move.from, to: move.to, promotion: move.promotion })
  } catch {
    return null // illegal move — chess.js throws
  }
  return { ...state, fen: chess.fen(), lastMove: { from: played.from, to: played.to }, seq: state.seq + 1 }
}

/** Participant side: take an incoming `call_chess_state` only if it is well-formed and newer than what we show. */
export function acceptChessState(current: ChessCallState | null, msg: Record<string, unknown>): ChessCallState | null {
  const { fen, lastMove, moveAllowed, seq } = msg
  if (typeof fen !== 'string' || !validateFen(fen).ok) return null
  if (moveAllowed !== 'all' && moveAllowed !== 'owner') return null
  if (typeof seq !== 'number' || (current && seq <= current.seq)) return null
  const lm = lastMove as ChessCallState['lastMove']
  const okMove = lm === null || (typeof lm?.from === 'string' && typeof lm?.to === 'string')
  return okMove ? { fen, lastMove: lm, moveAllowed, seq } : null
}

/** Owner side: put a new position on the board (FEN field or reset). `null` = invalid FEN. */
export function setChessPosition(state: ChessCallState, fen: string): ChessCallState | null {
  const clean = fen.trim()
  if (!validateFen(clean).ok) return null
  return { ...state, fen: new Chess(clean).fen(), lastMove: null, seq: state.seq + 1 }
}
