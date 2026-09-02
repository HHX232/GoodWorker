'use client'

import {useOnlineStatus} from '@/features/hooks/User/useOnlineStatus'
import {formatActivity} from '@/shared/helpers/formatActivity'
import {ITeacherListItem} from '@/features/services/TeacherService.service'
import {TEACHER_LANGUAGES} from '@/shared/ui/inputs/LanguageSelect/LanguageSelect'
import {getAvatarColor} from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import {getDisplayName} from '@/shared/utils/transliterate'
import {formatPrice} from '@/shared/utils/currencyConverter'
import {useLocale, useTranslations} from 'next-intl'
import {useSession} from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {FC, useState} from 'react'
import {toast} from 'sonner'
import styles from './TeacherCard.module.scss'

interface Props {
  teacher: ITeacherListItem
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function ReportModal({teacherId, teacherName, onClose}: {teacherId: string; teacherName: string; onClose: () => void}) {
  const t = useTranslations('TeacherCard')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError(t('reportTextRequired'))
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text, userId: teacherId, targetId: teacherId})
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'already_reported' ? t('reportAlreadySent') : t('reportError'))
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
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modal_title}>{t('reportTitle', {name: teacherName})}</p>
        <textarea
          className={styles.textarea}
          placeholder={t('reportPlaceholder')}
          value={text}
          onChange={(e) => { setText(e.target.value); setError('') }}
          rows={4}
        />
        {error && <span className={styles.error_text}>{error}</span>}
        <div className={styles.modal_actions}>
          <button type='button' className={styles.cancel_btn} onClick={onClose}>{t('cancel')}</button>
          <button type='button' className={styles.submit_btn} onClick={handleSubmit} disabled={sending || !text.trim()}>
            {sending ? t('sending') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

const TeacherCard: FC<Props> = ({teacher}) => {
  const t = useTranslations('TeacherCard')
  const locale = useLocale()
  const router = useRouter()
  const {data: session} = useSession()
  const [imgError, setImgError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const {online, lastSeenAt} = useOnlineStatus(teacher.id)
  const activity = formatActivity(online, lastSeenAt)
  // API only requires auth (any role) + blocks self-report — no student-only
  // restriction on the backend, so the menu shouldn't invent one either.
  const canReport = !!session?.user?.id

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + `/users/${teacher.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const showFallback = !teacher.avatarUrl || imgError
  const {bg, text} = getAvatarColor(teacher.name)
  const displayName = getDisplayName(teacher.name, locale, teacher.nameTransliterated)

  const categories = teacher.categories.slice(0, 3).map(({category}) => {
    const translation = category.translations.find((tr) => tr.langCode === locale)
      ?? category.translations.find((tr) => tr.langCode === 'ru')
      ?? category.translations[0]
    return translation?.name ?? category.slug
  })

  const langs = (teacher.languages ?? []).map((code) => {
    const def = TEACHER_LANGUAGES.find((l) => l.code === code)
    return def?.native ?? code.toUpperCase()
  })

  const goToProfile = () => router.push(`/users/${teacher.id}`)

  return (
    <article
      className={styles.card}
      role='link'
      tabIndex={0}
      onClick={goToProfile}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          goToProfile()
        }
      }}
    >
      <div
        className={styles.photo}
        style={showFallback ? {background: `linear-gradient(160deg, ${bg}, ${bg}99)`} : undefined}
      >
        {showFallback ? (
          <span className={styles.initials} style={{color: text}}>{getInitials(teacher.name)}</span>
        ) : (
          <Image
            src={teacher.avatarUrl!}
            alt={teacher.name}
            fill
            sizes='(max-width: 500px) 100vw, 300px'
            className={styles.photo_img}
            onError={() => setImgError(true)}
          />
        )}
        {online && <span className={styles.online_dot} title={activity} />}

        <details className={styles.menu} onClick={(e) => e.stopPropagation()}>
          <summary className={styles.menu_trigger} aria-label='Меню карточки'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='5' r='1.4' /><circle cx='12' cy='12' r='1.4' /><circle cx='12' cy='19' r='1.4' /></svg>
          </summary>
          <div className={styles.menu_panel}>
            <button type='button' className={styles.menu_item} onClick={handleShare}>
              {copied ? (
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'><polyline points='20 6 9 17 4 12' /></svg>
              ) : (
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' />
                  <polyline points='16 6 12 2 8 6' />
                  <line x1='12' y1='2' x2='12' y2='15' />
                </svg>
              )}
              {copied ? '✓' : t('share')}
            </button>
            {canReport && (
              <button type='button' className={styles.menu_item} onClick={() => setReportOpen(true)}>
                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M12 9v4' /><path d='M12 17h.01' /><path d='M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' />
                </svg>
                {t('report')}
              </button>
            )}
          </div>
        </details>
      </div>

      {reportOpen && (
        <ReportModal teacherId={teacher.id} teacherName={displayName} onClose={() => setReportOpen(false)} />
      )}

      <div className={styles.body}>
        <div className={styles.name_row}>
          <Link href={`/users/${teacher.id}`} className={styles.name}>
            {displayName}
          </Link>
          {teacher.isVip && <span className={styles.vip_badge}>★ VIP</span>}
        </div>

        {categories.length > 0 && (
          <div className={styles.categories}>
            {categories.map((cat) => (
              <span key={cat} className={styles.category_chip}>
                {cat}
              </span>
            ))}
          </div>
        )}

        {teacher.reviewsCount > 0 && teacher.avgRating !== null && (
          <div className={styles.rating} aria-label={`Рейтинг ${teacher.avgRating.toFixed(1)} из 5`}>
            <span className={styles.stars} aria-hidden='true'>
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  className={i <= Math.round(teacher.avgRating!) ? styles.star_filled : styles.star_empty}
                  viewBox='0 0 24 24'
                  strokeWidth='1.5'
                  strokeLinejoin='round'
                >
                  <path d='M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z' />
                </svg>
              ))}
            </span>
            <span className={styles.rating_value}>{teacher.avgRating.toFixed(1)}</span>
            <span className={styles.reviews_count}>· {teacher.reviewsCount} {t('reviews')}</span>
          </div>
        )}

        {teacher.minPrice !== null && (
          <p className={styles.price}>
            {t('priceFrom', {price: formatPrice(teacher.minPrice, teacher.minPriceCurrency ?? 'BYN')})}
          </p>
        )}

        {langs.length > 0 && (
          <div className={styles.languages}>
            <span className={styles.languages_head}>
              <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='9' /><path d='M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18' /></svg>
              <span className={styles.languages_label}>{t('languagesLabel')}</span>
            </span>
            <span className={styles.languages_text}>{langs.join(', ')}</span>
          </div>
        )}

        {teacher.bio && <p className={styles.desc}>{teacher.bio}</p>}

        <div className={styles.stats}>
          <span className={styles.stat}>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'><rect x='4' y='4' width='16' height='16' /><path d='M8 9h8M8 13h5' /></svg>
            {teacher._count.posts} {t('posts')}
          </span>
          <span className={styles.stat}>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'><circle cx='9' cy='9' r='3' /><path d='M3.5 19c.6-3 2.7-5 5.5-5s4.9 2 5.5 5' /><circle cx='17' cy='10' r='2.4' /><path d='M15.6 13.5c1.9.4 3.4 2 3.9 4.5' /></svg>
            {teacher._count.students} {t('students')}
          </span>
        </div>

        <Link href={`/users/${teacher.id}`} className={styles.cta}>
          {t('viewProfile')}
          <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M5 12h13M13 6l6 6-6 6' />
          </svg>
        </Link>
      </div>
    </article>
  )
}

export default TeacherCard
