'use client'

import CommentService, { ICommentResponse } from '@/features/services/CommentService.service'
import { usePostRating } from '@/features/hooks/Comments/usePostRating'
import { useQueryParams } from '@/shared/helpers/setQueryParams'
import { UserHeaderCardProps } from '@/shared/types'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { SelectPhotoInput } from '../../inputs/SelectPhotoInput/SelectPhotoInput'
import { ModalImageZoom } from '../../Modals/ModalImageZoom/ModalImageZoom'
import UserHeaderCard from '../../User/UserHeaderCard/UserHeaderCard'
import { getErrorMessage, PostCommentModal } from './Postcommentmodal/Postcommentmodal'
import styles from './PostCommentSection.module.scss'


interface StarRatingProps {
  value: number | null
  onChange?: (stars: number) => void
  readonly?: boolean
  size?: number
  extraClass?:string
}
// TODO разбить типы и вынести хелперы
export function StarRating({value, onChange, readonly = false, size = 18, extraClass = ''}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value ?? 0

  return (
    <div className={extraClass} style={{display: 'flex', gap: 2, alignItems: 'center'}} onMouseLeave={() => !readonly && setHovered(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox='0 0 24 24'
          fill={star <= display ? '#FF7A00' : 'none'}
          stroke={star <= display ? '#FF7A00' : '#E5E5E5'}
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          style={{cursor: readonly ? 'default' : 'pointer', transition: 'fill 0.12s, stroke 0.12s', flexShrink: 0}}
          onMouseEnter={() => !readonly && setHovered(star)}
          onClick={() => !readonly && onChange?.(star)}
        >
          <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
        </svg>
      ))}
    </div>
  )
}

// ─── Comment images with zoom trigger ────────────────────────────────────────

interface CommentImagesProps {
  images: string[]
  size?: number
  onZoom?: (src: string) => void
}

export function CommentImages({images, size = 80, onZoom}: CommentImagesProps) {
  if (!images.length) return null
  return (
    <div className={styles.images_previews}>
      {images.map((src, i) => (
        <div
          key={i}
          className={styles.image_zoom_wrap}
          onClick={() => onZoom?.(src)}
          role={onZoom ? 'button' : undefined}
          tabIndex={onZoom ? 0 : undefined}
          onKeyDown={onZoom ? (e) => e.key === 'Enter' && onZoom(src) : undefined}
          style={{cursor: onZoom ? 'pointer' : 'default'}}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt='comment image'
            width={size}
            height={size}
            className={styles.image_preview}
            style={{objectFit: 'cover', borderRadius: 8, display: 'block'}}
          />
          {onZoom && (
            <div className={styles.image_zoom_overlay}>
              <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                <circle cx='11' cy='11' r='8' />
                <line x1='21' y1='21' x2='16.65' y2='16.65' />
                <line x1='11' y1='8' x2='11' y2='14' />
                <line x1='8' y1='11' x2='14' y2='11' />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Draft previews ───────────────────────────────────────────────────────────

export interface DraftImage {
  file: File
  previewUrl: string
}

export function DraftPreviews({drafts, onRemove}: {drafts: DraftImage[]; onRemove: (previewUrl: string) => void}) {
  if (!drafts.length) return null
  return (
    <div className={styles.draft_previews}>
      {drafts.map(({previewUrl}) => (
        <div key={previewUrl} className={styles.draft_preview_wrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt='draft'
            width={40}
            height={40}
            className={styles.draft_preview_img}
            style={{objectFit: 'cover', borderRadius: 6}}
          />
          <button className={styles.draft_remove_btn} onClick={() => onRemove(previewUrl)} aria-label='Remove image'>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentItem {
  id: string
  user: UserHeaderCardProps
  commentText: string
  images: string[]
  stars?: number | null
}

export function commentToUI(c: ICommentResponse): CommentItem {
  return {
    id: c.id,
    user: {
      cardID: c.id,
      complaintPostId: c.postId,
      userID: c.authorId,
      name: c.author?.name ?? 'Unknown',
      role: c.authorRole === 'TEACHER' ? 'Admin' : 'Member',
      image: c.author?.avatarUrl ?? '',
      dateActivity: new Date(c.createdAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      BlurDots: c.authorRole === 'TEACHER'
    },
    commentText: c.text,
    images: c.imageUrls ?? [],
    stars: c.stars ?? null
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PostCommentSectionProps {
  postId: string
  initialComments: CommentItem[]
  totalComments: number
  currentUserId?: string
}

export function PostCommentSection({
  postId,
  initialComments,
  totalComments: initialTotal,
  currentUserId
}: PostCommentSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {data: commentsData} = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({pageParam}) => CommentService.getList(postId, {page: pageParam as number, limit: 15}),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    staleTime: 30_000,
  })

  const liveComments = commentsData
    ? commentsData.pages.flatMap((p) => p.comments.map(commentToUI))
    : initialComments
  const liveTotal = commentsData?.pages[0]?.pagination.total ?? initialTotal

  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<DraftImage[]>([])
  const [sending, setSending] = useState(false)

  const queryClient = useQueryClient()
  const {data: ratingData} = usePostRating(postId)
  const userRating = ratingData?.userRating ?? null
  const avgRating = ratingData?.averageStars ?? null
  const [pendingStars, setPendingStars] = useState<number | null>(null)

  const [zoomSrc, setZoomSrc] = useState<string | null>(null)

  const {getQueryParam, setQueryParams} = useQueryParams()
  const scrollToCommentId = getQueryParam('commentIdToScroll')

  const handleSelectFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setDrafts((prev) => [...prev, {file, previewUrl}])
  }

  const handleRemoveDraft = (previewUrl: string) => {
    setDrafts((prev) => {
      const removed = prev.find((d) => d.previewUrl === previewUrl)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((d) => d.previewUrl !== previewUrl)
    })
  }

const handleSend = async () => {
  const trimmed = text.trim()
  if (!trimmed && drafts.length === 0 && pendingStars === null) return
  const toastId = toast.loading('Sending…')
  setSending(true)
  try {
    await Promise.all([
      trimmed || drafts.length > 0
        ? CommentService.create(postId, {text: trimmed, images: drafts.map((d) => d.file)})
        : Promise.resolve(),
      pendingStars !== null ? CommentService.ratePost(postId, pendingStars) : Promise.resolve()
    ])
    setText('')
    drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
    setDrafts([])
    setPendingStars(null)
    if (trimmed || drafts.length > 0) setIsModalOpen(true)
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['myComment', postId]}),
      pendingStars !== null ? queryClient.invalidateQueries({queryKey: ['rating', postId]}) : Promise.resolve()
    ])
    toast.success('Posted!', {id: toastId})
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to send'), {id: toastId})
  } finally {
    setSending(false)
  }
}
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <div className={styles.box}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.flex_wrapper}>
            <p className={styles.total_comments}>Comments ({liveTotal})</p>
            {avgRating !== null && (
              <span style={{fontSize: 13, color: '#868897', display: 'flex', alignItems: 'center', gap: 4}}>
                <StarRating value={Math.round(avgRating)} readonly size={14} />
                <span style={{color: '#141416', fontWeight: 500}}>{avgRating.toFixed(1)}</span>
              </span>
            )}
          </div>
          <button className={styles.view_all_button} onClick={() => setIsModalOpen(true)}>
            view all
          </button>
        </div>

        {/* Превью — только SSR-данные, первые 3 */}
        <div className={styles.content}>
          <ul>
            {liveComments.slice(0, 3).map((el) => {
              const isLong = el.commentText.length > 50
              return (
                <div className={styles.comment_item} key={el.id}>
                  <UserHeaderCard size='sm' {...el.user} />
                  <div className={styles.comment_content}>
                    <p className={styles.comment_text_mini}>
                      {isLong ? el.commentText.slice(0, 50) : el.commentText}
                      {isLong && (
                        <>
                          {' '}...
                          <span
                            onClick={() => {
                              setIsModalOpen(true)
                              setQueryParams({commentIdToScroll: el.user.userID})
                            }}
                            className={styles.see_more}
                          >
                            {' '}See more
                          </span>
                        </>
                      )}
                    </p>
                    <CommentImages images={el.images} size={80} onZoom={setZoomSrc} />
                  </div>
                </div>
              )
            })}
            {liveTotal > 3 && (
              <button className={styles.show_all_bottom_button} onClick={() => setIsModalOpen(true)}>
                Show all {liveTotal} comments
              </button>
            )}
          </ul>
        </div>

        {/* Rating row */}
        <div className={styles.rating_row}>
          <span className={styles.rating_label}>Your rating:</span>
          <StarRating value={pendingStars ?? userRating} onChange={setPendingStars} size={20} />
          {(pendingStars ?? userRating) !== null && (
            <span className={styles.rating_value}>({pendingStars ?? userRating}/5)</span>
          )}
        </div>

        {/* Input bar */}
        <div className={styles.comment_input_bar}>
          <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
          <div className={styles.input_area}>
            <DraftPreviews drafts={drafts} onRemove={handleRemoveDraft} />
            <input
              className={styles.comment_input}
              type='text'
              placeholder='Write your comment here'
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
          </div>
          <button
            className={styles.send_button}
            aria-label='Send comment'
            onClick={handleSend}
            disabled={sending || (!text.trim() && drafts.length === 0 && pendingStars === null)}
            style={{opacity: sending ? 0.5 : 1}}
          >
            <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
              <line x1='22' y1='2' x2='11' y2='13' />
              <polygon points='22 2 15 22 11 13 2 9 22 2' />
            </svg>
          </button>
        </div>
      </div>

      <PostCommentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          if (scrollToCommentId) setQueryParams({commentIdToScroll: null}, {replace: true})
        }}
        postId={postId}
        scrollToCommentId={scrollToCommentId}
        currentUserId={currentUserId}
        onZoomImage={setZoomSrc}
      />

      <ModalImageZoom isOpen={zoomSrc !== null} src={zoomSrc} onClose={() => setZoomSrc(null)} />
    </>
  )
}