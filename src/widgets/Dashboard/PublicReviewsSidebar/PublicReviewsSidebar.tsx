'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import styles from './PublicReviewsSidebar.module.scss'

interface Review {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  text: string
  stars: number
  createdAt: string
}

interface Props {
  teacherId: string
}

function StarRow({ value, onChange, readonly }: { value: number; onChange?: (n: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`${styles.star} ${n <= (hovered || value) ? styles.starFilled : ''}`}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          disabled={readonly}
          aria-label={`${n} star`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={n <= (hovered || value) ? '#F0B429' : 'none'} stroke={n <= (hovered || value) ? '#F0B429' : '#D1D5DB'} strokeWidth="1.8">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function InitialAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const isTeacher = role === 'TEACHER'
  return (
    <div
      className={styles.reviewAvatar}
      style={{ background: isTeacher ? '#EEF2FF' : '#E0F2FE', color: isTeacher ? '#534AB7' : '#0369A1' }}
    >
      {initials || '?'}
    </div>
  )
}

export function PublicReviewsSidebar({ teacherId }: Props) {
  const t = useTranslations('dashboard')
  const { data: session } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [text, setText] = useState('')
  const [stars, setStars] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/teacher/${teacherId}/reviews`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.reviews)) setReviews(d.reviews) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [teacherId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stars) { setError(t('reviewSelectStars')); return }
    if (!text.trim()) { setError(t('reviewEnterText')); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/teacher/${teacherId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, text }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t('reviewError')); return }
      setReviews(prev => {
        const filtered = prev.filter(r => r.authorId !== session?.user?.id)
        return [data.review, ...filtered]
      })
      setText('')
      setStars(0)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError(t('reviewError'))
    } finally {
      setSubmitting(false)
    }
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length
    : 0

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{t('reviewsTitle')}</span>
          {reviews.length > 0 && (
            <div className={styles.avgBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#F0B429" stroke="#F0B429" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{avgRating.toFixed(1)}</span>
              <span className={styles.avgCount}>({reviews.length})</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.scroll}>
        {/* Leave a review */}
        {session ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formLabel}>{t('reviewLeave')}</div>
            <StarRow value={stars} onChange={setStars} />
            <textarea
              className={styles.textarea}
              placeholder={t('reviewPlaceholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
            />
            {error && <span className={styles.formError}>{error}</span>}
            {success && <span className={styles.formSuccess}>{t('reviewSent')}</span>}
            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? t('saving') : t('reviewSubmit')}
            </button>
          </form>
        ) : (
          <div className={styles.loginHint}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.8" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            {t('reviewLoginToLeave')}
          </div>
        )}

        <div className={styles.divider} />

        {/* Reviews list */}
        {loading && <div className={styles.empty}>{t('loading')}</div>}
        {!loading && reviews.length === 0 && (
          <div className={styles.empty}>{t('reviewsEmpty')}</div>
        )}
        {!loading && reviews.map(r => (
          <div key={r.id} className={styles.reviewCard}>
            <div className={styles.reviewTop}>
              <InitialAvatar name={r.authorName} role={r.authorRole} />
              <div className={styles.reviewMeta}>
                <span className={styles.reviewName}>{r.authorName}</span>
                <span className={styles.reviewDate}>
                  {new Date(r.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <StarRow value={r.stars} readonly />
            </div>
            <p className={styles.reviewText}>{r.text}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}
