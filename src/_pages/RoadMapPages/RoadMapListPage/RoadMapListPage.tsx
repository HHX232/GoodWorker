'use client'

import RoadmapService, { IRoadmapItem, IRoadmapQuery, IRoadmapsResponse } from '@/features/services/RoadmapService.service'
import { NavBar } from '@/widgets/BaseUI'
import { RoadMapCatalog } from '@/widgets/RoadMap/RoadMapCatalog/RoadMapCatalog'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useRef, useTransition } from 'react'
import { useState } from 'react'
import styles from './RoadMapListPage.module.scss'

interface RoadMapListPageProps {
  initialData: IRoadmapsResponse
  initialQuery: IRoadmapQuery
}

export function RoadMapListPage({ initialData, initialQuery }: RoadMapListPageProps) {
  const t = useTranslations('roadmapList')
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Local UI state — initialized once from server-rendered query, updated on user input
  const [search, setSearch] = useState(initialQuery.search ?? '')
  const [minRating, setMinRating] = useState<number | undefined>(initialQuery.minRating)
  const [minPrice, setMinPrice] = useState(
    initialQuery.minPrice !== undefined ? String(initialQuery.minPrice) : ''
  )
  const [maxPrice, setMaxPrice] = useState(
    initialQuery.maxPrice !== undefined ? String(initialQuery.maxPrice) : ''
  )

  const textDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushFilters = useCallback(
    (s: string, r: number | undefined, mnp: string, mxp: string) => {
      const params = new URLSearchParams()
      if (s.trim()) params.set('search', s.trim())
      if (r !== undefined) params.set('minRating', String(r))
      if (mnp !== '') params.set('minPrice', mnp)
      if (mxp !== '') params.set('maxPrice', mxp)
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname]
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (textDebounce.current) clearTimeout(textDebounce.current)
    textDebounce.current = setTimeout(() => pushFilters(value, minRating, minPrice, maxPrice), 400)
  }

  const handleRatingClick = (star: number) => {
    const next = minRating === star ? undefined : star
    setMinRating(next)
    if (textDebounce.current) clearTimeout(textDebounce.current)
    pushFilters(search, next, minPrice, maxPrice)
  }

  const handleMinPriceChange = (value: string) => {
    setMinPrice(value)
    if (textDebounce.current) clearTimeout(textDebounce.current)
    textDebounce.current = setTimeout(() => pushFilters(search, minRating, value, maxPrice), 400)
  }

  const handleMaxPriceChange = (value: string) => {
    setMaxPrice(value)
    if (textDebounce.current) clearTimeout(textDebounce.current)
    textDebounce.current = setTimeout(() => pushFilters(search, minRating, minPrice, value), 400)
  }

  const isFreeOnly = minPrice === '0' && maxPrice === '0'

  const handleFreeToggle = () => {
    if (textDebounce.current) clearTimeout(textDebounce.current)
    if (isFreeOnly) {
      setMinPrice('')
      setMaxPrice('')
      pushFilters(search, minRating, '', '')
    } else {
      setMinPrice('0')
      setMaxPrice('0')
      pushFilters(search, minRating, '0', '0')
    }
  }

  // Uses initialQuery (server source of truth) so pages load with same filters as current URL
  const handleLoadMore = useCallback(
    async (page: number): Promise<IRoadmapItem[]> => {
      const data = await RoadmapService.getList({ ...initialQuery, page, limit: 12 })
      return data.roadmaps
    },
    [initialQuery]
  )

  // Key changes when server returns new initialQuery → catalog resets to page 1
  const catalogKey = [
    initialQuery.search ?? '',
    initialQuery.minRating ?? '',
    initialQuery.minPrice ?? '',
    initialQuery.maxPrice ?? '',
  ].join('|')

  const hasMore = initialData.pagination.page < initialData.pagination.totalPages

  return (
    <div className={`container default_content ${styles.content}`}>
      <NavBar />
      <div className={styles.main}>
        <div className={styles.header_card}>
          <div className={styles.title_box}>
            <h1>{t('title')}</h1>
            <div className={styles.decor_line} />
          </div>

          <div className={styles.filters}>
            {/* Search */}
            <div className={styles.search_wrap}>
              <svg className={styles.search_icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#868897" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className={styles.search_input}
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {search && (
                <button className={styles.clear_btn} onClick={() => handleSearchChange('')} aria-label={t('clearSearch')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Price range */}
            <div className={styles.price_wrap}>
              <input
                className={styles.price_input}
                type="number"
                placeholder={t('priceFrom')}
                min={0}
                value={minPrice}
                onChange={(e) => handleMinPriceChange(e.target.value)}
              />
              <span className={styles.price_sep}>—</span>
              <input
                className={styles.price_input}
                type="number"
                placeholder={t('priceTo')}
                min={0}
                value={maxPrice}
                onChange={(e) => handleMaxPriceChange(e.target.value)}
              />
            </div>

            {/* Free only toggle */}
            <button
              className={`${styles.free_btn} ${isFreeOnly ? styles.free_btn_active : ''}`}
              onClick={handleFreeToggle}
            >
              {t('free')}
            </button>

            {/* Rating */}
            <div className={styles.rating_wrap}>
              <span className={styles.rating_label}>{t('rating')}</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`${styles.star_btn} ${minRating === star ? styles.star_btn_active : ''}`}
                  onClick={() => handleRatingClick(star)}
                >
                  {star}★
                </button>
              ))}
              {minRating !== undefined && (
                <button
                  className={styles.reset_btn}
                  onClick={() => handleRatingClick(minRating)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <RoadMapCatalog
          key={catalogKey}
          initialItems={initialData.roadmaps}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          loading={isPending}
        />
      </div>
      <div className="mobile_padding" />
    </div>
  )
}
