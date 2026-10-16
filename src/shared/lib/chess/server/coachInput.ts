// Чистый шов POST /api/chess/coach: валидация тела запроса и факты chess.js для промпта (spec §3).
// LLM запрещено считать шахматы — она только пересказывает то, что здесь посчитано.
import { Chess, validateFen, type Color, type PieceSymbol, type Square } from 'chess.js'

export const MOVE_CLASSES = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'] as const
export const COACH_CONTEXTS = ['game', 'puzzle', 'opening', 'tactic', 'engine-move'] as const
export const COACH_LOCALES = ['ru', 'en', 'hi', 'zh'] as const
export const MAX_PV = 8

export type CoachInput = {
  fen: string
  playedUci: string
  bestUci: string
  pvUci: string[]
  classification: (typeof MOVE_CLASSES)[number]
  evalBeforeCp: number
  evalAfterCp: number
  context: (typeof COACH_CONTEXTS)[number]
  locale: (typeof COACH_LOCALES)[number]
}

export type CoachFacts = {
  side: Color
  playedSan: string
  bestSan: string
  pvSan: string[]
  captured: PieceSymbol | null
  check: boolean
  mate: boolean
  /** Баланс материала белые − чёрные в пешках (П1 К3 С3 Л5 Ф9). */
  materialBefore: number
  materialAfter: number
  /** Фигуры сходившей стороны под боем соперника после хода (без короля). */
  attackedAfter: { square: Square; piece: PieceSymbol; defended: boolean }[]
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

function oneOf<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

/** Ход в UCI по позиции `chess`; null — если ход нелегален. Мутирует `chess`. */
function playUci(chess: Chess, uci: unknown) {
  if (typeof uci !== 'string' || !UCI_RE.test(uci)) return null
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
  } catch {
    return null // chess.js бросает на нелегальный ход
  }
}

function material(chess: Chess): number {
  let sum = 0
  for (const row of chess.board()) for (const p of row) if (p) sum += (p.color === 'w' ? 1 : -1) * VALUE[p.type]
  return sum
}

export function validateCoachInput(body: unknown): { ok: true; input: CoachInput; facts: CoachFacts } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false }
  const b = body as Record<string, unknown>
  if (typeof b.fen !== 'string' || b.fen.length > 100 || !validateFen(b.fen).ok) return { ok: false }
  if (!oneOf(MOVE_CLASSES, b.classification) || !oneOf(COACH_CONTEXTS, b.context) || !oneOf(COACH_LOCALES, b.locale)) return { ok: false }
  if (!Number.isFinite(b.evalBeforeCp) || !Number.isFinite(b.evalAfterCp)) return { ok: false }
  if (!Array.isArray(b.pvUci) || b.pvUci.length > 64) return { ok: false }

  const fen = b.fen
  const best = playUci(new Chess(fen), b.bestUci)
  if (!best) return { ok: false }

  const pvBoard = new Chess(fen)
  const pvSan: string[] = []
  for (const uci of b.pvUci.slice(0, MAX_PV)) {
    const m = playUci(pvBoard, uci)
    if (!m) return { ok: false }
    pvSan.push(m.san)
  }

  const chess = new Chess(fen)
  const materialBefore = material(chess)
  const played = playUci(chess, b.playedUci)
  if (!played) return { ok: false }

  const side = played.color
  const enemy: Color = side === 'w' ? 'b' : 'w'
  const attackedAfter: CoachFacts['attackedAfter'] = []
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== side || p.type === 'k' || !chess.isAttacked(p.square, enemy)) continue
      attackedAfter.push({ square: p.square, piece: p.type, defended: chess.isAttacked(p.square, side) })
    }
  }

  return {
    ok: true,
    input: {
      fen, playedUci: b.playedUci as string, bestUci: b.bestUci as string, pvUci: (b.pvUci as string[]).slice(0, MAX_PV),
      classification: b.classification, evalBeforeCp: b.evalBeforeCp as number, evalAfterCp: b.evalAfterCp as number,
      context: b.context, locale: b.locale,
    },
    facts: {
      side, playedSan: played.san, bestSan: best.san, pvSan, captured: played.captured ?? null,
      check: chess.inCheck(), mate: chess.isCheckmate(), materialBefore, materialAfter: material(chess), attackedAfter,
    },
  }
}

const LANG: Record<CoachInput['locale'], string> = { ru: 'русском', en: 'English', hi: 'Hindi (हिन्दी)', zh: 'Chinese (简体中文)' }
const PIECE: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

function fmtEval(cp: number): string {
  if (Math.abs(cp) >= 90000) return cp > 0 ? 'white mates' : 'black mates'
  return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)} (white's view)`
}

export function buildCoachPrompt(input: CoachInput, facts: CoachFacts): { system: string; user: string } {
  const lang = input.locale === 'ru' ? 'на русском языке' : `in ${LANG[input.locale]}`
  const system = [
    'You are a friendly chess coach for a beginner.',
    `Answer ${lang}, in 2–4 short sentences, plain text, no markdown, no lists.`,
    'Return JSON exactly like {"text": "<your explanation>"}.',
    'Use ONLY the facts given below. Do not calculate or invent any other moves or variations.',
    'Write moves exactly in the SAN given (e.g. Nf3, Qxf7#).',
    input.context === 'engine-move'
      ? (input.classification === 'best' || input.classification === 'good'
        ? "Explain what the opponent's (engine's) move does: why it is good and what it threatens."
        : "Explain what the opponent's (engine's) move does, why it is weaker than the engine's best move, and how the player can exploit it.")
      : 'Explain what the played move does, why the engine move is better (if different), and what the player missed.',
  ].join(' ')
  const sideName = facts.side === 'w' ? 'White' : 'Black'
  const lines = [
    `Context: ${input.context}. Side that moved: ${sideName}.`,
    `Position before the move (FEN): ${input.fen}`,
    `Played move: ${facts.playedSan} — classified by the engine as "${input.classification}".`,
    `Engine's best move: ${facts.bestSan}. Engine main line: ${facts.pvSan.join(' ') || facts.bestSan}.`,
    `Evaluation before: ${fmtEval(input.evalBeforeCp)}; after the played move: ${fmtEval(input.evalAfterCp)}.`,
    facts.captured ? `The played move captures a ${PIECE[facts.captured]}.` : 'The played move captures nothing.',
    facts.mate ? 'The played move is checkmate.' : facts.check ? 'The played move gives check.' : '',
    `Material balance (white minus black, pawns): before ${facts.materialBefore}, after ${facts.materialAfter}.`,
    facts.attackedAfter.length
      ? `After the move these ${sideName} pieces are attacked: ${facts.attackedAfter.map(a => `${PIECE[a.piece]} on ${a.square}${a.defended ? '' : ' (undefended)'}`).join(', ')}.`
      : `After the move no ${sideName} piece is attacked.`,
  ]
  return { system, user: lines.filter(Boolean).join('\n') }
}
