'use client'
import { useRoadmapRating } from '@/features/hooks/Roadmap/useRoadmapRating'
import { StarRating } from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import { RoadmapCommentsModal } from '@/shared/ui/RoadMap/RoadmapCommentsModal/RoadmapCommentsModal'
import { RoadmapReviewModal } from '@/shared/ui/RoadMap/RoadmapReviewModal/RoadmapReviewModal'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import styles from './RoadmapReviewBar.module.scss'

interface Props {
  roadmapId: string
  initialAvgRating?: number
}

export function RoadmapReviewBar({ roadmapId, initialAvgRating }: Props) {
  const t = useTranslations('roadMap')
  const { data } = useRoadmapRating(roadmapId, initialAvgRating)

  const avg = data?.avgRating ?? initialAvgRating ?? 0
  const total = data?.totalRatings ?? 0
  const userRating = data?.userRating ?? null

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pendingStars, setPendingStars] = useState<number | null>(null)
  const returnToComments = useRef(false)

  const handleStarClick = (stars: number) => {
    setPendingStars(stars)
    setReviewOpen(true)
  }

  const handleLeaveReview = () => {
    returnToComments.current = true
    setCommentsOpen(false)
    setReviewOpen(true)
  }

  const handleReviewClose = () => {
    setReviewOpen(false)
    setPendingStars(null)
    if (returnToComments.current) {
      returnToComments.current = false
      setCommentsOpen(true)
    }
  }

  return (
    <>
      <div className={styles.bar}>
        <StarRating value={pendingStars ?? userRating} onChange={handleStarClick} size={16} />
        {avg > 0 && (
          <span className={styles.avg_label}>{avg.toFixed(1)}</span>
        )}
        {total > 0 && (
          <span className={styles.total_label}>{t('reviewsCount', { count: total })}</span>
        )}
        <button className={styles.review_btn} onClick={() => setReviewOpen(true)}>
          {t('reviewBtn')}
        </button>

        <div className={styles.divider} />

        <button className={styles.comments_btn} onClick={() => setCommentsOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t('commentsBtn')}
        </button>
      </div>

      <RoadmapCommentsModal
        roadmapId={roadmapId}
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onLeaveReview={handleLeaveReview}
      />

      <RoadmapReviewModal
        roadmapId={roadmapId}
        isOpen={reviewOpen}
        onClose={handleReviewClose}
        initialStars={pendingStars}
      />
    </>
  )
}
