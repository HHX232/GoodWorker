'use client'

import CommentService, { ICommentResponse, ICommentsListResponse } from '@/features/services/CommentService.service'
import { SelectPhotoInput } from '@/shared/ui/inputs/SelectPhotoInput/SelectPhotoInput'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import UserHeaderCard from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { CommentImages, CommentItem, DraftImage, DraftPreviews, commentToUI, StarRating } from '../PostCommentSection'
import styles from './Postcommentmodal.module.scss'
// TODO разнести функции
const LIMIT = 15
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return fallback
}
// ─── useInfiniteComments ──────────────────────────────────────────────────────

function useInfiniteComments(postId: string, enabled: boolean, lang = 'ru') {
  const queryClient = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const {data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading} = useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({pageParam}) => CommentService.getList(postId, {page: pageParam as number, limit: LIMIT, lang}),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled,
    staleTime: 0,
    gcTime: 0,
  })

  const comments = data?.pages.flatMap((p) => p.comments.map(commentToUI)) ?? []
  const total = data?.pages[0]?.pagination.total ?? 0
  const loading = isLoading || isFetchingNextPage

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage()
      },
      {threshold: 0.1}
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, loading, fetchNextPage])

  const addComment = useCallback(
    (c: ICommentResponse) => {
      queryClient.setQueryData<InfiniteData<ICommentsListResponse>>(['comments', postId], (old) => {
        if (!old) return old
        const [first, ...rest] = old.pages
        return {
          ...old,
          pages: [
            {
              ...first,
              comments: [c, ...first.comments],
              pagination: {...first.pagination, total: first.pagination.total + 1},
            },
            ...rest,
          ],
        }
      })
    },
    [queryClient, postId]
  )

  const updateComment = useCallback(
    (c: ICommentResponse) => {
      queryClient.setQueryData<InfiniteData<ICommentsListResponse>>(['comments', postId], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            comments: page.comments.map((existing) => (existing.id === c.id ? c : existing)),
          })),
        }
      })
    },
    [queryClient, postId]
  )

  const deleteComment = useCallback(
    (id: string) => {
      queryClient.setQueryData<InfiniteData<ICommentsListResponse>>(['comments', postId], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page, i) => ({
            ...page,
            comments: page.comments.filter((c) => c.id !== id),
            pagination: {
              ...page.pagination,
              total: i === 0 ? Math.max(0, page.pagination.total - 1) : page.pagination.total,
            },
          })),
        }
      })
    },
    [queryClient, postId]
  )

  return {comments, total, loading, hasMore: !!hasNextPage, sentinelRef, addComment, updateComment, deleteComment}
}

// ─── CommentRow ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  postId,
  currentUserId,
  onUpdated,
  onDeleted,
  onZoomImage
}: {
  comment: CommentItem
  postId: string
  currentUserId?: string
  onUpdated: (c: ICommentResponse) => void
  onDeleted: (id: string) => void
  onZoomImage?: (src: string) => void
}) {
  const t = useTranslations('PostCommentModal')
  const isOwn = currentUserId === comment.user.userID
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.commentText)
  const [editDrafts, setEditDrafts] = useState<DraftImage[]>([])
  const [editExistingUrls, setEditExistingUrls] = useState<string[]>(comment.images)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const handleSelectFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setEditDrafts((prev) => [...prev, {file, previewUrl}])
  }

  const handleRemoveDraft = (previewUrl: string) => {
    setEditDrafts((prev) => {
      const removed = prev.find((d) => d.previewUrl === previewUrl)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((d) => d.previewUrl !== previewUrl)
    })
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setEditText(comment.commentText)
    setEditExistingUrls(comment.images)
    editDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
    setEditDrafts([])
  }

  const handleSave = async () => {
    const trimmed = editText.trim()
    if (!trimmed && editExistingUrls.length === 0 && editDrafts.length === 0) return

    const toastId = toast.loading(t('saving'))
    setSaving(true)
    try {
      const updated = await CommentService.update(postId, comment.id, {
        text: trimmed,
        images: editDrafts.map((d) => d.file),
        keepImageUrls: editExistingUrls
      })
      onUpdated(updated)
      editDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
      setEditDrafts([])
      setEditing(false)
      toast.success(t('updated'), {id: toastId})
    } catch {
      toast.error(t('updateError'), {id: toastId})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return

    const toastId = toast.loading(t('deleting'))
    setDeleting(true)
    try {
      await CommentService.delete(postId, comment.id)
      onDeleted(comment.id)
      toast.success(t('deleted'), {id: toastId})
    } catch {
      toast.error(t('deleteError'), {id: toastId})
      setDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') handleCancelEdit()
  }

  return (
    <div
      className={styles.comment_item}
      id={comment.user.userID}
      style={{opacity: deleting ? 0.4 : 1, transition: 'opacity 0.2s'}}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          <UserHeaderCard size='lg' {...comment.user} />
          {comment.stars != null && (
            <StarRating value={comment.stars} readonly size={13} />
          )}
        </div>
        {isOwn && !editing && (
          <div style={{display: 'flex', gap: 4, flexShrink: 0}}>
            <button onClick={() => setEditing(true)} style={actionBtnStyle} title='Edit'>
              <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
              </svg>
            </button>
            <button onClick={handleDelete} style={{...actionBtnStyle, color: '#AC2525'}} title='Delete' disabled={deleting}>
              <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <polyline points='3 6 5 6 21 6' />
                <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
                <path d='M10 11v6' />
                <path d='M14 11v6' />
                <path d='M9 6V4h6v2' />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className={styles.comment_content}>
        {editing ? (
          <div style={{marginTop: 8}}>
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              style={editTextareaStyle}
            />

            {editExistingUrls.length > 0 && (
              <div style={{display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap'}}>
                {editExistingUrls.map((url) => (
                  <div key={url} style={{position: 'relative'}}>
                    <Image src={url} alt='existing' width={56} height={56} style={{objectFit: 'cover', borderRadius: 8, display: 'block'}} />
                    <button onClick={() => setEditExistingUrls((prev) => prev.filter((u) => u !== url))} style={removeImgBtnStyle} aria-label='Remove existing image'>×</button>
                  </div>
                ))}
              </div>
            )}

            {editDrafts.length > 0 && (
              <div style={{display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap'}}>
                {editDrafts.map(({previewUrl}) => (
                  <div key={previewUrl} style={{position: 'relative'}}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt='draft' width={56} height={56} style={{objectFit: 'cover', borderRadius: 8, display: 'block'}} />
                    <button onClick={() => handleRemoveDraft(previewUrl)} style={removeImgBtnStyle} aria-label='Remove'>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 8}}>
              <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
              <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
                {saving ? t('saving') : t('save')}
              </button>
              <button onClick={handleCancelEdit} style={cancelBtnStyle}>
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.comment_text}>{comment.commentText}</p>
            <CommentImages images={comment.images} size={120} onZoom={onZoomImage} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface PostCommentModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  scrollToCommentId?: string | null
  currentUserId?: string
  onZoomImage?: (src: string) => void
}

export function PostCommentModal({isOpen, onClose, postId, scrollToCommentId, currentUserId, onZoomImage}: PostCommentModalProps) {
  const t = useTranslations('PostCommentModal')
  const locale = useLocale()
  const {comments, total, loading, hasMore, sentinelRef, addComment, updateComment, deleteComment} =
    useInfiniteComments(postId, isOpen, locale)

  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<DraftImage[]>([])
  const [sending, setSending] = useState(false)
  const [rating, setRating] = useState<number | null>(null)

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
    if (!trimmed && drafts.length === 0 && rating === null) return

    const toastId = toast.loading(t('sending'))
    setSending(true)
    try {
      await Promise.all([
        trimmed || drafts.length > 0
          ? CommentService.create(postId, {text: trimmed, images: drafts.map((d) => d.file)}).then(addComment)
          : Promise.resolve(),
        rating !== null ? CommentService.ratePost(postId, rating) : Promise.resolve(),
      ])
      setText('')
      setRating(null)
      drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
      setDrafts([])
      toast.success(t('published'), {id: toastId})
    } catch (error) {
      toast.error(getErrorMessage(error, t('sendError')), {id: toastId})
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (!isOpen || !scrollToCommentId) return
    const timer = setTimeout(() => {
      document.getElementById(scrollToCommentId)?.scrollIntoView({behavior: 'smooth', block: 'center'})
    }, 300)
    return () => clearTimeout(timer)
  }, [isOpen, scrollToCommentId])

  const footer = (
    <div className={styles.comment_input_bar}>
      <div className={styles.stars_row}>
        <StarRating value={rating} onChange={setRating} size={22} />
      </div>
      <div className={styles.input_row}>
        <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
        <div className={styles.input_area}>
          <DraftPreviews drafts={drafts} onRemove={handleRemoveDraft} />
          <input
            className={styles.comment_input}
            type='text'
            placeholder={t('placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
        </div>
        <button
          className={styles.send_button}
          aria-label={t('send')}
          onClick={handleSend}
          disabled={sending || (!text.trim() && drafts.length === 0 && rating === null)}
          style={{opacity: sending ? 0.5 : 1}}
        >
          <svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
            <line x1='22' y1='2' x2='11' y2='13' />
            <polygon points='22 2 15 22 11 13 2 9 22 2' />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<p className={styles.modal_title}>Комментарии ({total})</p>}
      modalFooter={footer}
    >
      <ul className={styles.comments_list}>
        {comments.map((el, i) => (
          <CommentRow
            key={el.id ?? i}
            comment={el}
            postId={postId}
            currentUserId={currentUserId}
            onUpdated={updateComment}
            onDeleted={deleteComment}
            onZoomImage={onZoomImage}
          />
        ))}
      </ul>

      <div ref={sentinelRef} style={{height: 1}} />

      {loading && (
        <p style={{textAlign: 'center', color: '#868897', fontSize: 13, padding: '12px 0'}}>
          Загрузка…
        </p>
      )}
    </ModalWindowDefault>
  )
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 6, color: '#868897',
  display: 'flex', alignItems: 'center'
}
const removeImgBtnStyle: React.CSSProperties = {
  position: 'absolute', top: -6, right: -6,
  width: 18, height: 18, borderRadius: '50%',
  border: 'none', background: '#AC2525', color: '#fff',
  fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
}
const editTextareaStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #E5E5E5', background: '#fff',
  fontSize: 14, color: '#141416', lineHeight: 1.5,
  resize: 'none', outline: 'none', fontFamily: 'inherit'
}
const saveBtnStyle: React.CSSProperties = {
  height: 32, padding: '0 16px', borderRadius: 8,
  border: 'none', background: '#141416', color: '#fff',
  fontSize: 13, fontWeight: 500, cursor: 'pointer'
}
const cancelBtnStyle: React.CSSProperties = {
  height: 32, padding: '0 16px', borderRadius: 8,
  border: '1px solid #E5E5E5', background: '#F7F7F7',
  color: '#868897', fontSize: 13, cursor: 'pointer'
}