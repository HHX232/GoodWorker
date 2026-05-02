'use client'

import CommentService from '@/features/services/CommentService.service'

import { TextAreaUI } from '@/shared/ui/inputs/TextAreaUI/TextAreaUI'
import { useState } from 'react'
import { toast } from 'sonner'
import { StarRating } from '../PostCommentSection/PostCommentSection'
import styles from './SetCommentBlock.module.scss'
import { CreateImagesInput } from '../../inputs'

interface SetCommentBlockProps {
  postId: string
}

export function SetCommentBlock({ postId }: SetCommentBlockProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [stars, setStars] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  // key forces CreateImagesInput to remount and clear its internal state after submit
  const [inputKey, setInputKey] = useState(0)

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed && files.length === 0 && stars === null) return

    setSending(true)
    const toastId = toast.loading('Sending…')

    try {
      await Promise.all([
        trimmed || files.length > 0
          ? CommentService.create(postId, { text: trimmed, images: files })
          : Promise.resolve(),
        stars !== null
          ? CommentService.ratePost(postId, stars)
          : Promise.resolve(),
      ])

      setText('')
      setFiles([])
      setStars(null)
      setInputKey((k) => k + 1)
      setSent(true)
      toast.success('Published!', { id: toastId })
    } catch {
      toast.error('Failed to publish', { id: toastId })
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className={styles.success_box}>
        <svg width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='#22c55e' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <polyline points='20 6 9 17 4 12' />
        </svg>
        <p className={styles.success_text}>Thank you for your feedback!</p>
      </div>
    )
  }

  const canSubmit = !sending && (text.trim().length > 0 || files.length > 0 || stars !== null)

  return (
    <div className={styles.block}>
      <p className={styles.heading}>Leave a review</p>

      <div className={styles.stars_row}>
        <StarRating extraClass={styles.stars} value={stars} onChange={setStars} size={56} />
       
      </div>

      <TextAreaUI
        placeholder='Share your thoughts about this post…'
        currentValue={text}
        onSetValue={setText}
        autoResize
        minRows={3}
        maxRows={10}
        theme='newWhite'
        disabled={sending}
      />

      <CreateImagesInput
        key={inputKey}
        onFilesChange={setFiles}
        maxFiles={9}
        allowMultipleFiles
        showBigFirstItem={true}
        inputIdPrefix={`comment-img-2-${postId}`}
      />

      <div className={styles.submit_row}>
        <button
          className={styles.submit_btn}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Publish
        </button>
      </div>
    </div>
  )
}
