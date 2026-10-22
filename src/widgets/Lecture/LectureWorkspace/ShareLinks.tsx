'use client'

import { CheckIcon, CopyIcon, EyeIcon, PencilIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './LectureWorkspace.module.scss'

type Mode = 'view' | 'edit'

/**
 * Public links to the notes: read-only and read-write, each switched on/off
 * on its own. Off → the link is revoked for good; on again → a new one.
 * People on a link don't get the AI (paid from the owner's lecture tariff).
 */
export function ShareLinks({ lectureId, viewToken, editToken, onChange }: {
  lectureId: string
  viewToken: string | null
  editToken: string | null
  onChange: (mode: Mode, token: string | null) => void
}) {
  const t = useTranslations('lecture')
  const [busy, setBusy] = useState<Mode | null>(null)
  const [copied, setCopied] = useState<Mode | null>(null)
  const url = (token: string) => `${window.location.origin}/lecture/shared/${token}`

  const toggle = async (mode: Mode, on: boolean) => {
    setBusy(mode)
    try {
      const res = await fetch(on ? `/api/lecture/${lectureId}/share` : `/api/lecture/${lectureId}/share?mode=${mode}`, {
        method: on ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: on ? JSON.stringify({ mode }) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error()
      onChange(mode, on ? data.token : null)
    } catch {
      toast.error(t('shareFailed'))
    } finally {
      setBusy(null)
    }
  }

  const copy = async (mode: Mode, token: string) => {
    try {
      await navigator.clipboard.writeText(url(token))
      setCopied(mode)
      setTimeout(() => setCopied(c => (c === mode ? null : c)), 1600)
    } catch {
      window.prompt(t('shareCopyPrompt'), url(token))
    }
  }

  const rows: { mode: Mode; token: string | null; icon: React.ReactNode }[] = [
    { mode: 'view', token: viewToken, icon: <EyeIcon size={15} /> },
    { mode: 'edit', token: editToken, icon: <PencilIcon size={15} /> },
  ]
  return (
    <div className={styles.share}>
      {rows.map(({ mode, token, icon }) => (
        <div key={mode} className={styles.shareRow}>
          <div className={styles.shareHead}>
            <span className={styles.shareIcon}>{icon}</span>
            <span className={styles.shareText}>
              <strong>{t(mode === 'view' ? 'shareView' : 'shareEdit')}</strong>
              <small>{t(mode === 'view' ? 'shareViewHint' : 'shareEditHint')}</small>
            </span>
            <input type="checkbox" className={styles.switch} checked={!!token} disabled={busy === mode} onChange={e => toggle(mode, e.target.checked)} aria-label={t(mode === 'view' ? 'shareView' : 'shareEdit')} />
          </div>
          {token && (
            <div className={styles.shareLink}>
              <input readOnly value={url(token)} onFocus={e => e.currentTarget.select()} aria-label={t('shareLink')} />
              <button type="button" onClick={() => copy(mode, token)} aria-label={t('shareCopy')} title={t('shareCopy')}>
                {copied === mode ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
