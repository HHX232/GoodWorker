// Чистый шов POST /api/chess/coach: валидация тела запроса и факты chess.js для промпта (spec §3).
// LLM запрещено считать шахматы — она только пересказывает то, что здесь посчитано.
import { Chess, validateFen, type Color, type PieceSymbol, type Square } from 'chess.js'
import { whyMove, type Motif, type MoveWhy, type PieceAt } from '../motifs'

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
  /** G43: engine line after the played move (opponent first) and its mate score for the opponent; optional */
  refutationUci: string[]
  refutationMate: number | null
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
  /** Мотивы (G43), посчитанные здесь же из позиции и линии опровержения; null — линии не прислали. */
  why: MoveWhy | null
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
  if (b.refutationUci !== undefined && (!Array.isArray(b.refutationUci) || b.refutationUci.length > 64)) return { ok: false }
  if (b.refutationMate != null && !Number.isInteger(b.refutationMate)) return { ok: false }

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

  const refutation = ((b.refutationUci as string[] | undefined) ?? []).slice(0, MAX_PV)
  const refBoard = new Chess(chess.fen())
  for (const uci of refutation) if (!playUci(refBoard, uci)) return { ok: false }
  const refutationMate = (b.refutationMate as number | null | undefined) ?? null
  const pvUci = (b.pvUci as string[]).slice(0, MAX_PV)
  const why = b.refutationUci === undefined ? null : whyMove({
    fen, played: b.playedUci as string, reply: refutation, replyMate: refutationMate,
    best: pvUci[0] === b.bestUci ? pvUci : [b.bestUci as string], bestMate: null,
  })

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
      fen, playedUci: b.playedUci as string, bestUci: b.bestUci as string, pvUci,
      classification: b.classification, evalBeforeCp: b.evalBeforeCp as number, evalAfterCp: b.evalAfterCp as number,
      context: b.context, locale: b.locale, refutationUci: refutation, refutationMate,
    },
    facts: {
      side, playedSan: played.san, bestSan: best.san, pvSan, captured: played.captured ?? null,
      check: chess.inCheck(), mate: chess.isCheckmate(), materialBefore, materialAfter: material(chess), attackedAfter, why,
    },
  }
}

const LANG: Record<CoachInput['locale'], string> = { ru: 'русском', en: 'English', hi: 'Hindi (हिन्दी)', zh: 'Chinese (简体中文)' }
const PIECE: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

const pc = (p: PieceAt) => `${PIECE[p.piece]} on ${p.square}`

function describeMotif(m: Motif): string {
  switch (m.k) {
    case 'mate': return `checkmate in ${m.n}`
    case 'fork': return `fork: ${pc(m.by)} attacks ${m.targets.map(pc).join(' and ')}`
    case 'pin': return `pin: ${pc(m.by)} pins the ${pc(m.pinned)} to the ${pc(m.behind)} — it cannot move away`
    case 'skewer': return `skewer: ${pc(m.by)} attacks the ${pc(m.front)}; when it moves, the ${pc(m.behind)} behind it falls`
    case 'discovered': return `discovered attack: the moved piece opens the line, and the ${pc(m.by)} hits the ${pc(m.target)}`
    case 'overload': return `overloaded defender: the ${pc(m.defender)} is the only guard of both the ${pc(m.target)} and the ${pc(m.also)}`
    case 'hanging': return `the ${pc(m.target)} is ${m.defended ? 'taken by a cheaper piece' : 'left undefended'}`
    case 'material': return 'it simply wins material'
  }
}

/** Строки фактов о мотивах для промпта (пустой массив — мотивов нет). */
function motifLines(why: MoveWhy | null): string[] {
  if (!why?.reply) return []
  const out = [`Opponent's best reply: ${why.reply.san}.`]
  if (why.motif) out.push(`Tactic of that reply: ${describeMotif(why.motif)}.`)
  if (why.loss >= 1) out.push(`With it the student loses ${why.loss} pawns of material${why.lost ? ` (the ${PIECE[why.lost]})` : ''}.`)
  const b = why.best
  if (b?.fix) {
    out.push(`The strongest move ${b.san} ${
      b.fix.k === 'takes' ? `captures the ${pc(b.fix.target)} first`
        : b.fix.k === 'saves' ? `moves the ${PIECE[b.fix.piece.piece]} away from ${b.fix.piece.square} in advance`
          : 'makes this reply no longer work'
    }.`)
  }
  if (b?.motif) out.push(`The strongest move ${b.san} itself carries a tactic: ${describeMotif(b.motif)}.`)
  return out
}

function fmtEval(cp: number): string {
  if (Math.abs(cp) >= 90000) return cp > 0 ? 'white mates' : 'black mates'
  return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(2)} (white's view)`
}

// Как тренер обращается к ученику и как называет ход другой стороны — на языке ответа.
const VOICE: Record<CoachInput['locale'], { you: string; opponent: string }> = {
  ru: { you: 'Обращайся к ученику на «ты».', opponent: '«ход соперника»' },
  en: { you: 'Talk to the student directly as "you", casually.', opponent: '"your opponent\'s move"' },
  hi: { you: 'Address the student informally as तुम.', opponent: '"प्रतिद्वंद्वी की चाल"' },
  zh: { you: 'Address the student as 你.', opponent: '"对手的这步棋"' },
}

const SITUATION: Record<CoachInput['context'], string> = {
  game: 'a game', 'engine-move': 'a game', puzzle: 'a puzzle', tactic: 'a tactics exercise', opening: 'opening study',
}

export function buildCoachPrompt(input: CoachInput, facts: CoachFacts): { system: string; user: string } {
  const lang = input.locale === 'ru' ? 'на русском языке' : `in ${LANG[input.locale]}`
  const voice = VOICE[input.locale]
  const opponentMove = input.context === 'engine-move'
  const strongOpponent = input.classification === 'best' || input.classification === 'good'
  const system = [
    'You are a warm, lively chess coach sitting next to your student.',
    voice.you,
    `Answer ${lang}, in 1–2 short sentences, plain text, no markdown, no lists.`,
    'Go straight to the point: name the concrete pieces, squares and the threat or material won or lost.',
    'No praise or judging openers ("Nice move", "Well done", "Great", "Good choice", "Молодец", "Отлично", "Неплохой ход"), no filler, do not restate the obvious.',
    'No technical jargon: never mention computers, programs, centipawns, evaluation numbers, lines of analysis or move grades.',
    `When you talk about the other side's move, call it ${voice.opponent}.`,
    'Return JSON exactly like {"text": "<your explanation>"}.',
    'Use ONLY the facts given below. Do not calculate or invent any other moves or variations.',
    'Write moves exactly in the SAN given (e.g. Nf3, Qxf7#).',
    'When tactic facts are given, build the answer on them as cause → consequence: which piece does what to which pieces and what is lost, then how the strongest move prevents it.',
    input.context === 'opening'
      ? "This is a book move of the opening's main line. Explain its purpose: which idea or plan it carries. Do not compare it with other moves, do not judge or grade it."
      : opponentMove
      ? (strongOpponent
        ? "The move below was made by the student's opponent. Say concretely what it does and what it threatens."
        : "The move below was made by the student's opponent and it is not the strongest one. Say concretely why the strongest move listed was stronger and how the student can take advantage.")
      : input.playedUci === input.bestUci
      ? 'The move below was made by the student and it is the strongest move. In ONE sentence, say what its concrete idea is.'
      : 'The move below was made by the student. Say which move was stronger and concretely why (pieces, squares, threat, material).',
  ].join(' ')
  const sideName = facts.side === 'w' ? 'White' : 'Black'
  const lines = [
    `Situation: ${SITUATION[input.context]}. Moved: ${opponentMove ? "the student's opponent" : 'the student'} (${sideName}).`,
    `Position before the move (FEN): ${input.fen}`,
    // Для дебюта — только сам книжный ход: без классификации, сильнейшего хода и оценки, чтобы модель не сравнивала.
    ...(input.context === 'opening'
      ? [`Book move of the opening main line: ${facts.playedSan}.`]
      : [
        `Played move: ${facts.playedSan} — quality: ${input.classification}.`,
        `Strongest move in this position: ${facts.bestSan}. Its continuation: ${facts.pvSan.join(' ') || facts.bestSan}.`,
        `Score for reference only, never quote numbers: before ${fmtEval(input.evalBeforeCp)}; after the played move ${fmtEval(input.evalAfterCp)}.`,
      ]),
    ...(input.context === 'opening' ? [] : motifLines(facts.why)),
    facts.captured ? `The played move captures a ${PIECE[facts.captured]}.` : 'The played move captures nothing.',
    facts.mate ? 'The played move is checkmate.' : facts.check ? 'The played move gives check.' : '',
    `Material balance (white minus black, pawns): before ${facts.materialBefore}, after ${facts.materialAfter}.`,
    facts.attackedAfter.length
      ? `After the move these ${sideName} pieces are attacked: ${facts.attackedAfter.map(a => `${PIECE[a.piece]} on ${a.square}${a.defended ? '' : ' (undefended)'}`).join(', ')}.`
      : `After the move no ${sideName} piece is attacked.`,
  ]
  return { system, user: lines.filter(Boolean).join('\n') }
}
