'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BookOpen, ChartLine, ChessKnight, ChessPawn, CircleUserRound, Globe, Keyboard, Puzzle, Search, Settings2, Zap, type LucideIcon } from 'lucide-react'
import { StreakFlame, useMyChessProgress } from '@/widgets/Chess/Progress'
import { NewGameModal, SettingsModal, type BotChoice, type NewGameTab } from '@/widgets/Chess/Settings'
import { readPref } from '@/shared/lib/chess/localPref'
import { HOTKEYS, shellKey } from './shellKeys'
import { KeysModal, LobbyModal, ModesModal, PgnModal, ProfileDrawer } from './ShellLayers'
import styles from './Shell.module.scss'

export type ShellLayer =
  | { k: 'new'; tab?: NewGameTab; bot?: string }
  /** `tc` + `seek` — quick pairing starts at once (the hub's «Start a game») */
  | { k: 'online'; search?: boolean; tc?: string; seek?: boolean }
  | { k: 'modes' }
  | { k: 'pgn' }
  | { k: 'profile' }
  | { k: 'settings' }
  | { k: 'keys' }

type NewGameHandler = (tab?: NewGameTab) => void
type ShellApi = {
  open: (l: ShellLayer) => void
  /** A page that runs its own game (/chess/play) takes over "New game": the shell's modal would only navigate. */
  setNewGameHandler: (fn: NewGameHandler | null) => void
}

const ShellCtx = createContext<ShellApi | null>(null)
/** Null outside the chess section (e.g. a chess widget on a tutor profile). */
export const useChessShell = () => useContext(ShellCtx)

type NavItem = { id: string; icon: LucideIcon; label: string; layer?: ShellLayer; href?: string; match: (p: string) => boolean }

export type ChessShellProps = {
  children: ReactNode
  /** the online lobby body (page code); `search` focuses player search */
  lobby: (opts: { search: boolean; tc?: string; seek: boolean }) => ReactNode
  /** my chess profile, compact */
  profile: ReactNode
}

/**
 * One frame for every /chess/* page: a narrow rail (desktop) or a bottom bar (phones) with the sections,
 * a top bar with the streak, the rating and settings, and the layers (modals, the profile drawer)
 * any page can open. Hotkeys: N, P, /, ?; Esc closes the open layer (native <dialog>).
 */
export function ChessShell({ children, lobby, profile }: ChessShellProps) {
  const t = useTranslations('chess.play')
  const router = useRouter()
  const pathname = usePathname() ?? '/chess'
  const me = useMyChessProgress()
  const [layer, setLayer] = useState<ShellLayer | null>(null)
  const newGameHandler = useRef<NewGameHandler | null>(null)

  // navigation closes whatever was open (a lobby that found a game, a modal link)
  const [at, setAt] = useState(pathname)
  if (at !== pathname) {
    setAt(pathname)
    setLayer(null)
  }

  const open = useCallback((l: ShellLayer) => {
    if (l.k === 'new' && newGameHandler.current) return newGameHandler.current(l.tab)
    setLayer(l)
  }, [])
  const api = useMemo<ShellApi>(() => ({ open, setNewGameHandler: (fn) => void (newGameHandler.current = fn) }), [open])
  const close = () => setLayer(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || document.querySelector('dialog[open]')) return
      if (readPref(HOTKEYS) === '0') return // switched off in Settings
      const action = shellKey(e)
      if (!action) return
      e.preventDefault() // "/" would start Firefox quick find
      open(action === 'new' ? { k: 'new' } : action === 'puzzles' ? { k: 'modes' } : action === 'search' ? { k: 'online', search: true } : { k: 'keys' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const nav: NavItem[] = [
    { id: 'play', icon: ChessPawn, label: t('sh_play'), layer: { k: 'new' }, match: (p) => p.startsWith('/chess/play') },
    { id: 'online', icon: Globe, label: t('sh_online'), layer: { k: 'online' }, match: (p) => p.startsWith('/chess/online') || p.startsWith('/chess/game') },
    { id: 'puzzles', icon: Puzzle, label: t('sh_puzzles'), layer: { k: 'modes' }, match: (p) => p.startsWith('/chess/puzzles') },
    { id: 'storm', icon: Zap, label: t('sh_storm'), layer: { k: 'modes' }, match: (p) => p.startsWith('/chess/storm') },
    { id: 'learn', icon: BookOpen, label: t('sh_learn'), href: '/chess/learn', match: (p) => p.startsWith('/chess/learn') },
    { id: 'review', icon: ChartLine, label: t('sh_review'), layer: { k: 'pgn' }, match: (p) => p.startsWith('/chess/analysis') },
    { id: 'profile', icon: CircleUserRound, label: t('sh_profile'), layer: { k: 'profile' }, match: (p) => p.startsWith('/chess/profile') || p.startsWith('/chess/u/') },
  ]

  const playBot = (c: BotChoice) => router.push(`/chess/play?new=bot&bot=${c.botId}&color=${c.color}&coach=${c.coach ? 1 : 0}`)

  return (
    <ShellCtx.Provider value={api}>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label={t('sh_nav')}>
          <Link href="/chess" className={styles.brand} aria-current={pathname === '/chess' ? 'page' : undefined} aria-label={t('hub_title')} title={t('hub_title')}>
            <ChessKnight size={28} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <ul className={styles.items}>
            {nav.map((n) => {
              const current = n.match(pathname)
              const body = (
                <>
                  <n.icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  <span>{n.label}</span>
                </>
              )
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className={styles.item} aria-current={current ? 'page' : undefined}>{body}</Link>
                  ) : (
                    <button type="button" className={styles.item} data-current={current || undefined} onClick={() => open(n.layer!)} aria-haspopup="dialog">
                      {body}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={styles.main}>
          <div className={styles.bar}>
            <Link href="/chess" className={styles.barBrand}>
              <ChessKnight size={20} strokeWidth={1.75} aria-hidden="true" />
              {t('hub_title')}
            </Link>
            <div className={styles.barTools}>
              <button type="button" className={styles.iconBtn} onClick={() => open({ k: 'online', search: true })} aria-label={t('sh_search')} title={`${t('sh_search')} — /`}>
                <Search size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <StreakFlame />
              {me.status === 'ready' && (
                <button type="button" className={styles.rating} onClick={() => open({ k: 'profile' })} aria-label={t('sh_rating_aria', { n: me.profile.rating })}>
                  <span className={styles.ratingLabel}>{t('sh_rating')}</span>
                  <span className={styles.ratingValue}>{me.profile.rating}</span>
                </button>
              )}
              <button type="button" className={`${styles.iconBtn} ${styles.keysBtn}`} onClick={() => open({ k: 'keys' })} aria-label={t('sh_keys')} title={`${t('sh_keys')} — ?`}>
                <Keyboard size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => open({ k: 'settings' })} aria-label={t('settings')} title={t('settings')}>
                <Settings2 size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>

      <NewGameModal
        open={layer?.k === 'new'}
        tab={layer?.k === 'new' ? layer.tab : undefined}
        onClose={close}
        onBot={playBot}
        onDuo={() => router.push('/chess/play?new=duo')}
        bot={layer?.k === 'new' && layer.bot ? { botId: layer.bot } : undefined}
      />
      <SettingsModal open={layer?.k === 'settings'} onClose={close} />
      <LobbyModal open={layer?.k === 'online'} onClose={close}>
        {layer?.k === 'online' && lobby({ search: !!layer.search, tc: layer.tc, seek: !!layer.seek })}
      </LobbyModal>
      <ModesModal open={layer?.k === 'modes'} onClose={close} />
      <PgnModal open={layer?.k === 'pgn'} onClose={close} />
      <KeysModal open={layer?.k === 'keys'} onClose={close} onSettings={() => setLayer({ k: 'settings' })} />
      <ProfileDrawer open={layer?.k === 'profile'} onClose={close}>
        {profile}
      </ProfileDrawer>
    </ShellCtx.Provider>
  )
}
