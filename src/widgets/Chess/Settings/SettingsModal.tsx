'use client'

import { useTranslations } from 'next-intl'
import { ChessBoard, SkinPicker } from '@/widgets/Chess/Board'
import { useLocalPref } from '@/shared/lib/chess/localPref'
import { useSoundEnabled } from '@/shared/lib/chess/sound'
import { ChessDialog } from './ChessDialog'
import styles from './Settings.module.scss'

// after 1.e4 e5 2.Nf3 Nc6 3.Bb5 — a familiar picture to judge colours, pieces and coordinates on
const PREVIEW_FEN = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'

/** Personal settings of the chess section. Everything is localStorage, applied live to every board on the page. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('chess.play')
  const tc = useTranslations('chess.core')
  return (
    <ChessDialog open={open} onClose={onClose} title={t('settings')}>
      <div className={styles.settings}>
        <div className={styles.previewCol}>
          <ChessBoard fen={PREVIEW_FEN} interactive={false} lastMove={{ from: 'f1', to: 'b5' }} className={styles.preview} />
          <SkinPicker />
        </div>
        <div className={styles.toggles}>
          <h3 className={styles.group}>{t('set_game')}</h3>
          <Toggle k="gw-chess-confirm" fallback="0" label={t('opt_confirm')} hint={t('opt_confirm_hint')} />
          <Toggle k="gw-chess-coords" fallback="1" label={t('opt_coords')} />
          <Toggle k="gw-chess-anim" fallback="1" label={t('opt_anim')} />
          <SoundToggle label={t('opt_sound')} />
          <h3 className={styles.group}>{tc('coach_title')}</h3>
          <Toggle k="gw-chess-hints" fallback="1" label={t('opt_hints')} hint={t('opt_hints_hint')} />
          <Toggle k="gw-chess-evalbar" fallback="1" label={t('opt_evalbar')} />
          <Toggle k="gw-chess-autoexplain" fallback="0" label={t('opt_auto')} hint={t('opt_auto_hint')} />
        </div>
      </div>
    </ChessDialog>
  )
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className={styles.toggle}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Toggle({ k, fallback, label, hint }: { k: string; fallback: '0' | '1'; label: string; hint?: string }) {
  const [v, set] = useLocalPref(k, fallback)
  return <Switch checked={v === '1'} onChange={(on) => set(on ? '1' : '0')} label={label} hint={hint} />
}

function SoundToggle({ label }: { label: string }) {
  const [on, set] = useSoundEnabled()
  return <Switch checked={on} onChange={set} label={label} />
}
