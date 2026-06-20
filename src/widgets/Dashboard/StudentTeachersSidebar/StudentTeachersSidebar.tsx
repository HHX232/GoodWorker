'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import styles from './StudentTeachersSidebar.module.scss'

interface Teacher {
  id: string
  name: string
  avatarUrl: string | null
  initials: string
  avatarColor: string
  avatarTextColor: string
  subject: string
  linkedAt: string
}

interface Props {
  teachers: Teacher[]
  loading: boolean
}

export function StudentTeachersSidebar({ teachers, loading }: Props) {
  const t = useTranslations('dashboard')
  const [search, setSearch] = useState('')
  const [activeSubject, setActiveSubject] = useState<string | null>(null)

  const subjects = useMemo(() => {
    const set = new Set(teachers.map(t => t.subject).filter(Boolean))
    return Array.from(set)
  }, [teachers])

  const filtered = useMemo(() => {
    return teachers.filter(teacher => {
      const matchSearch = teacher.name.toLowerCase().includes(search.toLowerCase())
      const matchSubject = !activeSubject || teacher.subject === activeSubject
      return matchSearch && matchSubject
    })
  }, [teachers, search, activeSubject])

  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.title}>{t('teachers')}</span>
          <span className={styles.badge}>{teachers.length}</span>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            className={styles.search}
            placeholder={t('searchTeacherPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {subjects.length > 0 && (
          <div className={styles.filters}>
            <button
              className={`${styles.filterBtn} ${!activeSubject ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveSubject(null)}
            >
              {t('allSubjects')}
            </button>
            {subjects.map(s => (
              <button
                key={s}
                className={`${styles.filterBtn} ${activeSubject === s ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveSubject(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.empty}>{t('loading')}</div>}

        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            {search ? t('noResults') : t('noTeachers')}
          </div>
        )}

        {!loading && filtered.map(teacher => (
          <Link key={teacher.id} href={`/users/${teacher.id}`} className={styles.card} style={{ textDecoration: 'none', display: 'block' }}>
            <div className={styles.cardTop}>
              <div
                className={styles.avatar}
                style={teacher.avatarUrl ? undefined : { background: teacher.avatarColor, color: teacher.avatarTextColor }}
              >
                {teacher.avatarUrl ? (
                  <Image src={teacher.avatarUrl} alt={teacher.name} width={36} height={36} className={styles.avatarImg} />
                ) : (
                  teacher.initials
                )}
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardName}>{teacher.name}</div>
                {teacher.subject && (
                  <div className={styles.cardSubject}>{teacher.subject}</div>
                )}
              </div>
            </div>
            {teacher.subject && (
              <div className={styles.subjectChip}>{teacher.subject}</div>
            )}
          </Link>
        ))}
      </div>
    </aside>
  )
}
