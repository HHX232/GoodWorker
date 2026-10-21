'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link2, LogIn, Search, Swords, X, Zap } from 'lucide-react'
import type { GameListItem, PlayerHit } from '@/shared/lib/chess/server/onlineStore'
import { useVisiblePoll } from './useVisiblePoll'
import styles from './Online.module.scss'

const CONTROLS = [
  { tc: '1+0', key: 'tc_bullet' },
  { tc: '3+2', key: 'tc_blitz' },
  { tc: '5+0', key: 'tc_blitz' },
  { tc: '10+0', key: 'tc_rapid' },
] as const
type Color = 'w' | 'random' | 'b'
type Lists = { active: GameListItem[]; invites: GameListItem[] }

export function OnlineLobbyPage({ tc }: { tc?: string }) {
  return (
    <Shell>
      <OnlineLobby initialTc={tc} />
    </Shell>
  )
}

/**
 * Quick pairing, a link for a friend, my games, player search. The page above and the shell's lobby modal
 * render the same body; unmounting it (leaving the page, closing the modal) withdraws the seek.
 */
/** `autoSeek` starts quick pairing on arrival (the hub's «Start a game»). */
export function OnlineLobby({ initialTc, search, autoSeek }: { initialTc?: string; search?: boolean; autoSeek?: boolean }) {
  const t = useTranslations('chess.online')
  const router = useRouter()
  const [guest, setGuest] = useState(false)
  const [tc, setTc] = useState<string>(CONTROLS.some((c) => c.tc === initialTc) ? initialTc! : '3+2')
  const [color, setColor] = useState<Color>('random')
  const [seek, setSeek] = useState<{ since: number; window: number; rating: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [lists, setLists] = useState<Lists | null>(null)
  const [rating, setRating] = useState(1200)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlayerHit[] | null>(null)
  const [now, setNow] = useState(0)
  const seekTc = useRef(tc)

  const loadLists = useCallback(async () => {
    const r = await fetch('/api/chess/games', { cache: 'no-store' }).catch(() => null)
    if (r?.status === 401) return setGuest(true)
    if (r?.ok) setLists(await r.json())
  }, [])

  useEffect(() => {
    void loadLists()
    fetch('/api/chess/profile/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.profile && setRating(b.profile.rating))
      .catch(() => {})
  }, [loadLists])
  useVisiblePoll(loadLists, 8000, !guest)

  // ─── быстрый подбор: POST /seek — он же опрос, пока ждём ────────────────────
  const pollSeek = useCallback(async () => {
    const r = await fetch('/api/chess/seek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timeControl: seekTc.current }) }).catch(() => null)
    if (r?.status === 401) return setGuest(true)
    const b = r?.ok ? await r.json() : null
    if (b?.gameId) {
      setSeek(null)
      return router.push(`/chess/game/${b.gameId}`)
    }
    if (b?.waiting) setSeek((s) => (s ? { ...s, window: b.window } : s))
  }, [router])
  useVisiblePoll(pollSeek, 2000, seek !== null)
  useEffect(() => {
    if (!seek) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [seek])

  const startSeek = () => {
    seekTc.current = tc
    setSeek({ since: Date.now(), window: 200, rating })
    void pollSeek()
  }
  const cancelSeek = async () => {
    setSeek(null)
    const b = await fetch('/api/chess/seek', { method: 'DELETE' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (b?.gameId) router.push(`/chess/game/${b.gameId}`) // соперник успел найтись
  }
  // «/» — сразу в поиск игроков; после showModal диалога (он сам ставит фокус), поэтому через кадр
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!search) return
    const id = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [search])

  // «Начать партию» на главной: подбор стартует сразу, как только известен рейтинг-заглушка
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoSeek || autoStarted.current) return
    autoStarted.current = true
    startSeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival
  }, [autoSeek])
  // уход со страницы снимает заявку
  useEffect(() => () => void fetch('/api/chess/seek', { method: 'DELETE', keepalive: true }).catch(() => {}), [])

  // ─── партия по ссылке / вызов ──────────────────────────────────────────────
  const create = async (opponentId?: string) => {
    setBusy(true)
    setError(false)
    try {
      const r = await fetch('/api/chess/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeControl: tc, color, opponentId }),
      })
      if (r.status === 401) return setGuest(true)
      const b = await r.json()
      if (!r.ok || !b.id) throw new Error()
      if (!opponentId) await navigator.clipboard?.writeText(`${location.origin}/chess/game/${b.id}`).catch(() => {})
      router.push(`/chess/game/${b.id}`)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  const decline = async (id: string) => {
    await fetch(`/api/chess/games/${id}/abort`, { method: 'POST' }).catch(() => {})
    void loadLists()
  }

  // ─── поиск игроков ─────────────────────────────────────────────────────────
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) return
    let live = true
    const h = setTimeout(async () => {
      const r = await fetch(`/api/chess/players?q=${encodeURIComponent(query)}`).catch(() => null)
      if (live && r?.ok) setHits((await r.json()).players)
    }, 250)
    return () => {
      live = false
      clearTimeout(h)
    }
  }, [q])

  if (guest)
    return (
      <div className={styles.empty}>
        <h2>{t('guest_title')}</h2>
        <p>{t('guest_text')}</p>
        <Link href="/login" className={styles.primaryBtn}>
          <LogIn size={18} strokeWidth={2} aria-hidden="true" />
          {t('login')}
        </Link>
      </div>
    )

  const waited = seek ? Math.max(0, Math.floor((now - seek.since) / 1000)) : 0
  const shownHits = q.trim().length >= 2 ? hits : null

  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyMain}>
        <section className={styles.hero} aria-labelledby="quick-title">
          <div>
            <h2 id="quick-title" className={styles.heroTitle}>{t('quick_title')}</h2>
            <p className={styles.heroText}>{t('quick_text')} {t('rating', { n: rating })}</p>
          </div>
          <div className={styles.field}>
            <span className={styles.label} id="tc-label">{t('tc_label')}</span>
            <div className={styles.tcGrid} role="group" aria-labelledby="tc-label">
              {CONTROLS.map((c) => (
                <button key={c.tc} type="button" aria-pressed={tc === c.tc} disabled={!!seek} onClick={() => setTc(c.tc)}>
                  <strong>{c.tc}</strong>
                  <span>{t(c.key)}</span>
                </button>
              ))}
            </div>
          </div>
          {seek ? (
            <div className={styles.seeking} role="status">
              <span className={styles.pulse} aria-hidden="true" />
              <span className={styles.seekingText}>
                <strong>{t('seeking')}</strong>
                <span>{t('seeking_window', { from: seek.rating - seek.window, to: seek.rating + seek.window, sec: waited })}</span>
              </span>
              <button type="button" className={styles.ghostDark} onClick={cancelSeek}>
                <X size={16} strokeWidth={2} aria-hidden="true" />
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className={styles.bigBtn} onClick={startSeek}>
              <Zap size={18} strokeWidth={2} aria-hidden="true" />
              {t('find')}
            </button>
          )}
        </section>

        <section className={styles.card} aria-labelledby="friend-title">
          <h2 id="friend-title" className={styles.panelTitle}>{t('friend_title')}</h2>
          <p className={styles.muted}>{t('friend_text')}</p>
          <div className={styles.field}>
            <span className={styles.label} id="color-label">{t('color')} · {tc}</span>
            <div className={styles.seg} role="group" aria-labelledby="color-label">
              {(['w', 'random', 'b'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)}>
                  {c !== 'random' && <span className={styles.swatch} data-side={c} aria-hidden="true" />}
                  {t(c === 'w' ? 'white' : c === 'b' ? 'black' : 'random')}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className={`${styles.tool} ${styles.toolStrong}`} onClick={() => create()} disabled={busy}>
            <Link2 size={16} strokeWidth={2} aria-hidden="true" />
            {t('create_link')}
          </button>
          {error && <p className={styles.alert} role="alert">{t('error')}</p>}
        </section>
      </div>

      <div className={styles.lobbySide}>
        {!!lists?.invites.length && (
          <section className={styles.card} aria-labelledby="inv-title">
            <h2 id="inv-title" className={styles.panelTitle}>{t('invites')}</h2>
            <ul className={styles.list}>
              {lists.invites.map((g) => (
                <li key={g.id}>
                  <span className={styles.listText}>
                    <strong>{g.opponent?.name ?? '—'}</strong>
                    <span>{g.timeControl}</span>
                  </span>
                  <Link href={`/chess/game/${g.id}`} className={`${styles.tool} ${styles.toolStrong}`}>{t('accept')}</Link>
                  <button type="button" className={styles.tool} onClick={() => decline(g.id)}>{t('decline')}</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.card} aria-labelledby="mine-title">
          <h2 id="mine-title" className={styles.panelTitle}>{t('my_games')}</h2>
          {!lists ? (
            <div className={styles.skeleton} aria-busy="true" />
          ) : lists.active.length === 0 ? (
            <p className={styles.muted}>{t('no_games')}</p>
          ) : (
            <ul className={styles.list}>
              {lists.active.map((g) => (
                <li key={g.id}>
                  <span className={styles.listText}>
                    <strong>{g.opponent ? t('vs', { name: g.opponent.name }) : t('open_seat')}</strong>
                    <span>
                      {g.timeControl} · {t(g.status === 'waiting' ? 'waiting_opponent' : 'in_progress')}
                    </span>
                  </span>
                  <Link href={`/chess/game/${g.id}`} className={styles.tool}>{t('continue')}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card} aria-labelledby="players-title">
          <h2 id="players-title" className={styles.panelTitle}>{t('players_title')}</h2>
          <label className={styles.search}>
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('players_placeholder')} aria-label={t('players_placeholder')} />
          </label>
          {!shownHits && <p className={styles.muted}>{t('players_hint')}</p>}
          {shownHits?.length === 0 && <p className={styles.muted}>{t('players_empty')}</p>}
          {!!shownHits?.length && (
            <ul className={styles.list}>
              {shownHits.map((p) => (
                <li key={p.id}>
                  <Link href={`/chess/u/${p.id}`} className={styles.listText}>
                    <strong>{p.name}</strong>
                    <span>
                      {t('rating', { n: p.rating })}
                      {p.isChessTutor && <span className={styles.tutorTag}>{t('tutor_tag')}</span>}
                    </span>
                  </Link>
                  <button type="button" className={styles.tool} onClick={() => create(p.id)} disabled={busy}>
                    <Swords size={16} strokeWidth={2} aria-hidden="true" />
                    {t('challenge')} {tc}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('chess.online')
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('title')}</h1>
      </header>
      {children}
    </div>
  )
}
