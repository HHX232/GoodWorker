'use client'
import RoadmapService, { IRoadmapComment } from '@/features/services/RoadmapService.service'
import { ModalImageZoom } from '@/shared/ui/Modals/ModalImageZoom/ModalImageZoom'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { StarRating } from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './RoadmapCommentsModal.module.scss'

type CommentWithStars = IRoadmapComment & { userStars?: number | null }

function CommentItem({ comment }: { comment: CommentWithStars }) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  const initials = (comment.author?.name ?? '?').slice(0, 2).toUpperCase()
  const date = new Date(comment.createdAt).toLocaleDateString('ru-RU')

  return (
    <div className={styles.item}>
      <div className={styles.author_row}>
        <div className={styles.avatar}>
          {comment.author?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.author.avatarUrl} alt={comment.author.name} className={styles.avatar_img} />
          ) : (
            <span className={styles.avatar_initials}>{initials}</span>
          )}
        </div>
        <div className={styles.author_info}>
          <span className={styles.author_name}>{comment.author?.name ?? '—'}</span>
          <span className={styles.date}>{date}</span>
        </div>
        {comment.userStars != null && (
          <StarRating value={comment.userStars} readonly size={13} />
        )}
      </div>

      {comment.text && <p className={styles.text}>{comment.text}</p>}

      {comment.imageUrls.length > 0 && (
        <div className={styles.images}>
          {comment.imageUrls.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className={styles.thumb}
              onClick={() => setZoomSrc(src)}
            />
          ))}
        </div>
      )}

      <ModalImageZoom isOpen={zoomSrc !== null} src={zoomSrc} onClose={() => setZoomSrc(null)} />
    </div>
  )
}

interface Props {
  roadmapId: string
  isOpen: boolean
  onClose: () => void
  onLeaveReview: () => void
}

export function RoadmapCommentsModal({ roadmapId, isOpen, onClose, onLeaveReview }: Props) {
  const t = useTranslations('roadMap')
  const locale = useLocale()
  const [comments, setComments] = useState<CommentWithStars[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await RoadmapService.getComments(roadmapId, pageNum, 10, locale)
        setComments((prev) => (reset ? res.comments : [...prev, ...res.comments]))
        pageRef.current = pageNum
        const more = pageNum < res.pagination.totalPages
        hasMoreRef.current = more
        setHasMore(more)
      } catch {
        // silent
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [roadmapId]
  )

  useEffect(() => {
    if (!isOpen) {
      setComments([])
      setHasMore(false)
      pageRef.current = 1
      hasMoreRef.current = false
      return
    }
    fetchPage(1, true)
  }, [isOpen, roadmapId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !isOpen) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          fetchPage(pageRef.current + 1, false)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isOpen, fetchPage])

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<span style={{ fontWeight: 700, fontSize: 16 }}>{t('commentsTitle')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.leave_btn} onClick={onLeaveReview}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t('leaveComment')}
          </button>
        </div>
      }
    >
      <div className={styles.list}>
        {!loading && comments.length === 0 && (
          <p className={styles.empty}>{t('noComments')}</p>
        )}

        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}

        {loading && (
          <div className={styles.loader}>
            <span className={styles.spinner} />
          </div>
        )}

        {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </ModalWindowDefault>
  )
}
