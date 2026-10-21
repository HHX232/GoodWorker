'use client'

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, X, Zap } from 'lucide-react'
import { ANALYSIS_KEY, loadGame, type AnalysisHandoff } from '@/shared/lib/chess/reviewModel'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { useMyChessProgress } from '@/widgets/Chess/Progress'
import { HOTKEYS } from './shellKeys'
import { ChessDialog } from '@/widgets/Chess/Settings'
import styles from './Shell.module.scss'

type LayerProps = { open: boolean; onClose: () => void }

const PUZZLE_MODES = ['rated', 'theme', 'series', 'opening'] as const

/** Online lobby (quick pairing, link for a friend, player search) without leaving the page. */
export function LobbyModal({ open, onClose, children }: LayerProps & { children: ReactNode }) {
  const t = useTranslations('chess.online')
  const tp = useTranslations('chess.play')
  return (
    <ChessDialog open={open} onClose={onClose} title={t('title')} wide>
      <div className={styles.lobby}>{children}</div>
      <Link href="/chess/online" className={styles.more} onClick={onClose}>
        {tp('sh_lobby_full')}
        <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
      </Link>
    </ChessDialog>
  )
}

/** Puzzle modes and storm runs: one click from anywhere straight into the chosen mode. */
export function ModesModal({ open, onClose }: LayerProps) {
  const t = useTranslations('chess.play')
  const tl = useTranslations('chess.learn')
  const ts = useTranslations('chess.storm')
  const me = useMyChessProgress()
  const best = (m: 3 | 5) => (me.status === 'ready' ? (m === 3 ? me.profile.stormBest3 : me.profile.stormBest5) : 0)
  return (
    <ChessDialog open={open} onClose={onClose} title={t('sh_modes_title')}>
      <h3 className={styles.group}>{t('sh_modes_puzzles')}</h3>
      <ul className={styles.modes}>
        {PUZZLE_MODES.map((m) => (
          <li key={m}>
            <Link href={`/chess/puzzles?mode=${m}`} className={styles.mode} onClick={onClose}>
              <strong>{tl(`pz_mode_${m}`)}</strong>
              <span>{tl(`pz_mode_${m}_desc`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h3 className={styles.group}>{t('sh_modes_storm')}</h3>
      <ul className={styles.storm}>
        {([3, 5] as const).map((m) => (
          <li key={m}>
            <Link href={`/chess/storm?mode=${m}`} className={styles.stormCard} onClick={onClose}>
              <Zap size={18} strokeWidth={2} aria-hidden="true" />
              <strong>{t('sh_storm_go', { n: m })}</strong>
              <span>{best(m) ? ts('best', { n: best(m) }) : ts('best_none')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ChessDialog>
  )
}

/** Paste a PGN → /chess/analysis through the same sessionStorage handoff the game pages use. */
export function PgnModal({ open, onClose }: LayerProps) {
  const t = useTranslations('chess.play')
  const ta = useTranslations('chess.analysis')
  const router = useRouter()
  const [pgn, setPgn] = useState('')
  const [bad, setBad] = useState(false)
  const id = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!loadGame({ pgn })) return setBad(true)
    try {
      sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify({ pgn, source: 'pgn' } satisfies AnalysisHandoff))
    } catch {}
    onClose()
    setPgn('')
    // a fresh `k` remounts the analysis page even when it is already open
    router.push(`/chess/analysis?k=${Date.now()}`)
  }

  return (
    <ChessDialog open={open} onClose={onClose} title={t('sh_pgn_title')}>
      <form className={styles.pgnForm} onSubmit={submit}>
        <label htmlFor={id} className={styles.srOnly}>{ta('paste_title')}</label>
        <textarea
          id={id}
          className={styles.pgn}
          value={pgn}
          onChange={(e) => {
            setPgn(e.target.value)
            setBad(false)
          }}
          placeholder={ta('paste_placeholder')}
          rows={8}
          spellCheck={false}
          autoFocus
          aria-describedby={`${id}-hint`}
          aria-invalid={bad}
        />
        <p id={`${id}-hint`} className={bad ? styles.error : styles.muted}>{bad ? ta('bad_pgn') : ta('paste_hint')}</p>
        <button type="submit" className={styles.primary} disabled={!pgn.trim()}>
          {t('sh_pgn_go')}
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </ChessDialog>
  )
}

export function KeysModal({ open, onClose, onSettings }: LayerProps & { onSettings: () => void }) {
  const t = useTranslations('chess.play')
  const [on] = useLocalPref(HOTKEYS, '1')
  const rows: [string[], string][] = [
    [['N'], t('sh_key_new')],
    [['P'], t('sh_key_puzzles')],
    [['/'], t('sh_key_search')],
    [['?'], t('sh_key_keys')],
    [['Esc'], t('sh_key_esc')],
    [['←', '→'], t('sh_key_board')],
  ]
  return (
    <ChessDialog open={open} onClose={onClose} title={t('sh_keys')}>
      <dl className={styles.keys}>
        {rows.map(([keys, text]) => (
          <div key={text} className={styles.keyRow}>
            <dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.keysNote}>
        {t(on === '0' ? 'sh_keys_off' : 'sh_keys_where')}{' '}
        <button type="button" className={styles.linkBtn} onClick={onSettings}>
          {t('settings')}
        </button>
      </p>
    </ChessDialog>
  )
}

/** My profile and badges as a side panel over any chess page; /chess/profile stays for direct links. */
export function ProfileDrawer({ open, onClose, children }: LayerProps & { children: ReactNode }) {
  const t = useTranslations('chess.play')
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className={styles.drawerBody}>
          <header className={styles.drawerHead}>
            <h2 id={id}>{t('sh_profile')}</h2>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('ng_close')}>
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </header>
          {children}
          <Link href="/chess/profile" className={styles.more} onClick={onClose}>
            {t('sh_profile_full')}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      )}
    </dialog>
  )
}
