'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { useTranslations } from 'next-intl'
import { Chess, validateFen, DEFAULT_POSITION } from 'chess.js'
import { ArrowLeft, ArrowUpDown, CloudOff, Flag, Lock, MessageCircleQuestion, Plus, RotateCw, Undo2 } from 'lucide-react'
import { ChessBoard, SKINS, useChessSkin, type BoardMove } from '@/widgets/Chess/Board'
import { CoachPanel, EvalBar, useMoveCoach, type ExplainResult, type MoveReview } from '@/widgets/Chess/Coach'
import { getEngine, ENGINE_LEVELS } from '@/shared/lib/chess/engine'
import { playMoveSound, useSoundEnabled } from '@/shared/lib/chess/sound'
import { readPref, useLocalPref } from '@/shared/lib/chess/localPref'
import { endReason, engineMoveFacts, type MoveFact } from './gameFacts'
import styles from './ChessPlayPage.module.scss'

type Side = 'w' | 'b'
type Mode = 'ai' | 'duo'
type Saved = { start: string; moves: string[]; level: number; color: Side; mode: Mode; resigned: boolean; evalCp: number | null }
type EngineNote = { fenBefore: string; uci: string; san: string; facts: MoveFact[] }

const STORE = 'gw-chess-game'
const isLevel = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8

function soundFor(chess: Chess) {
  const last = chess.history({ verbose: true }).at(-1)
  if (chess.isGameOver()) return playMoveSound('end')
  if (chess.inCheck()) return playMoveSound('check')
  playMoveSound(last?.captured ? 'capture' : 'move')
}

export function ChessPlayPage({ initialFen, initialColor }: { initialFen?: string; initialColor?: string }) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const router = useRouter()
  const [chess] = useState(() => new Chess())
  const [start, setStart] = useState(DEFAULT_POSITION)
  const [fen, setFen] = useState(DEFAULT_POSITION)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [mode, setMode] = useState<Mode>('ai')
  const [level, setLevel] = useState(3)
  const [color, setColor] = useState<Side>('w')
  const [flipped, setFlipped] = useState(false)
  const [resigned, setResigned] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [engineDown, setEngineDown] = useState(false)
  const [review, setReview] = useState<MoveReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const [evalCp, setEvalCp] = useState<number | null>(0) // null = unknown for this position: the bar is hidden
  const [note, setNote] = useState<EngineNote | null>(null)
  const [ready, setReady] = useState(false)
  const [badFen, setBadFen] = useState(false)
  const [round, setRound] = useState(0) // re-asks the engine after a reset even when fen did not change
  const [soundOn, setSoundOn] = useSoundEnabled()
  const [skin, setSkin] = useChessSkin()
  const [evalPref, setEvalPref] = useLocalPref('gw-chess-evalbar', '1')
  const [autoPref, setAutoPref] = useLocalPref('gw-chess-autoexplain', '0') // off by default: every auto call spends the limit
  const coach = useMoveCoach()
  const gen = useRef(0) // bumps on every player move / new game / undo: stale engine answers are dropped
  const askedFen = useRef<string | null>(null)
  const booted = useRef(false)

  const sync = useCallback(() => {
    setFen(chess.fen())
    const last = chess.history({ verbose: true }).at(-1)
    setLastMove(last ? { from: last.from, to: last.to } : null)
  }, [chess])

  const vsAi = mode === 'ai' && !engineDown
  const reason = endReason(chess, resigned)
  const gameOver = reason !== null

  // ─── restore: ?fen= (from "play on from here") wins over the saved game ──────
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    let fromUrl = false
    if (initialFen) {
      if (validateFen(initialFen).ok) {
        chess.load(initialFen)
        setStart(initialFen)
        setColor(initialColor === 'w' || initialColor === 'b' ? initialColor : chess.turn())
        fromUrl = true
        setEvalCp(null)
        try {
          const lv = (JSON.parse(readPref(STORE) ?? 'null') as Saved | null)?.level // keep the player's level
          if (isLevel(lv)) setLevel(lv)
        } catch {}
      } else setBadFen(true) // inline, not a toast: the site Toaster mounts lazily and misses toasts fired on load
      router.replace('/chess/play')
    }
    if (!fromUrl) {
      try {
        const s = JSON.parse(readPref(STORE) ?? 'null') as Saved | null
        if (s && typeof s.start === 'string' && Array.isArray(s.moves)) {
          chess.load(s.start)
          for (const san of s.moves) chess.move(san)
          setStart(s.start)
          if (isLevel(s.level)) setLevel(s.level)
          if (s.color === 'w' || s.color === 'b') setColor(s.color)
          if (s.mode === 'ai' || s.mode === 'duo') setMode(s.mode)
          if (typeof s.resigned === 'boolean') setResigned(s.resigned)
          setEvalCp(typeof s.evalCp === 'number' && Number.isFinite(s.evalCp) ? s.evalCp : null)
        }
      } catch {
        chess.reset() // corrupted save: plain new game
      }
    }
    sync()
    setReady(true)
  }, [chess, initialColor, initialFen, router, sync])

  useEffect(() => {
    if (!ready) return
    const saved: Saved = { start, moves: chess.history(), level, color, mode, resigned, evalCp }
    try {
      localStorage.setItem(STORE, JSON.stringify(saved))
    } catch {}
  }, [ready, chess, fen, start, level, color, mode, resigned, evalCp])

  // ─── engine reply ─────────────────────────────────────────────────────────────
  const engineMove = useCallback(async () => {
    if (!ready || !vsAi || resigned || chess.turn() === color || chess.isGameOver()) return
    const my = gen.current
    const asked = chess.fen()
    if (askedFen.current === asked) return
    askedFen.current = asked
    setThinking(true)
    try {
      const uci = await getEngine().bestMove(asked, level)
      if (my !== gen.current || chess.fen() !== asked) return
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      sync()
      soundFor(chess)
      setNote({ fenBefore: asked, uci, ...engineMoveFacts(asked, uci) })
    } catch (e) {
      if ((e as Error).message === 'ENGINE_UNAVAILABLE') setEngineDown(true)
    } finally {
      if (askedFen.current === asked) askedFen.current = null
      if (my === gen.current) setThinking(false)
    }
  }, [chess, color, level, ready, resigned, sync, vsAi])

  useEffect(() => {
    void engineMove()
  }, [fen, engineMove, round])

  const onMove = (m: BoardMove) => {
    if (gameOver || thinking || (vsAi && chess.turn() !== color)) return
    const before = chess.fen()
    try {
      chess.move(m)
    } catch {
      return
    }
    gen.current++
    // the previous move's review is obsolete — drop it so the reply is not queued behind it (level 8 ≤ 3 s)
    if (vsAi) getEngine().cancelAll()
    askedFen.current = null
    setNote(null)
    sync()
    soundFor(chess)
    void engineMove() // queued first; the review goes after it
    if (!vsAi) return
    const my = gen.current
    setReview(null)
    setNoAnalysis(false)
    setReviewing(true)
    coach
      .review(before, m.from + m.to + (m.promotion ?? ''), 'game')
      .then((r) => {
        if (my !== gen.current) return
        setReview(r)
        setEvalCp(r.evalAfterCp)
      })
      .catch((e: Error) => {
        if (my !== gen.current || e.message === 'ENGINE_CANCELLED') return
        setReview(null)
        setNoAnalysis(true)
      })
      .finally(() => my === gen.current && setReviewing(false))
  }

  const reset = () => {
    gen.current++
    askedFen.current = null
    getEngine().cancelAll()
    setThinking(false)
    setReviewing(false)
    setReview(null)
    setNoAnalysis(false)
    setResigned(false)
    setNote(null)
    setRound((r) => r + 1)
    setBadFen(false)
  }

  const newGame = (side: Side = color) => {
    reset()
    chess.load(DEFAULT_POSITION)
    setStart(DEFAULT_POSITION)
    setColor(side)
    setEvalCp(0)
    sync()
  }

  const undo = () => {
    reset()
    chess.undo()
    if (vsAi && chess.turn() !== color) chess.undo()
    setEvalCp(null) // the shown eval belonged to the undone position
    sync()
  }

  const resign = () => {
    reset()
    setResigned(true)
    playMoveSound('end')
  }

  const switchMode = (m: Mode) => {
    if (m === mode) return
    reset()
    setMode(m)
  }

  // ─── view ─────────────────────────────────────────────────────────────────────
  const orientation: Side = (vsAi ? color === 'b' : false) !== flipped ? 'b' : 'w'
  const arrows =
    review && review.classification !== 'best' && review.bestUci
      ? [{ from: review.bestUci.slice(0, 2), to: review.bestUci.slice(2, 4) }]
      : []

  const history = chess.history()
  const startTurn = start.split(' ')[1] === 'b' ? 1 : 0
  const startNo = Number(start.split(' ')[5]) || 1
  const plies: (string | null)[] = [...Array(startTurn).fill(null), ...history]
  const rows = Array.from({ length: Math.ceil(plies.length / 2) }, (_, i) => [plies[i * 2], plies[i * 2 + 1]] as const)

  const sideLabel = (side: Side) =>
    vsAi ? (side === color ? t('you') : t('engine_level', { n: level })) : t(side === 'w' ? 'white' : 'black')
  const strip = (side: Side) => {
    const toMove = !gameOver && chess.turn() === side
    const isEngine = vsAi && side !== color
    return (
      <div className={styles.strip} data-active={toMove || undefined}>
        <span className={styles.stripDot} data-side={side} aria-hidden="true" />
        <span className={styles.stripName}>{sideLabel(side)}</span>
        {isEngine && thinking && (
          <span className={styles.stripThinking} role="status">
            <span className={styles.dots} aria-hidden="true" />
            {t('thinking')}
          </span>
        )}
      </div>
    )
  }

  const endText = () => {
    if (reason === 'checkmate') {
      const winner: Side = chess.turn() === 'w' ? 'b' : 'w'
      return vsAi ? t(winner === color ? 'end_mate_you' : 'end_mate_engine') : t(winner === 'w' ? 'end_mate_white' : 'end_mate_black')
    }
    return t(`end_${reason}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link href="/chess" className={styles.back}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          {t('hub_title')}
        </Link>
        <h1 className={styles.title}>{t('play_title')}</h1>
      </header>

      {badFen && (
        <p className={styles.engineDown} role="alert">
          <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
          {t('bad_fen')}
        </p>
      )}

      {engineDown && (
        <p className={styles.engineDown} role="alert">
          <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
          {tc('engine_unavailable')}
        </p>
      )}

      <div className={styles.layout}>
        <section className={styles.boardCol} aria-label={tc('board_label')}>
          {strip(orientation === 'w' ? 'b' : 'w')}
          <div className={styles.stage}>
            {vsAi && evalPref === '1' && evalCp !== null && <EvalBar cp={evalCp} orientation={orientation} />}
            <ChessBoard
              fen={fen}
              orientation={orientation}
              onMove={onMove}
              interactive={ready && !gameOver && !thinking && (!vsAi || chess.turn() === color)}
              lastMove={lastMove}
              check={checkSquare(chess.fen())}
              arrows={arrows}
              skinId={skin}
            />
          </div>
          {strip(orientation)}

          {gameOver && (
            <div className={styles.end} role="status">
              <p className={styles.endText}>{endText()}</p>
              <button type="button" className={styles.primary} onClick={() => newGame()}>
                {t('again')}
              </button>
            </div>
          )}

          <div className={styles.controls}>
            <button type="button" className={styles.tool} onClick={undo} disabled={!history.length}>
              <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
              {t('undo')}
            </button>
            <button type="button" className={styles.tool} onClick={() => setFlipped((f) => !f)}>
              <ArrowUpDown size={16} strokeWidth={2} aria-hidden="true" />
              {t('flip')}
            </button>
            {vsAi && (
              <button type="button" className={styles.tool} onClick={resign} disabled={gameOver || !history.length}>
                <Flag size={16} strokeWidth={2} aria-hidden="true" />
                {t('resign')}
              </button>
            )}
            <button type="button" className={`${styles.tool} ${styles.toolStrong}`} onClick={() => newGame()}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              {t('new_game')}
            </button>
          </div>

          <p className={styles.credit}>
            {tc('engine_credit')} ·{' '}
            <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">
              {tc('engine_source')}
            </a>
          </p>
        </section>

        <aside className={styles.rail}>
          <div className={styles.card}>
            <div className={styles.field}>
              <span className={styles.label} id="mode-label">{t('opponent')}</span>
              <div className={styles.seg} role="group" aria-labelledby="mode-label">
                <button type="button" aria-pressed={vsAi} disabled={engineDown} onClick={() => switchMode('ai')}>
                  {t('mode_ai')}
                </button>
                <button type="button" aria-pressed={!vsAi} onClick={() => switchMode('duo')}>
                  {t('mode_duo')}
                </button>
              </div>
            </div>
            {vsAi && (
              <>
                <div className={styles.field}>
                  <span className={styles.label} id="level-label">
                    {t('level')}
                    <span className={styles.labelHint}>{t(`level_hint_${level}`)}</span>
                  </span>
                  <div className={`${styles.seg} ${styles.segLevels}`} role="group" aria-labelledby="level-label">
                    {ENGINE_LEVELS.map((l) => (
                      <button key={l.level} type="button" aria-pressed={level === l.level} onClick={() => setLevel(l.level)}>
                        {l.level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <span className={styles.label} id="color-label">
                    {t('color')}
                    <span className={styles.labelHint}>{t('color_hint')}</span>
                  </span>
                  <div className={styles.seg} role="group" aria-labelledby="color-label">
                    <button type="button" aria-pressed={color === 'w'} onClick={() => newGame('w')}>
                      <span className={styles.swatch} data-side="w" aria-hidden="true" />
                      {t('white')}
                    </button>
                    <button type="button" aria-pressed={color === 'b'} onClick={() => newGame('b')}>
                      <span className={styles.swatch} data-side="b" aria-hidden="true" />
                      {t('black')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {vsAi && (
            <CoachPanel
              review={review}
              noAnalysis={noAnalysis}
              analysing={reviewing}
              explain={coach.explain}
              autoExplain={autoPref === '1'}
            />
          )}

          {vsAi && note && (
            <EngineNoteCard key={note.fenBefore + note.uci} note={note} review={coach.review} explain={coach.explain} />
          )}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('moves')}</h2>
            {rows.length === 0 ? (
              <p className={styles.muted}>{t('no_moves')}</p>
            ) : (
              <ol className={styles.moves}>
                {rows.map(([w, b], i) => (
                  <li key={i}>
                    <span className={styles.moveNo}>{startNo + i}.</span>
                    <span className={i * 2 === plies.length - 1 ? styles.moveLast : undefined}>{w ?? '…'}</span>
                    <span className={i * 2 + 1 === plies.length - 1 ? styles.moveLast : undefined}>{b ?? ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{t('settings')}</h2>
            <label className={styles.toggle}>
              <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
              <span>{t('opt_sound')}</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={evalPref === '1'} onChange={(e) => setEvalPref(e.target.checked ? '1' : '0')} />
              <span>{t('opt_evalbar')}</span>
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={autoPref === '1'} onChange={(e) => setAutoPref(e.target.checked ? '1' : '0')} />
              <span>
                {t('opt_auto')}
                <small>{t('opt_auto_hint')}</small>
              </span>
            </label>
            <div className={styles.field}>
              <span className={styles.label} id="skin-label">{t('skin')}</span>
              <div className={styles.skins} role="group" aria-labelledby="skin-label">
                {SKINS.map((s) => (
                  <button key={s.id} type="button" aria-pressed={skin === s.id} onClick={() => setSkin(s.id)}>
                    <span className={styles.skinChip} style={{ background: `linear-gradient(135deg, ${s.light} 50%, ${s.dark} 50%)` }} aria-hidden="true" />
                    {tc(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── R14: one line on what the engine just did, "More" asks the coach ─────────

type Coach = ReturnType<typeof useMoveCoach>

function EngineNoteCard({ note, review, explain }: { note: EngineNote; review: Coach['review']; explain: Coach['explain'] }) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  const [result, setResult] = useState<ExplainResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [noAnalysis, setNoAnalysis] = useState(false)
  const reviewed = useRef<MoveReview | null>(null) // a retry after UNAVAILABLE does not re-run the engine

  const factText = (f: MoveFact) => {
    switch (f.k) {
      case 'capture':
      case 'promote':
      case 'develop':
        return t(`fact_${f.k}`, { piece: t(`pc_acc_${f.piece}`) })
      case 'threat':
        return t('fact_threat', { piece: t(`pc_acc_${f.piece}`), square: f.square })
      default:
        return t(`fact_${f.k}`)
    }
  }

  // real engine facts for the engine's own move (class, best line, eval before/after), then the coach's words
  const ask = async () => {
    setResult(null)
    setNoAnalysis(false)
    let r = reviewed.current
    if (!r) {
      setAnalysing(true)
      try {
        r = await review(note.fenBefore, note.uci, 'engine-move')
      } catch (e) {
        if ((e as Error).message !== 'ENGINE_CANCELLED') setNoAnalysis(true)
        return
      } finally {
        setAnalysing(false)
      }
      reviewed.current = r
    }
    setLoading(true)
    setResult(await explain(r))
    setLoading(false)
  }

  return (
    <section className={styles.card} aria-live="polite">
      <h2 className={styles.cardTitle}>{t('engine_move_title')}</h2>
      <p className={styles.noteLine}>
        <span className={styles.noteSan}>{note.san}</span>
        {note.facts.slice(0, 2).map(factText).join(', ')}
      </p>
      {analysing && (
        <p className={styles.muted} role="status">
          <span className={styles.dots} aria-hidden="true" />
          {tc('coach_analysing')}
        </p>
      )}
      {noAnalysis && <p className={styles.muted}>{tc('coach_no_analysis')}</p>}
      {!result && !loading && !analysing && !noAnalysis && (
        <button type="button" className={styles.link} onClick={ask}>
          <MessageCircleQuestion size={15} strokeWidth={2} aria-hidden="true" />
          {t('engine_more')}
        </button>
      )}
      {loading && (
        <p className={styles.muted} role="status">
          <span className={styles.dots} aria-hidden="true" />
          {tc('coach_explaining')}
        </p>
      )}
      {result?.ok && <p className={styles.explanation}>{result.text}</p>}
      {result && !result.ok && (
        <p className={styles.notice}>
          {result.reason === 'LIMIT' ? <Lock size={15} strokeWidth={2} aria-hidden="true" /> : <CloudOff size={15} strokeWidth={2} aria-hidden="true" />}
          <span>
            {result.reason === 'LIMIT'
              ? `${tc('coach_limit')} ${tc(result.tier === 'guest' ? 'coach_limit_guest' : 'coach_limit_user')}`
              : tc(result.reason === 'BAD_INPUT' ? 'coach_bad_input' : 'coach_unavailable')}
          </span>
          {result.reason === 'UNAVAILABLE' && (
            <button type="button" className={styles.link} onClick={ask}>
              <RotateCw size={13} strokeWidth={2.25} aria-hidden="true" />
              {tc('coach_retry')}
            </button>
          )}
        </p>
      )}
    </section>
  )
}
