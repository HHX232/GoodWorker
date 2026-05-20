'use client'

import TeacherService, {ITeacherListItem, ITeachersQuery, ITeachersResponse} from '@/features/services/TeacherService.service'
import {CategorySelect} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import TeacherCard from '@/shared/ui/Teacher/TeacherCard/TeacherCard'
import {NavBar} from '@/widgets/BaseUI'
import {NotificationsPanel} from '@/widgets/NotificationsPanel/NotificationsPanel'
import {useTranslations} from 'next-intl'
import {useCallback, useEffect, useRef, useState} from 'react'
import {useSearchParams} from 'next/navigation'
import {toast} from 'sonner'
import styles from './TeachersPage.module.scss'

const TOAST_ID = 'catalog-teachers-error'

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (retries <= 0) throw err
    await new Promise((r) => setTimeout(r, delay))
    return withRetry(fn, retries - 1, delay * 2)
  }
}

interface Props {
  initialData: ITeachersResponse
}

function TeachersPage({initialData}: Props) {
  const t = useTranslations('TeachersPage')
  const searchParams = useSearchParams()
  const [teachers, setTeachers] = useState<ITeacherListItem[]>(initialData.teachers)
  const [page, setPage] = useState(1)
  const [canLoadMore, setCanLoadMore] = useState(
    initialData.pagination.page < initialData.pagination.totalPages
  )
  const [isLoading, setIsLoading] = useState(false)

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const sentinelRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQuery = useRef<ITeachersQuery>({})

  const fetchTeachers = useCallback(async (query: ITeachersQuery, append = false) => {
    setIsLoading(true)
    try {
      const res = await withRetry(() => TeacherService.getList(query))
      if (append) {
        setTeachers((prev) => [...prev, ...res.teachers])
      } else {
        setTeachers(res.teachers)
      }
      setPage(res.pagination.page)
      setCanLoadMore(res.pagination.page < res.pagination.totalPages)
      toast.dismiss(TOAST_ID)
    } catch {
      toast.error('Не удалось загрузить учителей. Повторная попытка...', {id: TOAST_ID, duration: 6000})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const query: ITeachersQuery = {
        page: 1,
        search: search || undefined,
        categoryId: categoryIds[0] ?? undefined
      }
      currentQuery.current = query
      fetchTeachers(query, false)
    }, 350)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search, categoryIds, fetchTeachers])

  const loadMore = useCallback(async () => {
    if (isLoading || !canLoadMore) return
    const query: ITeachersQuery = {
      ...currentQuery.current,
      page: page + 1
    }
    await fetchTeachers(query, true)
  }, [isLoading, canLoadMore, page, fetchTeachers])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      {rootMargin: '400px', threshold: 0}
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />

      <div className={styles.main_content}>
        <div className={styles.title_box}>
          <h1>{t('title')}</h1>
          <div className={styles.decor_line} />
        </div>

        <div className={styles.filters}>
          <input
            className={styles.search_input}
            type='text'
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <CategorySelect
            placeholder={t('categoryPlaceholder')}
            canSelectMany={false}
            value={categoryIds}
            onChange={setCategoryIds}
          />
        </div>

        <div className={styles.grid}>
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
          {isLoading && (
            <>
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </>
          )}
        </div>

        {!isLoading && teachers.length === 0 && (
          <p className={styles.empty}>{t('empty')}</p>
        )}

        {canLoadMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden='true' />}
        {!canLoadMore && teachers.length > 0 && (
          <p className={styles.end_message}>{t('noMore')}</p>
        )}
      </div>

      <div className={styles.sidebar}>
        <NotificationsPanel />
      </div>

      <div className='mobile_padding' />
    </div>
  )
}

export default TeachersPage
