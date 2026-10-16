'use client'

import { useCallback, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Chess } from 'chess.js'
import { getEngine, type EngineLine } from '@/shared/lib/chess/engine'
import { classifyMove, toWhiteCp, type MoveClass } from '@/shared/lib/chess/coachModel'

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
}

export type ExplainResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'LIMIT'; tier: 'guest' | 'user' }
  | { ok: false; reason: 'UNAVAILABLE' | 'BAD_INPUT' }

// Spec: MultiPV 3, depth ≥ 14 or ~1 s, before and after the move.
const BEFORE = { multiPV: 3, depth: 14, movetimeMs: 1000 }
const AFTER = { multiPV: 1, depth: 14, movetimeMs: 1000 }

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

  const review = useCallback(async (fenBefore: string, playedUci: string, context: CoachContext = 'game'): Promise<MoveReview> => {
    const engine = getEngine()
    const game = new Chess(fenBefore)
    const turnBefore = game.turn()
    const played = game.move(uciToMove(playedUci)) // throws on an illegal move
    const fenAfter = game.fen()

    const before = await engine.analyse(fenBefore, BEFORE)
    let after: EngineLine | undefined
    if (game.isCheckmate()) after = { uci: '', pv: [], scoreCp: null, mate: 0 }
    else if (game.isGameOver()) after = { uci: '', pv: [], scoreCp: 0, mate: null }
    else after = (await engine.analyse(fenAfter, AFTER))[0]

    const classification = classifyMove(before, after, playedUci) // throws NO_ANALYSIS
    const top = before[0]
    return {
      classification,
      bestUci: top.uci,
      bestSan: sanOf(fenBefore, top.uci),
      playedSan: played.san,
      pvUci: top.pv,
      evalBeforeCp: toWhiteCp(top, turnBefore),
      evalAfterCp: toWhiteCp(after!, game.turn()),
      fenBefore,
      playedUci,
      context,
    }
  }, [])

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
