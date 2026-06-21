'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import styles from './StudentErrorsList.module.scss'

type Sort = 'time' | 'freq'

interface ErrorCategory {
  id: string
  name: string
}

interface ErrorItem {
  id: string
  createdAt: string
  description: string | null
  fragment: string | null
  categories: ErrorCategory[]
}

interface FreqItem {
  id: string
  name: string
  count: number
  lastSeen: string
}

interface RecommendedPost {
  id: string
  title: string
  teacher: { name: string; avatarUrl: string | null }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function IconAlertCircle() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function PostRecs({ categoryId, locale }: { categoryId: string; locale: string }) {
  const t = useTranslations('dashboard')
  const [posts, setPosts] = useState<RecommendedPost[] | null>(null)

  useEffect(() => {
    setPosts(null)
    fetch(`/api/posts?categoryId=${categoryId}&limit=2&lang=${locale}`)
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => setPosts([]))
  }, [categoryId, locale])

  if (posts === null) return <div className={styles.recLoading}>…</div>
  if (posts.length === 0) return null

  return (
    <div className={styles.recWrap}>
      <div className={styles.recLabel}>{t('recommendedPosts')}</div>
      {posts.map(p => (
        <Link key={p.id} href={`/post/${p.id}`} className={styles.recPost}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={styles.recIcon}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className={styles.recTitle}>{p.title}</span>
        </Link>
      ))}
    </div>
  )
}

export function StudentErrorsList() {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [sort, setSort] = useState<Sort>('time')
  const [timeErrors, setTimeErrors] = useState<ErrorItem[]>([])
  const [freqErrors, setFreqErrors] = useState<FreqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/student/errors?sort=${sort}`)
      .then(r => r.json())
      .then(data => {
        if (sort === 'time') setTimeErrors(data.errors ?? [])
        else setFreqErrors(data.categories ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sort])

  const maxCount = freqErrors.length > 0 ? freqErrors[0].count : 1

  const toggle = (key: string) => setOpenKey(prev => prev === key ? null : key)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('myErrors')}</h3>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${sort === 'time' ? styles.toggleActive : ''}`}
            onClick={() => setSort('time')}
          >
            {t('sortByTime')}
          </button>
          <button
            className={`${styles.toggleBtn} ${sort === 'freq' ? styles.toggleActive : ''}`}
            onClick={() => setSort('freq')}
          >
            {t('sortByFreq')}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.empty}>
            <span>{t('loading')}</span>
          </div>
        ) : sort === 'time' ? (
          timeErrors.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><IconAlertCircle /></div>
              <span>{t('errorsEmpty')}</span>
            </div>
          ) : (
            timeErrors.map(e => {
              const catId = e.categories[0]?.id
              const isOpen = openKey === e.id
              return (
                <div key={e.id} className={`${styles.errorItem} ${catId ? styles.errorItemClickable : ''} ${isOpen ? styles.errorItemOpen : ''}`}
                  onClick={catId ? () => toggle(e.id) : undefined}
                >
                  <div className={styles.errorMeta}>
                    <span className={styles.errorDate}>{fmtDate(e.createdAt)}</span>
                    {e.categories.map(c => (
                      <span key={c.id} className={styles.catChip}>{c.name}</span>
                    ))}
                    {catId && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    )}
                  </div>
                  {e.description && (
                    <div className={styles.errorDesc}>{e.description}</div>
                  )}
                  {e.fragment && (
                    <div className={styles.errorFragment}>«{e.fragment}»</div>
                  )}
                  {isOpen && catId && <PostRecs categoryId={catId} locale={locale} />}
                </div>
              )
            })
          )
        ) : (
          freqErrors.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><IconAlertCircle /></div>
              <span>{t('errorsEmpty')}</span>
            </div>
          ) : (
            freqErrors.map((item, i) => {
              const isOpen = openKey === item.id
              return (
                <div key={item.id} className={`${styles.freqItem} ${styles.freqItemClickable} ${isOpen ? styles.freqItemOpen : ''}`}
                  onClick={() => toggle(item.id)}
                >
                  <div className={styles.freqLeft}>
                    <span className={styles.freqRank}>#{i + 1}</span>
                    <div className={styles.freqBar}>
                      <div className={styles.freqName}>{item.name}</div>
                      <div className={styles.freqTrack}>
                        <div
                          className={styles.freqFill}
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                      {isOpen && <PostRecs categoryId={item.id} locale={locale} />}
                    </div>
                  </div>
                  <div className={styles.freqRight}>
                    <span className={styles.freqLast}>{fmtDate(item.lastSeen)}</span>
                    <span className={styles.freqCount}>{item.count}×</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
              )
            })
          )
        )}
      </div>
    </div>
  )
}
