'use client'

import { usePostRating } from '@/features/hooks/Comments/usePostRating'
import CommentService from '@/features/services/CommentService.service'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { StarRating, CommentItem, commentToUI } from '../PostCommentSection/PostCommentSection'
import { PostCommentModal } from '../PostCommentSection/Postcommentmodal/Postcommentmodal'
import styles from './PostCommentCompact.module.scss'

interface PostCommentCompactProps {
  postId: string
  initialComments: CommentItem[]
  totalComments: number
  currentUserId?: string
}

export function PostCommentCompact({
  postId,
  initialComments,
  totalComments: initialTotal,
  currentUserId,
}: PostCommentCompactProps) {
  const t = useTranslations('PostCommentSection')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: ratingData } = usePostRating(postId)
  const avgRating = ratingData?.averageStars ?? null

  const { data: commentsData } = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({ pageParam }) => CommentService.getList(postId, { page: pageParam as number, limit: 15 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    staleTime: 30_000,
  })

  const liveComments = commentsData
    ? commentsData.pages.flatMap((p) => p.comments.map(commentToUI))
    : initialComments
  const liveTotal = commentsData?.pages[0]?.pagination.total ?? initialTotal

  // Собираем превью картинок из комментариев
  const previewImages: string[] = []
  for (const c of liveComments) {
    for (const img of c.images) {
      if (previewImages.length >= 4) break
      previewImages.push(img)
    }
    if (previewImages.length >= 4) break
  }

  return (
    <>
      <div className={styles.box}>
        {/* Заголовок + рейтинг */}
        <div className={styles.top}>
          <span className={styles.title}>{t('compactTitle')}</span>
          {avgRating !== null ? (
            <div className={styles.rating_row}>
              <StarRating value={Math.round(avgRating)} readonly size={18} />
              <span className={styles.rating_num}>{avgRating.toFixed(1)}</span>
            </div>
          ) : (
            <div className={styles.rating_row}>
              <StarRating value={0} readonly size={18} />
              <span className={styles.rating_num}>—</span>
            </div>
          )}
        </div>

        {/* Превью картинок из комментариев */}
        {previewImages.length > 0 && (
          <div className={styles.images_row}>
            {previewImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className={styles.preview_img}
              />
            ))}
          </div>
        )}

        {/* Счётчик комментариев */}
        <p className={styles.count}>
          {t('compactLeftCount', { count: liveTotal })}
        </p>

        {/* Кнопка */}
        <button className={styles.view_btn} onClick={() => setIsModalOpen(true)}>
          {t('compactViewAll')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <PostCommentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        postId={postId}
        scrollToCommentId={null}
        currentUserId={currentUserId}
        onZoomImage={() => {}}
      />
    </>
  )
}
