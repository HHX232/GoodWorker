'use client'

import { CategorySelect } from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import * as Slider from '@radix-ui/react-slider'
import { useTranslations } from 'next-intl'
import styles from './PostCatalogFilters.module.scss'

export type PostSortKey = 'newest' | 'popular' | 'rated'

export interface PostFiltersValue {
  categoryId: string
  sort: PostSortKey
  ratingMin: number
  ratingMax: number
}

interface Props {
  value: PostFiltersValue
  onChange: (v: PostFiltersValue) => void
}

const SORT_OPTIONS: PostSortKey[] = ['newest', 'popular', 'rated']

export function PostCatalogFilters({ value, onChange }: Props) {
  const t = useTranslations('PostCatalogFilters')

  const setCategory = (ids: string[]) => onChange({ ...value, categoryId: ids[0] ?? '' })
  const setSort = (sort: PostSortKey) => onChange({ ...value, sort })
  const setRating = ([min, max]: number[]) => onChange({ ...value, ratingMin: min, ratingMax: max })

  const showRatingLabel = value.ratingMin > 0 || value.ratingMax < 5

  return (
    <div className={styles.bar}>
      {/* Category */}
      <div className={styles.category_wrap}>
        <CategorySelect
          canSelectMany={false}
          value={value.categoryId ? [value.categoryId] : []}
          onChange={setCategory}
          placeholder={t('allCategories')}
        />
      </div>

      <div className={styles.sep} />

      {/* Rating range */}
      <div className={styles.rating_wrap}>
        <span className={styles.rating_label}>
          {showRatingLabel
            ? `${value.ratingMin.toFixed(1)} – ${value.ratingMax.toFixed(1)} ★`
            : t('anyRating')}
        </span>
        <Slider.Root
          className={styles.slider_root}
          min={0}
          max={5}
          step={0.5}
          value={[value.ratingMin, value.ratingMax]}
          onValueChange={setRating}
        >
          <Slider.Track className={styles.slider_track}>
            <Slider.Range className={styles.slider_range} />
          </Slider.Track>
          <Slider.Thumb className={styles.slider_thumb} aria-label={t('ratingMin')} />
          <Slider.Thumb className={styles.slider_thumb} aria-label={t('ratingMax')} />
        </Slider.Root>
      </div>

      <div className={styles.sep} />

      {/* Sort */}
      <div className={styles.sort_group}>
        {SORT_OPTIONS.map(s => (
          <button
            key={s}
            className={`${styles.sort_btn} ${value.sort === s ? styles.sort_active : ''}`}
            onClick={() => setSort(s)}
          >
            {t(s)}
          </button>
        ))}
      </div>
    </div>
  )
}
