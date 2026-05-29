'use client'
import {useTranslations} from 'next-intl'
import styles from './SaveTestButton.module.scss'

interface Props {
  save: () => void
  status: 'idle' | 'saving' | 'saved' | 'error'
}

export function SaveTestButton({save, status}: Props) {
  const t = useTranslations('CreateTestPage')

  const label = {
    idle: t('saveTest'),
    saving: t('saving'),
    saved: t('savedOk'),
    error: t('retryAfterError'),
  }[status]

  return (
    <button type='button' className={`${styles.btn} ${styles[status]}`} onClick={save} disabled={status === 'saving'}>
      {label}
    </button>
  )
}
