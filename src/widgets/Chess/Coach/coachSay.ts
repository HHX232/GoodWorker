// G41/G42: the coach's instant line for a reviewed move — cause → consequence from motifs.ts, no DeepSeek.
import type { PieceSymbol } from 'chess.js'
import type { Motif, MoveWhy, PieceAt } from '@/shared/lib/chess/motifs'

type T = (key: string, values?: Record<string, string | number>) => string

const MARK: Record<string, string> = { inaccuracy: '?!', mistake: '?', blunder: '??' }

function helpers(t: T, tp: T) {
  const acc = (p: PieceSymbol) => tp(`pc_acc_${p}`)
  const sq = (name: string, x?: PieceAt): Record<string, string> =>
    x ? { [name]: acc(x.piece), [`${name}N`]: t(`pn_${x.piece}`), [`${name}Sq`]: x.square } : {}
  const what = (n: number, piece: PieceSymbol | null, key: 'loss_piece' | 'gain_piece') =>
    piece ? t(key, { piece: acc(piece) }) : t('loss_pawns', { n })
  return { sq, what }
}

/** What the strongest move does by itself (mate, fork, pin, material) — also the line for a played best move. */
export function bestLine(why: MoveWhy, t: T, tp: T): string | null {
  const b = why.best
  if (!b?.motif) return null
  const { sq, what } = helpers(t, tp)
  const m = b.motif
  if (m.k === 'mate') return t('best_mate', { best: b.san, n: m.n })
  if (m.k === 'fork') return t('best_fork', { best: b.san, ...sq('a', m.targets[0]), ...sq('b', m.targets[1]) })
  if (m.k === 'pin') return t('best_pin', { best: b.san, ...sq('a', m.pinned) })
  return b.gain >= 1 ? t('best_win', { best: b.san, what: what(b.gain, b.taken, 'gain_piece') }) : null
}

/**
 * The line for an inaccuracy / mistake / blunder: what the opponent's reply does and what it costs, then how the
 * strongest move avoids it. `t` — chess.core, `tp` — chess.play (`pc_acc_*`); `turn` rotates the wording.
 * Null when there is nothing concrete to say — the caller keeps its plain sentence.
 */
export function mistakeLine(why: MoveWhy, cls: string, playedSan: string, t: T, tp: T, turn: number): string | null {
  if (!why.reply || !why.best) return null
  const v = (turn % 2) + 1
  const { sq, what } = helpers(t, tp)
  const b = why.best
  const own = bestLine(why, t, tp)
  const fix =
    b.motif?.k === 'mate' ? own
      : b.fix?.k === 'takes' ? t(`fix_takes_${v}`, { best: b.san, ...sq('a', b.fix.target) })
      : b.fix?.k === 'saves' ? t(`fix_saves_${v}`, { best: b.san, ...sq('a', b.fix.piece) })
      : own ?? (b.fix ? t(`fix_stops_${v}`, { best: b.san }) : null)

  const m = why.motif
  // an inaccuracy with no tactic either way: nothing concrete — keep the mild sentence
  if (!m && cls === 'inaccuracy') return own ? `${t('say_inaccuracy', { played: playedSan, best: b.san })} ${own}` : null

  const loss = why.loss >= 1 ? t('why_loss', { what: what(why.loss, why.lost, 'loss_piece') }) : ''
  const base = { played: playedSan + (MARK[cls] ?? ''), reply: why.reply.san, loss }
  const first = !m
    ? t(`why_reply_${v}`, base)
    : m.k === 'mate' ? t(`why_mate_${v}`, { ...base, n: m.n })
    : m.k === 'material' ? t(`why_material_${v}`, base)
    : m.k === 'hanging' ? t(`why_${m.defended ? 'cheap' : 'hanging'}_${v}`, { ...base, ...sq('a', m.target) })
    : t(`why_${m.k}_${v}`, { ...base, ...motifArgs(m, sq) })
  return `${first} ${fix ?? t(`best_plain_${v}`, { best: b.san })}`
}

function motifArgs(m: Motif, sq: (n: string, x?: PieceAt) => Record<string, string>) {
  switch (m.k) {
    case 'fork': return { ...sq('by', m.by), ...sq('a', m.targets[0]), ...sq('b', m.targets[1]) }
    case 'pin': return { ...sq('by', m.by), ...sq('a', m.pinned), ...sq('b', m.behind) }
    case 'skewer': return { ...sq('by', m.by), ...sq('a', m.front), ...sq('b', m.behind) }
    case 'discovered': return { ...sq('by', m.by), ...sq('a', m.target) }
    case 'overload': return { ...sq('by', m.defender), ...sq('a', m.target), ...sq('b', m.also) }
    default: return {}
  }
}
