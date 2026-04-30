'use client'

import CommentService, {ICommentResponse} from '@/features/services/CommentService.service'
import {SelectPhotoInput} from '@/shared/ui/inputs/SelectPhotoInput/SelectPhotoInput'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import UserHeaderCard from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import {useEffect, useRef, useState} from 'react'
import {CommentImages, CommentItem} from '../PostCommentSection'
import styles from './Postcommentmodal.module.scss'

function commentToUI(c: ICommentResponse): CommentItem {
  return {
    id: c.id,
    user: {
      cardID: c.id,
      userID: c.authorId,
      name: c.author?.name ?? 'Unknown',
      role: c.authorRole === 'TEACHER' ? 'Admin' : 'Member',
      image: c.author?.avatarUrl ?? '',
      dateActivity: new Date(c.createdAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}),
      BlurDots: c.authorRole === 'TEACHER'
    },
    commentText: c.text,
    images: c.imageUrls ?? []
  }
}

interface DraftImage {
  file: File
  previewUrl: string
}

// ─── Comment row ──────────────────────────────────────────────────────────────

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
  onUpdated: (c: CommentItem) => void
  onDeleted: (id: string) => void
  onZoomImage?: (src: string) => void
}) {
  const isOwn = currentUserId === comment.user.userID
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.commentText)
  const [editDrafts, setEditDrafts] = useState<DraftImage[]>([])
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
    editDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
    setEditDrafts([])
  }

  const handleSave = async () => {
    const trimmed = editText.trim()
    if (!trimmed && editDrafts.length === 0) return
    if (trimmed === comment.commentText && editDrafts.length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const updated = await CommentService.update(postId, comment.id, {
        text: trimmed,
        images: editDrafts.map((d) => d.file)
      })
      onUpdated(commentToUI(updated))
      editDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
      setEditDrafts([])
      setEditing(false)
    } catch {
      // TODO: toast
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return
    setDeleting(true)
    try {
      await CommentService.delete(postId, comment.id)
      onDeleted(comment.id)
    } catch {
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
        <UserHeaderCard size='lg' {...comment.user} />
        {isOwn && !editing && (
          <div style={{display: 'flex', gap: 4, flexShrink: 0}}>
            <button onClick={() => setEditing(true)} style={actionBtnStyle} title='Edit'>
              <svg
                width='15'
                height='15'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              style={{...actionBtnStyle, color: '#AC2525'}}
              title='Delete'
              disabled={deleting}
            >
              <svg
                width='15'
                height='15'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
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

            {editDrafts.length > 0 && (
              <div style={{display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap'}}>
                {editDrafts.map(({previewUrl}) => (
                  <div key={previewUrl} style={{position: 'relative'}}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt='draft'
                      width={56}
                      height={56}
                      style={{objectFit: 'cover', borderRadius: 8, display: 'block'}}
                    />
                    <button
                      onClick={() => handleRemoveDraft(previewUrl)}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#141416',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                      aria-label='Remove'
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 8}}>
              <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
              <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleCancelEdit} style={cancelBtnStyle}>
                Cancel
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
  onClose: (e: React.MouseEvent) => void
  postId: string
  comments: CommentItem[]
  totalComments: number
  scrollToCommentId?: string | null
  currentUserId?: string
  onCommentUpdated: (c: CommentItem) => void
  onCommentDeleted: (id: string) => void
  onCommentCreated: (c: CommentItem) => void
  onZoomImage?: (src: string) => void
}

export function PostCommentModal({
  isOpen,
  onClose,
  postId,
  comments,
  totalComments,
  scrollToCommentId,
  currentUserId,
  onCommentUpdated,
  onCommentDeleted,
  onCommentCreated,
  onZoomImage
}: PostCommentModalProps) {
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<DraftImage[]>([])
  const [sending, setSending] = useState(false)

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
    if (!trimmed && drafts.length === 0) return
    setSending(true)
    try {
      const created = await CommentService.create(postId, {
        text: trimmed,
        images: drafts.map((d) => d.file)
      })
      onCommentCreated(commentToUI(created))
      setText('')
      drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl))
      setDrafts([])
    } catch {
      // TODO: toast
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
    }, 100)
    return () => clearTimeout(timer)
  }, [isOpen, scrollToCommentId])

  const footer = (
    <div className={styles.comment_input_bar}>
      <SelectPhotoInput size='m' onSelectImageFile={handleSelectFile} />
      <div className={styles.input_area}>
        {drafts.length > 0 && (
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
                <button
                  className={styles.draft_remove_btn}
                  onClick={() => handleRemoveDraft(previewUrl)}
                  aria-label='Remove image'
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
        disabled={sending || (!text.trim() && drafts.length === 0)}
        style={{opacity: sending ? 0.5 : 1}}
      >
        <svg
          width='22'
          height='22'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <line x1='22' y1='2' x2='11' y2='13' />
          <polygon points='22 2 15 22 11 13 2 9 22 2' />
        </svg>
      </button>
    </div>
  )

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<p className={styles.modal_title}>Comments ({totalComments})</p>}
      modalFooter={footer}
    >
      <ul className={styles.comments_list}>
        {comments.map((el, i) => (
          <CommentRow
            key={el.id ?? i}
            comment={el}
            postId={postId}
            currentUserId={currentUserId}
            onUpdated={onCommentUpdated}
            onDeleted={onCommentDeleted}
            onZoomImage={onZoomImage}
          />
        ))}
      </ul>
    </ModalWindowDefault>
  )
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const actionBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 6,
  color: '#868897',
  display: 'flex',
  alignItems: 'center'
}
const editTextareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #E5E5E5',
  background: '#fff',
  fontSize: 14,
  color: '#141416',
  lineHeight: 1.5,
  resize: 'none',
  outline: 'none',
  fontFamily: 'inherit'
}
const saveBtnStyle: React.CSSProperties = {
  height: 32,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  background: '#141416',
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer'
}
const cancelBtnStyle: React.CSSProperties = {
  height: 32,
  padding: '0 16px',
  borderRadius: 8,
  border: '1px solid #E5E5E5',
  background: '#F7F7F7',
  color: '#868897',
  fontSize: 13,
  cursor: 'pointer'
}
