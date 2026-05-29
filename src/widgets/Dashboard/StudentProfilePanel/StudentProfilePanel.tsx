'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import styles from './StudentProfilePanel.module.scss'

import { VideoCallModal } from '@/widgets/Dashboard/VideoCallModal/VideoCallModal'
import { toast } from 'sonner'

// ─── Telegram icon ────────────────────────────────────────

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M21.997 12C21.997 17.5228 17.5198 22 11.997 22C6.47415 22 1.99699 17.5228 1.99699 12C1.99699 6.47715 6.47415 2 11.997 2C17.5198 2 21.997 6.47715 21.997 12ZM12.3553 9.38244C11.3827 9.787 9.43876 10.6243 6.52356 11.8944C6.05018 12.0827 5.8022 12.2669 5.77962 12.4469C5.74147 12.7513 6.12258 12.8711 6.64155 13.0343C6.71214 13.0565 6.78528 13.0795 6.86026 13.1038C7.37085 13.2698 8.05767 13.464 8.41472 13.4717C8.7386 13.4787 9.10009 13.3452 9.49918 13.0711C12.2229 11.2325 13.629 10.3032 13.7172 10.2831C13.7795 10.269 13.8658 10.2512 13.9243 10.3032C13.9828 10.3552 13.977 10.4536 13.9708 10.48C13.9331 10.641 12.4371 12.0318 11.6629 12.7515C11.4216 12.9759 11.2504 13.135 11.2154 13.1714C11.137 13.2528 11.0571 13.3298 10.9803 13.4038C10.506 13.8611 10.1502 14.204 11 14.764C11.4083 15.0331 11.7351 15.2556 12.0611 15.4776C12.4171 15.7201 12.7722 15.9619 13.2317 16.2631C13.3487 16.3398 13.4605 16.4195 13.5694 16.4971C13.9837 16.7925 14.3559 17.0579 14.8158 17.0155C15.083 16.991 15.359 16.7397 15.4992 15.9903C15.8305 14.2193 16.4817 10.382 16.6322 8.80081C16.6454 8.66228 16.6288 8.48498 16.6154 8.40715C16.6021 8.32932 16.5743 8.21842 16.4731 8.13633C16.3533 8.03911 16.1683 8.01861 16.0856 8.02C15.7095 8.0267 15.1324 8.22735 12.3553 9.38244Z"
        stroke="currentColor" strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── TelegramSection ──────────────────────────────────────

function TelegramSection() {
  const t = useTranslations('dashboard')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/telegram/link-token')
      const d = await r.json()
      setConnected(!!d.connected)
      return !!d.connected
    } catch { return false }
  }, [])

  const startLinkFlow = useCallback(async () => {
    setLinking(true)
    try {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' })
      const data = await res.json()
      if (data.deepLink) {
        window.open(data.deepLink, '_blank')
        pollRef.current = setInterval(async () => {
          const ok = await checkStatus()
          if (ok) { clearInterval(pollRef.current!); toast.success(t('tgLinked')) }
        }, 3000)
        setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current) }, 120_000)
      }
    } catch { toast.error(t('tgLinkError')) }
    finally { setLinking(false) }
  }, [checkStatus, t])

  useEffect(() => {
    checkStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [checkStatus])

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      await fetch('/api/telegram/link-token', { method: 'DELETE' })
      setConnected(false)
      toast.success(t('tgUnlinked'))
    } catch { toast.error(t('tgUnlinkError')) }
    finally { setUnlinking(false) }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{t('tgSection')}</div>
      <div className={styles.tgRow}>
        <div className={styles.tgLeft}>
          <span className={styles.tgIconWrap}><TelegramIcon size={15} /></span>
          <div className={styles.tgInfo}>
            <span className={styles.tgTitle}>Telegram</span>
            <span className={styles.tgStatus}>
              {connected === null ? t('tgChecking') : connected ? t('tgConnected') : t('tgNotConnected')}
            </span>
          </div>
        </div>
        {connected === false && (
          <button className={styles.tgLinkBtn} onClick={startLinkFlow} disabled={linking}>
            {linking ? t('tgLinking') : t('tgLink')}
          </button>
        )}
        {connected === true && (
          <button className={styles.tgUnlinkBtn} onClick={handleUnlink} disabled={unlinking}>
            {t('tgUnlink')}
          </button>
        )}
      </div>
    </div>
  )
}

function PromoCodeSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setApplying(true)
    try {
      const res = await fetch('/api/activate-promocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgMap: Record<string, string> = {
          INVALID_PROMO: t('promoInvalid'),
          PROMO_EXPIRED: t('promoExpired'),
          PROMO_EXHAUSTED: t('promoExhausted'),
          ALREADY_USED: t('promoAlreadyUsed'),
        }
        toast.error(msgMap[data.error] ?? t('promoNetworkError'))
      } else {
        const until = new Date(data.vipUntil).toLocaleDateString()
        toast.success(t('promoSuccess', { date: until }))
        setCode('')
      }
    } catch {
      toast.error(t('promoNetworkError'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('promoSection')}</div>
        <div className={styles.field}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className={styles.input}
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder={t('promoInputPlaceholder')}
              maxLength={32}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
            />
            <button
              className={styles.saveBtn}
              onClick={handleApply}
              disabled={applying || !code.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {applying ? t('promoApplying') : t('promoApplyBtn')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

interface UpcomingMeeting {
  id: string
  title: string
  scheduledAt: string
  roomName: string
  teacher: { id: string; name: string; avatarUrl: string | null }
}

function UpcomingMeetingsSection({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/student/upcoming-meetings')
      .then(r => r.json())
      .then(d => { if (!d.error) setMeetings(d.conferences) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (meetings.length === 0) return null

  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section}>
        <div className={styles.sectionLabel}>{t('upcomingMeetings')}</div>
        <div className={styles.meetingsList}>
          {meetings.map(m => {
            const date = new Date(m.scheduledAt)
            const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
            const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={m.id} className={styles.meetingCard}>
                <div className={styles.meetingDateTime}>
                  <span className={styles.meetingDate}>{dateStr}</span>
                  <span className={styles.meetingTime}>{timeStr}</span>
                </div>
                <div className={styles.meetingInfo}>
                  <span className={styles.meetingTitle}>{m.title}</span>
                  <span className={styles.meetingTeacher}>{m.teacher.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

interface Props {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  memberSince: string
  errorCount: number
  correctedCount: number
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
  onStats: () => void
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function StudentProfilePanel({
  name, email, phone, avatarUrl, memberSince, errorCount,
  correctedCount,
  saving, saveError, saveSuccess,
  avatarInputRef,
  onNameChange, onPhoneChange,
  onAvatarUploadClick, onAvatarRemove,
  onSave,
  onChangeEmail, onChangePassword,
  onTranscripts, onBookmarks, onStats,
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
          <div className={styles.heroRole}>{t('student')}</div>
        </div>

        <div className={styles.divider} />

        {/* Quick stats */}
        <div className={styles.miniStats}>
          <div className={styles.miniStat}>
            <div className={styles.miniStatValue} style={{ color: '#EF4444' }}>{errorCount}</div>
            <div className={styles.miniStatLabel}>{t('errorsLabel')}</div>
          </div>
          <div className={styles.miniStatDivider} />
          <div className={styles.miniStat}>
            <div className={styles.miniStatValue} style={{ color: '#22c55e' }}>{correctedCount}</div>
            <div className={styles.miniStatLabel}>{t('correctedLabel')}</div>
          </div>
          <div className={styles.miniStatDivider} />
          <div className={styles.miniStat}>
            <div className={styles.miniStatValue}>{formatMemberSince(memberSince)}</div>
            <div className={styles.miniStatLabel}>{t('memberSinceStudent')}</div>
          </div>
        </div>

        <UpcomingMeetingsSection t={t} />

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
              {saving ? t('savingShort') : t('saveShort')}
            </button>
          </div>
          {saveError && <span className={styles.errorMsg}>{saveError}</span>}
          {saveSuccess && <span className={styles.successMsg}>{t('changesSaved')}</span>}
          {avatarUrl && (
            <button
              type="button"
              style={{ fontSize: '12px', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '0' }}
              onClick={onAvatarRemove}
            >
              {t('removePhoto')}
            </button>
          )}
        </div>

        <div className={styles.divider} />

        {/* Quick links */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('historyTools')}</div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={onStats}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              {t('myStats')}
            </button>

            <button className={styles.actionBtn} onClick={onTranscripts}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
              {t('callNotes')}
            </button>

            <button className={styles.actionBtn} onClick={onBookmarks}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </span>
              {t('bookmarks')}
            </button>

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

            <Link href="/feedback" className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              {t('feedbackLink')}
            </Link>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Video room */}
        <div className={styles.section}>
          <button className={styles.videoToggle} onClick={() => setVideoOpen(true)}>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
                <rect x="1" y="6" width="14" height="12" rx="2" />
              </svg>
              {t('videoRoom')}
            </span>
          </button>
        </div>
        {videoOpen && <VideoCallModal defaultName={name} onClose={() => setVideoOpen(false)} />}

        <PromoCodeSection t={t} />

        <div className={styles.divider} />

        {/* Telegram */}
        <TelegramSection />

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

      </div>
    </aside>
  )
}
