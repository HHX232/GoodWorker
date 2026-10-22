'use client'

import { useCallback, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Chess } from 'chess.js'
import { getEngine, type EngineLine } from '@/shared/lib/chess/engine'
import { classifyMove, toWhiteCp, type MoveClass } from '@/shared/lib/chess/coachModel'
import { whyMove, type MoveWhy } from '@/shared/lib/chess/motifs'

export type CoachContext = 'game' | 'puzzle' | 'opening' | 'tactic' | 'engine-move'

export type MoveReview = {
  classification: MoveClass
  bestUci: string
  bestSan: string
  playedSan: string
  pvUci: string[]
  /** both from White's point of view */
  evalBeforeCp: number
  evalAfterCp: number
  fenBefore: string
  /** extra to the contract: what `explain` needs to send */
  playedUci: string
  context: CoachContext
  /** G41 (optional: hand-built reviews — analysis, openings — have none): engine line after the played move (opponent first) and its mate score for the opponent */
  refutationUci?: string[]
  refutationMate?: number | null
  /** G41: why the move loses / what the best move does (motifs.ts); null when it could not be worked out */
  why?: MoveWhy | null
}

export type ExplainResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'LIMIT'; tier: 'guest' | 'user' }
  | { ok: false; reason: 'UNAVAILABLE' | 'BAD_INPUT' }

// Iterative deepening: a quick look first (~0.5 s, the coach answers at once), then a deep one in the background
// (depth 20 or ~3 s, whichever comes first) that replaces it when the verdict changes. MultiPV 3 before the move.
/** The quick pre-move analysis; a caller that already ran it (or DEEP_ANALYSIS) on `fenBefore` passes its lines in. */
export const REVIEW_ANALYSIS = { multiPV: 3, movetimeMs: 500 }
/** The background refinement of the same position. */
export const DEEP_ANALYSIS = { multiPV: 3, depth: 20, movetimeMs: 3000 }
/** Lines at least this deep count as already refined — the deep pass does not search them again. */
export const DEEP_DEPTH = 18
// a caller without `onRefine` (puzzles, the call board) gets one medium search, as before
const SINGLE = { multiPV: 3, depth: 14, movetimeMs: 1000 }

const uciToMove = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })

function sanOf(fen: string, uci: string): string {
  try {
    return new Chess(fen).move(uciToMove(uci)).san
  } catch {
    return uci
  }
}

/**
 * Engine facts for one move + DeepSeek explanation via /api/chess/coach.
 * `review` rejects with ENGINE_UNAVAILABLE, ENGINE_CANCELLED (getEngine().cancelAll()), BAD_FEN,
 * or NO_ANALYSIS (engine returned no scored line) — callers show "no analysis", never a fake class.
 *
 * Caller pattern for `review` (copy exactly, see /game/chess):
 *   setReview(null); setNoAnalysis(false); setAnalysing(true)
 *   coach.review(fenBefore, uci, ctx)
 *     .then((r) => setReview(r))
 *     .catch((e) => { if (e.message !== 'ENGINE_CANCELLED') { setReview(null); setNoAnalysis(true) } })
 *     .finally(() => setAnalysing(false))
 *   <CoachPanel review={review} noAnalysis={noAnalysis} analysing={analysing} explain={coach.explain} />
 * Ignore results of a stale move/game (generation counter); call getEngine().cancelAll() on new game/undo.
 */
export function useMoveCoach() {
  const locale = useLocale()

  const review = useCallback(
    /**
     * Resolves with the quick review. With `onRefine` it then searches deeper in the background (queued after the
     * quick jobs, dropped by cancelAll like any job) and calls `onRefine` with the deeper review; `changed` — the class,
     * the best move or the refutation differ from the quick one. The caller drops a stale refinement by its generation counter.
     */
    async (
      fenBefore: string, playedUci: string, context: CoachContext = 'game', linesBefore?: EngineLine[],
      onRefine?: (deep: MoveReview, changed: boolean) => void,
    ): Promise<MoveReview> => {
      const engine = getEngine()
      const game = new Chess(fenBefore)
      const played = game.move(uciToMove(playedUci)) // throws on an illegal move
      const fenAfter = game.fen()
      const over: EngineLine | null = game.isCheckmate()
        ? { uci: '', pv: [], scoreCp: null, mate: 0 }
        : game.isGameOver() ? { uci: '', pv: [], scoreCp: 0, mate: null } : null
      const build = (before: EngineLine[], after: EngineLine | undefined) =>
        buildReview(fenBefore, played.san, playedUci, context, before, after)

      const opts = onRefine ? REVIEW_ANALYSIS : SINGLE
      // reuse lines of the same position (e.g. the best-move hint) instead of a second identical search
      const before = linesBefore?.length ? linesBefore : await engine.analyse(fenBefore, opts)
      const quick = build(before, over ?? (await engine.analyse(fenAfter, { ...opts, multiPV: 1 }))[0])
      if (onRefine && !over) {
        void (async () => {
          const deepBefore = (before[0]?.depth ?? 0) >= DEEP_DEPTH ? before : await engine.analyse(fenBefore, DEEP_ANALYSIS)
          const deep = build(deepBefore, (await engine.analyse(fenAfter, { ...DEEP_ANALYSIS, multiPV: 1 }))[0])
          const changed = deep.classification !== quick.classification || deep.bestUci !== quick.bestUci ||
            deep.refutationUci?.[0] !== quick.refutationUci?.[0]
          onRefine(deep, changed)
        })().catch(() => {}) // cancelled / engine down / no analysis: the quick review stands
      }
      return quick
    },
    []
  )

  const explain = useCallback(
    async (r: MoveReview): Promise<ExplainResult> => {
      try {
        const res = await fetch('/api/chess/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fen: r.fenBefore,
            playedUci: r.playedUci,
            bestUci: r.bestUci,
            pvUci: r.pvUci,
            classification: r.classification,
            evalBeforeCp: r.evalBeforeCp,
            evalAfterCp: r.evalAfterCp,
            context: r.context,
            refutationUci: r.refutationUci?.slice(0, 8),
            refutationMate: r.refutationMate,
            locale: ['ru', 'en', 'hi', 'zh'].includes(locale) ? locale : 'en',
          }),
        })
        const body = await res.json().catch(() => null)
        if (res.ok && typeof body?.text === 'string') return { ok: true, text: body.text }
        if (res.status === 429) return { ok: false, reason: 'LIMIT', tier: body?.tier === 'user' ? 'user' : 'guest' }
        if (res.status === 400) return { ok: false, reason: 'BAD_INPUT' }
        return { ok: false, reason: 'UNAVAILABLE' } // 404 until the API exists, 503, anything else
      } catch {
        return { ok: false, reason: 'UNAVAILABLE' }
      }
    },
    [locale]
  )

  return useMemo(() => ({ review, explain }), [review, explain])
}

/** Classification + motifs of one move from the lines before it and the opponent's best line after it. Throws NO_ANALYSIS. */
function buildReview(
  fenBefore: string, playedSan: string, playedUci: string, context: CoachContext, before: EngineLine[], after: EngineLine | undefined,
): MoveReview {
  const classification = classifyMove(before, after, playedUci) // throws NO_ANALYSIS
  const turnBefore = fenBefore.split(' ')[1] === 'b' ? 'b' : 'w'
  const top = before[0]
  const refutationUci = after!.pv ?? []
  const refutationMate = after!.mate ?? null
  let why: MoveWhy | null = null
  try {
    why = whyMove({ fen: fenBefore, played: playedUci, reply: refutationUci, replyMate: refutationMate, best: top.pv?.length ? top.pv : [top.uci], bestMate: top.mate })
  } catch {
    why = null // an odd engine line: the coach falls back to the plain sentence
  }
  return {
    classification,
    bestUci: top.uci,
    bestSan: sanOf(fenBefore, top.uci),
    playedSan,
    pvUci: top.pv,
    evalBeforeCp: toWhiteCp(top, turnBefore),
    evalAfterCp: toWhiteCp(after!, turnBefore === 'w' ? 'b' : 'w'),
    fenBefore,
    playedUci,
    context,
    refutationUci,
    refutationMate,
    why,
  }
}
