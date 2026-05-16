'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { RefObject, useState } from 'react'
import styles from './DashboardProfilePanel.module.scss'

const VideoRoom = dynamic(() => import('@/widgets/VideoRoom/VideoRoom'), { ssr: false })

interface Props {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  statsId: string
  saving: boolean
  saveError: string
  saveSuccess: boolean
  avatarInputRef: RefObject<HTMLInputElement | null>
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onAvatarUploadClick: () => void
  onAvatarRemove: () => void
  onSave: () => void
  onChangeEmail: () => void
  onChangePassword: () => void
  onTranscripts: () => void
  onBookmarks: () => void
}

export function DashboardProfilePanel({
  name, email, phone, avatarUrl, statsId,
  saving, saveError, saveSuccess,
  avatarInputRef,
  onNameChange, onPhoneChange,
  onAvatarUploadClick, onAvatarRemove,
  onSave,
  onChangeEmail, onChangePassword,
  onTranscripts, onBookmarks,
}: Props) {
  const t = useTranslations('dashboard')
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <aside className={styles.panel}>
      <div className={styles.scroll}>

        {/* Avatar hero */}
        <div className={styles.avatarHero}>
          <div className={styles.avatarWrap} onClick={onAvatarUploadClick}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <Image width={72} height={72} src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#ABABAB" strokeWidth="1.5" />
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div className={styles.avatarEditBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <div className={styles.heroName}>{name || t('yourName')}</div>
          <div className={styles.heroRole}>{t('teacher')}</div>
        </div>

        <div className={styles.divider} />

        {/* Basic info */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('basicInfo')}</div>
          <div className={styles.field}>
            <label className={styles.label}>{t('fullName')}</label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder={t('yourName')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('phone')}</label>
            <input
              className={styles.input}
              type="tel"
              value={phone}
              onChange={e => onPhoneChange(e.target.value)}
              placeholder="+7 999 000 00 00"
            />
          </div>
          <div className={styles.saveRow}>
            <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
              {saving && <span className={styles.spinner} />}
              {saving ? t('saving') : t('saveChanges')}
            </button>
          </div>
          {saveError && <span className={styles.errorMsg}>{saveError}</span>}
          {saveSuccess && <span className={styles.successMsg}>{t('changesSaved')}</span>}
          {avatarUrl && (
            <button
              type="button"
              style={{
                fontSize: '12px', color: '#EF4444', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '0', textAlign: 'left',
              }}
              onClick={onAvatarRemove}
            >
              {t('removePhoto')}
            </button>
          )}
        </div>

        <div className={styles.divider} />

        {/* Security */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('security')}</div>
          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>{t('email')}</span>
              <span className={styles.securityValue}>{email}</span>
            </div>
            <button className={styles.securityBtn} onClick={onChangeEmail}>{t('change')}</button>
          </div>
          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>{t('password')}</span>
              <span className={styles.securityValue}>••••••••</span>
            </div>
            <button className={styles.securityBtn} onClick={onChangePassword}>{t('change')}</button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Quick links */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('historyTools')}</div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={onTranscripts}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
              {t('callTranscripts')}
            </button>

            <button className={styles.actionBtn} onClick={onBookmarks}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </span>
              {t('bookmarks')}
            </button>

            <Link href={`/statistics/${statsId}`} className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              {t('statistics')}
            </Link>

            <Link href={`/calendar/${statsId}`} className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              {t('calendar')}
            </Link>

            <Link href="/complaints" className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              {t('complaintsLink')}
            </Link>

            <Link href="/notifications" className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              {t('notificationsLink')}
            </Link>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Video room */}
        <div className={styles.section}>
          <button className={styles.videoToggle} onClick={() => setVideoOpen(v => !v)}>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
                <rect x="1" y="6" width="14" height="12" rx="2" />
              </svg>
              {t('videoRoom')}
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`${styles.videoChevron} ${videoOpen ? styles.videoChevronOpen : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {videoOpen && <VideoRoom defaultName={name} />}
        </div>

      </div>
    </aside>
  )
}
