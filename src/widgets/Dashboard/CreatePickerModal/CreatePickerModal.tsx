'use client'

import { useRouter } from 'next/navigation'
import styles from './CreatePickerModal.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  onService: () => void
}

function IconBriefcase() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="12.01" />
      <path d="M2 12h20" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function IconChecklist() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}

const OPTIONS = [
  { key: 'service', label: 'Услуга', icon: <IconBriefcase />, color: '#534AB7' },
  { key: 'post',    label: 'Пост',   icon: <IconFile />,      color: '#0369A1' },
  { key: 'roadmap', label: 'Road Map', icon: <IconMap />,     color: '#059669' },
  { key: 'test',    label: 'Тест',   icon: <IconChecklist />, color: '#B45309' },
] as const

export function CreatePickerModal({ open, onClose, onService }: Props) {
  const router = useRouter()

  if (!open) return null

  function handleOption(key: (typeof OPTIONS)[number]['key']) {
    switch (key) {
      case 'service':
        onClose()
        onService()
        break
      case 'post':
        onClose()
        router.push('/create-post')
        break
      case 'roadmap':
        onClose()
        router.push('/create-road-map')
        break
      case 'test':
        onClose()
        router.push('/create-test')
        break
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 className={styles.heading}>Что создаём?</h2>
        <div className={styles.grid}>
          {OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={styles.option}
              onClick={() => handleOption(opt.key)}
              style={{ '--accent': opt.color } as React.CSSProperties}
            >
              <span className={styles.optionIcon}>{opt.icon}</span>
              <span className={styles.optionLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
