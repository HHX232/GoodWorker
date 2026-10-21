'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Chess } from 'chess.js'
import { ArrowUpDown, ChartLine, Check, CloudOff, Copy, Flag, Handshake, LogIn, RotateCcw, X } from 'lucide-react'
import { ChessBoard, type BoardMove } from '@/widgets/Chess/Board'
import { checkSquare } from '@/shared/lib/chess/puzzle'
import { playMoveSound } from '@/shared/lib/chess/sound'
import type { OnlineGameState, OnlinePlayer } from '@/shared/lib/chess/server/onlineStore'
import { useVisiblePoll } from '../Online/useVisiblePoll'
import styles from '../Online/Online.module.scss'

type Side = 'w' | 'b'
type Load = 'loading' | 'ready' | 'guest' | 'missing'

/** Полный ответ (с игроками) заменяет состояние; ответ ?since= дописывает хвост ходов и оставляет игроков. */
function merge(prev: OnlineGameState | null, next: OnlineGameState): OnlineGameState {
  if (!prev || 'white' in next) return next
  return { ...next, moves: [...prev.moves.slice(0, next.since), ...next.moves], since: 0, white: prev.white, black: prev.black, invited: prev.invited }
}

export function formatClock(ms: number) {
  const s = Math.max(0, ms) / 1000
  if (s < 10) return s.toFixed(1)
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function OnlineGamePage({ id }: { id: string }) {
  const t = useTranslations('chess.online')
  const ta = useTranslations('chess.analysis')
  const router = useRouter()
  const [st, setSt] = useState<OnlineGameState | null>(null)
  const [load, setLoad] = useState<Load>('loading')
  const [lost, setLost] = useState(false)
  const [receivedAt, setReceivedAt] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resignArmed, setResignArmed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(0) // часы перерисовываются от этого значения, а не от Date.now() в рендере
  const stRef = useRef<OnlineGameState | null>(null)
  const joined = useRef(false)

  const apply = useCallback((next: OnlineGameState) => {
    const merged = merge(stRef.current, next)
    stRef.current = merged
    setSt(merged)
    setReceivedAt(Date.now())
    setLoad('ready')
    setLost(false)
  }, [])

  const fetchState = useCallback(async () => {
    const cur = stRef.current
    const live = cur?.status === 'active' && cur.white !== undefined
    try {
      const r = await fetch(`/api/chess/games/${encodeURIComponent(id)}${live ? `?since=${cur.ply}` : ''}`, { cache: 'no-store' })
      if (r.status === 401) return setLoad('guest')
      if (r.status === 404) return setLoad('missing')
      if (!r.ok) throw new Error(String(r.status))
      const next = (await r.json()) as OnlineGameState
      if (live && next.status !== cur.status) {
        apply(next)
        return void fetchState() // партия кончилась — свежий полный ответ (Эло, реванш)
      }
      apply(next)
    } catch {
      setLost(true)
    }
  }, [apply, id])

  useEffect(() => {
    void fetchState()
  }, [fetchState])
  useVisiblePoll(fetchState, st?.status === 'active' ? 1000 : st?.status === 'waiting' ? 1500 : 3000, load === 'ready' || lost)

  // ссылка «играть с другом»: первый вошедший не-создатель занимает место сам
  useEffect(() => {
    if (!st?.canJoin || st.invited || joined.current) return
    joined.current = true
    void post('join')
  })

  // часы тикают локально от момента ответа; сервер остаётся источником истины
  const running = st?.status === 'active' && st.ply >= 2
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(iv)
  }, [running])

  const chess = useMemo(() => {
    const c = new Chess(st?.initialFen)
    for (const u of st?.moves ?? []) {
      try {
        c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })
      } catch {
        break
      }
    }
    return c
  }, [st?.initialFen, st?.moves])

  // звук на каждый новый ход (свой и соперника) и на конец партии
  const seen = useRef<{ ply: number; status: string } | null>(null)
  useEffect(() => {
    if (!st) return
    const prev = seen.current
    seen.current = { ply: st.ply, status: st.status }
    if (!prev) return
    if (st.status === 'finished' && prev.status === 'active') return playMoveSound('end')
    if (st.ply > prev.ply) {
      const last = chess.history({ verbose: true }).at(-1)
      playMoveSound(chess.inCheck() ? 'check' : last?.captured ? 'capture' : 'move')
    }
  }, [st, chess])

  async function post(path: string, body?: unknown) {
    setBusy(true)
    setNotice(null)
    try {
      const r = await fetch(`/api/chess/games/${encodeURIComponent(id)}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const b = await r.json().catch(() => null)
      if (r.status === 401) return setLoad('guest')
      if (r.ok && b?.id && path === 'rematch') return router.push(`/chess/game/${b.id}`)
      if (r.ok) return apply(b)
      if (b?.state) apply(b.state)
      if (b?.error === 'TAKEN' || r.status === 403) setNotice(t('taken'))
      else if (b?.error !== 'STALE' && b?.error !== 'GAME_OVER' && b?.error !== 'NOT_ACTIVE') setNotice(t('error'))
      if (!b?.state) void fetchState()
    } catch {
      setNotice(t('error'))
    } finally {
      setBusy(false)
    }
  }

  if (load === 'guest')
    return (
      <Shell title={t('title')}>
        <div className={styles.empty}>
          <h2>{t('guest_title')}</h2>
          <p>{t('guest_text')}</p>
          <Link href="/login" className={styles.primaryBtn}>
            <LogIn size={18} strokeWidth={2} aria-hidden="true" />
            {t('login')}
          </Link>
        </div>
      </Shell>
    )
  if (load === 'missing')
    return (
      <Shell title={t('title')}>
        <div className={styles.empty}>
          <h2>{t('not_found')}</h2>
          <Link href="/chess/online" className={styles.primaryBtn}>{t('to_lobby')}</Link>
        </div>
      </Shell>
    )

  const you = st?.you ?? null
  const orientation: Side = (you === 'b') !== flipped ? 'b' : 'w'
  const active = st?.status === 'active'
  const done = st?.status === 'finished' || st?.status === 'aborted'
  const myTurn = active && you !== null && st!.turn === you
  const last = chess.history({ verbose: true }).at(-1)

  const clock = (side: Side) => {
    if (!st) return 0
    const ms = side === 'w' ? st.whiteMs : st.blackMs
    return running && st.turn === side ? ms - Math.max(0, now - receivedAt) : ms
  }

  const onMove = (m: BoardMove) => {
    if (!st || !myTurn || busy) return
    const probe = new Chess(chess.fen())
    let uci: string
    try {
      const mv = probe.move(m)
      uci = mv.from + mv.to + (mv.promotion ?? '')
    } catch {
      return
    }
    // оптимистично: ход виден сразу, сервер подтверждает или возвращает своё состояние
    const optimistic = { ...st, moves: [...st.moves, uci], ply: st.ply + 1, turn: (st.turn === 'w' ? 'b' : 'w') as Side }
    stRef.current = optimistic
    setSt(optimistic)
    void post('move', { uci, ply: st.ply })
  }

  const copyLink = async () => {
    const url = `${location.origin}/chess/game/${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      ;(document.getElementById('game-link') as HTMLInputElement | null)?.select() // без доступа к буферу — выделяем, копирует сам
    }
  }

  const player = (side: Side) => {
    const p = side === 'w' ? st?.white : st?.black
    const delta = side === 'w' ? st?.whiteDelta : st?.blackDelta
    return <PlayerCard side={side} p={p ?? null} isYou={you === side} clockMs={clock(side)} ticking={running && st?.turn === side} delta={delta ?? null} />
  }

  const endTitle = () => {
    if (!st) return ''
    if (st.status === 'aborted') return t('end_aborted')
    if (st.result === '1/2-1/2') return t('end_draw')
    const winner: Side = st.result === '1-0' ? 'w' : 'b'
    return you ? t(winner === you ? 'end_win' : 'end_loss') : t(winner === 'w' ? 'end_white' : 'end_black')
  }

  const history = chess.history()
  const rows = Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => [history[i * 2], history[i * 2 + 1]] as const)
  const myDelta = you === 'w' ? st?.whiteDelta : you === 'b' ? st?.blackDelta : null
  const myRating = (you === 'w' ? st?.white : you === 'b' ? st?.black : null)?.rating
  const creator = st?.white ?? st?.black

  return (
    <Shell title={st ? `${t('game_title', { tc: st.timeControl })}${st.rated ? ` · ${t('rated')}` : ''}` : t('title')}>
      <div className={styles.gameLayout}>
        <div className={styles.oppArea}>{player(orientation === 'w' ? 'b' : 'w')}</div>
        <section className={styles.boardArea} aria-label={t('title')}>
          <ChessBoard
            fen={chess.fen()}
            orientation={orientation}
            onMove={onMove}
            interactive={!!myTurn && !busy}
            lastMove={last ? { from: last.from, to: last.to } : null}
            check={checkSquare(chess.fen()) ?? undefined}
          />
        </section>
        <div className={styles.meArea}>{player(orientation)}</div>

        <aside className={styles.sideArea}>
          {lost && (
            <p className={styles.alert} role="status">
              <CloudOff size={16} strokeWidth={2} aria-hidden="true" />
              {t('conn_lost')}
            </p>
          )}
          {notice && <p className={styles.alert} role="alert">{notice}</p>}

          {st?.status === 'waiting' && you && (
            <div className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('waiting_title')}</h2>
              {st.invited ? (
                <p className={styles.muted}>{t('invite_sent', { name: st.invited.name })}</p>
              ) : (
                <>
                  <p className={styles.muted}>{t('waiting_text')}</p>
                  <div className={styles.linkRow}>
                    <input id="game-link" readOnly value={`${typeof location === 'undefined' ? '' : location.origin}/chess/game/${id}`} onFocus={(e) => e.target.select()} aria-label={t('copy')} />
                    <button type="button" className={styles.tool} onClick={copyLink}>
                      {copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
                      {t(copied ? 'copied' : 'copy')}
                    </button>
                  </div>
                </>
              )}
              <button type="button" className={styles.tool} onClick={() => post('abort')} disabled={busy}>
                <X size={16} strokeWidth={2} aria-hidden="true" />
                {t('abort')}
              </button>
            </div>
          )}

          {st?.status === 'waiting' && !you && st.canJoin && st.invited && (
            <div className={styles.panelDark}>
              <p className={styles.endTitle}>{t('invite_title', { name: creator?.name ?? '—' })}</p>
              <p className={styles.endSub}>{t('invite_text', { tc: st.timeControl })}</p>
              <div className={styles.row}>
                <button type="button" className={styles.lightBtn} onClick={() => post('join')} disabled={busy}>
                  <Check size={16} strokeWidth={2} aria-hidden="true" />
                  {t('accept')}
                </button>
                <button type="button" className={styles.ghostDark} onClick={() => post('abort')} disabled={busy}>
                  {t('decline')}
                </button>
              </div>
            </div>
          )}

          {st && !you && !st.canJoin && st.status !== 'waiting' && <p className={styles.muted}>{t('spectating')}</p>}
          {st && !you && !st.canJoin && st.status === 'waiting' && <p className={styles.muted}>{t('taken')}</p>}

          {done && st && (
            <div className={styles.panelDark} role="status">
              <p className={styles.endTitle}>{endTitle()}</p>
              {st.termination && <p className={styles.endSub}>{t(`term_${st.termination}`)}</p>}
              {myDelta != null && myRating != null && (
                <p className={styles.elo} data-sign={myDelta > 0 ? 'up' : myDelta < 0 ? 'down' : undefined}>
                  {t('elo_change', { delta: myDelta > 0 ? `+${myDelta}` : String(myDelta), rating: myRating + myDelta })}
                </p>
              )}
              {st.rematchId && you && <p className={styles.endSub}>{t('rematch_incoming')}</p>}
              <div className={styles.row}>
                {you && st.white && st.black && (
                  <button type="button" className={styles.lightBtn} onClick={() => post('rematch')} disabled={busy}>
                    <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                    {st.rematchId ? t('accept') : t('rematch')}
                  </button>
                )}
                {st.ply > 0 && (
                  <Link href={`/chess/analysis?game=${encodeURIComponent(st.id)}`} className={styles.ghostDark}>
                    <ChartLine size={16} strokeWidth={2} aria-hidden="true" />
                    {ta('review_game')}
                  </Link>
                )}
                <Link href="/chess/online" className={styles.ghostDark}>{t('to_lobby')}</Link>
              </div>
            </div>
          )}

          {active && you && st!.drawOfferBy && st!.drawOfferBy !== you && (
            <div className={styles.panel} role="status">
              <p className={styles.panelTitle}>{t('draw_incoming')}</p>
              <div className={styles.row}>
                <button type="button" className={`${styles.tool} ${styles.toolStrong}`} onClick={() => post('draw', { action: 'accept' })} disabled={busy}>
                  {t('accept')}
                </button>
                <button type="button" className={styles.tool} onClick={() => post('draw', { action: 'decline' })} disabled={busy}>
                  {t('decline')}
                </button>
              </div>
            </div>
          )}

          {active && you && st!.ply < 2 && myTurn && <p className={styles.muted}>{t('first_move')}</p>}

          {active && you && (
            <div className={styles.controls}>
              {st!.ply < 2 ? (
                <button type="button" className={styles.tool} onClick={() => post('abort')} disabled={busy}>
                  <X size={16} strokeWidth={2} aria-hidden="true" />
                  {t('abort')}
                </button>
              ) : (
                <>
                  <button type="button" className={styles.tool} onClick={() => post('draw', { action: 'offer' })} disabled={busy || st!.drawOfferBy === you}>
                    <Handshake size={16} strokeWidth={2} aria-hidden="true" />
                    {t(st!.drawOfferBy === you ? 'draw_offered' : 'offer_draw')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.tool} ${resignArmed ? styles.toolDanger : ''}`}
                    onClick={() => (resignArmed ? (setResignArmed(false), post('resign')) : setResignArmed(true))}
                    onBlur={() => setResignArmed(false)}
                    disabled={busy}
                  >
                    <Flag size={16} strokeWidth={2} aria-hidden="true" />
                    {t(resignArmed ? 'resign_confirm' : 'resign')}
                  </button>
                </>
              )}
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t('moves')}</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setFlipped((f) => !f)} aria-label={t('flip')} title={t('flip')}>
                <ArrowUpDown size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            {rows.length === 0 ? (
              <p className={styles.muted}>{t('no_moves')}</p>
            ) : (
              <ol className={styles.moves}>
                {rows.map(([w, b], i) => (
                  <li key={i}>
                    <span className={styles.moveNo}>{i + 1}.</span>
                    <span className={i * 2 === history.length - 1 ? styles.moveLast : undefined}>{w}</span>
                    <span className={i * 2 + 1 === history.length - 1 ? styles.moveLast : undefined}>{b ?? ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      {children}
    </div>
  )
}

function PlayerCard({ side, p, isYou, clockMs, ticking, delta }: { side: Side; p: OnlinePlayer | null; isYou: boolean; clockMs: number; ticking: boolean; delta: number | null }) {
  const t = useTranslations('chess.online')
  return (
    <div className={styles.player} data-ticking={ticking || undefined}>
      <span className={styles.avatar} data-side={side} aria-hidden="true">
        {p?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- аватары с внешних доменов, как в остальном приложении
          <img src={p.avatarUrl} alt="" width={40} height={40} />
        ) : (
          (p?.name ?? '?').slice(0, 1)
        )}
      </span>
      <span className={styles.playerText}>
        {p ? (
          <Link href={`/chess/u/${p.id}`} className={styles.playerName}>
            {p.name}
            {isYou && <span className={styles.youTag}>{t('you')}</span>}
          </Link>
        ) : (
          <span className={`${styles.playerName} ${styles.muted}`}>{t('waiting_opponent')}</span>
        )}
        <span className={styles.playerMeta}>
          {t(side === 'w' ? 'white' : 'black')}
          {p?.rating != null && ` · ${p.rating}`}
          {delta != null && (
            <span className={styles.delta} data-sign={delta > 0 ? 'up' : delta < 0 ? 'down' : undefined}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </span>
      </span>
      <span className={styles.clock} data-low={clockMs < 20_000 || undefined} role="timer" aria-live="off">
        {formatClock(clockMs)}
      </span>
    </div>
  )
}
