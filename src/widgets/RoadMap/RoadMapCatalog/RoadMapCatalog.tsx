'use client'

import { IRoadmapItem } from '@/features/services/RoadmapService.service'
import { RoadMapPreview } from '@/shared/ui/RoadMap/RoadMapPreview/RoadMapPreview'
import { Skeleton } from '@mui/material'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import styles from './RoadMapCatalog.module.scss'

interface RoadMapCatalogProps {
  initialItems: IRoadmapItem[]
  onLoadMore?: (page: number) => Promise<IRoadmapItem[]>
  hasMore?: boolean
  loading?: boolean
}

function RoadMapSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeleton_header}>
        <Skeleton variant="circular" width={42} height={42} />
        <div className={styles.skeleton_texts}>
          <Skeleton variant="rounded" width={120} height={14} />
          <Skeleton variant="rounded" width={80} height={12} />
        </div>
      </div>
      <Skeleton variant="rounded" width="65%" height={18} />
      <Skeleton variant="rounded" width="100%" height={180} />
      <Skeleton variant="rounded" width={140} height={36} />
    </div>
  )
}

export const RoadMapCatalog: FC<RoadMapCatalogProps> = ({
  initialItems,
  onLoadMore,
  hasMore = false,
  loading = false,
}) => {
  const [items, setItems] = useState<IRoadmapItem[]>(initialItems)
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState(false)
  const [canLoadMore, setCanLoadMore] = useState(hasMore)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (paging || !canLoadMore || !onLoadMore) return
    setPaging(true)
    try {
      const nextPage = page + 1
      const next = await onLoadMore(nextPage)
      if (next.length === 0) {
        setCanLoadMore(false)
      } else {
        setItems((prev) => [...prev, ...next])
        setPage(nextPage)
      }
    } catch (err) {
      console.error('Failed to load more roadmaps', err)
    } finally {
      setPaging(false)
    }
  }, [paging, canLoadMore, onLoadMore, page])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '500px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => { setItems(initialItems); setPage(1) }, [initialItems])
  useEffect(() => { setCanLoadMore(hasMore) }, [hasMore])

  if (loading) {
    return (
      <div className={styles.catalog}>
        <div className={styles.grid}>
          <RoadMapSkeleton />
          <RoadMapSkeleton />
          <RoadMapSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.catalog}>
      <div className={styles.grid}>
        {items.map((item) => (
          <RoadMapPreview key={item.id} {...item} />
        ))}
        {paging && (
          <>
            <RoadMapSkeleton />
            <RoadMapSkeleton />
          </>
        )}
      </div>

      {!loading && !paging && items.length === 0 && (
        <p className={styles.empty}>Роадмапы не найдены</p>
      )}

      {canLoadMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}

      {!canLoadMore && items.length > 0 && (
        <p className={styles.end_message}>Больше роадмапов нет</p>
      )}
    </div>
  )
}
