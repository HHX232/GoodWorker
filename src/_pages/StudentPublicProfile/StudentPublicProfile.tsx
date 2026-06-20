'use client'

import { useOnlineStatus } from '@/features/hooks/User/useOnlineStatus'
import { formatActivity } from '@/shared/helpers/formatActivity'
import { NavBar } from '@/widgets/BaseUI'
import { ProfileSubNav } from '@/shared/ui/ProfileSubNav/ProfileSubNav'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './StudentPublicProfile.module.scss'

interface Stats {
  postsRead: number
  roadmapsStarted: number
  commentsLeft: number
}

interface Props {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
  lastSeenAt: string | null
  stats: Stats
  isMyStudent: boolean
  linkedAt: string | null
  viewerRole: 'STUDENT' | 'TEACHER' | 'ADMIN' | null
}

// ── Report modal ──────────────────────────────────────────────────────────────

function ReportModal({ studentId, studentName, onClose }: { studentId: string; studentName: string; onClose: () => void }) {
  const t = useTranslations('StudentProfile')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) { setError(t('reportTextRequired')); return }
    setSending(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userId: studentId, targetId: studentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_reported') { setError(t('reportAlreadySent')); return }
        setError(t('reportError'))
        return
      }
      toast.success(t('reportSent'))
      onClose()
    } catch {
      setError(t('reportError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTitle}>{t('reportTitle', { name: studentName })}</p>
        <textarea
          className={styles.textarea}
          placeholder={t('reportPlaceholder')}
          value={text}
          onChange={e => { setText(e.target.value); setError('') }}
          rows={4}
        />
        {error && <span className={styles.errorText}>{error}</span>}
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={sending || !text.trim()}>
            {sending ? t('sending') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, bg }: { value: number; label: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: bg }}>{icon}</div>
      <span className={styles.statValue}>{value.toLocaleString()}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function StudentPublicProfile({ id, name, avatarUrl, createdAt, stats, isMyStudent, linkedAt, viewerRole }: Props) {
  const t = useTranslations('StudentProfile')
  const { online } = useOnlineStatus(id)
  const [reportOpen, setReportOpen] = useState(false)

  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const joined = new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  const linkedSince = linkedAt
    ? new Date(linkedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
    : null

  return (
    <>
      <NavBar />
      <ProfileSubNav />
      <div className={styles.page}>

        {/* ── Hero card ── */}
        <div className={styles.card}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={name} width={88} height={88} className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
            </div>
            {online && <span className={styles.onlineDot} />}
          </div>

          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>{t('joinedAt', { date: joined })}</p>

          {/* Badge only visible to teachers */}
          {viewerRole === 'TEACHER' && (
            isMyStudent ? (
              <span className={styles.myStudentBadge}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {linkedSince ? t('myStudentSince', { date: linkedSince }) : t('myStudent')}
              </span>
            ) : (
              <span className={styles.notMyStudentBadge}>
                {t('notMyStudent')}
              </span>
            )
          )}
        </div>

        {/* ── Stats ── */}
        <div className={styles.statsGrid}>
          <StatCard
            value={stats.postsRead}
            label={t('statPostsRead')}
            bg="#EEF2FF"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            }
          />
          <StatCard
            value={stats.roadmapsStarted}
            label={t('statRoadmaps')}
            bg="#F0FDF4"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
          <StatCard
            value={stats.commentsLeft}
            label={t('statComments')}
            bg="#FFF7ED"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
        </div>

        {/* ── Actions ── */}
        <div className={styles.actions}>
          <button className={styles.reportBtn} onClick={() => setReportOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            {t('reportUser')}
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportModal studentId={id} studentName={name} onClose={() => setReportOpen(false)} />
      )}
    </>
  )
}
