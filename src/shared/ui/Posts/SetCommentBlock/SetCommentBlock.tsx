'use client'

import CommentService from '@/features/services/CommentService.service'
import {useMyComment} from '@/features/hooks/Comments/useMyComment'
import {usePostRating} from '@/features/hooks/Comments/usePostRating'
import {TextAreaUI} from '@/shared/ui/inputs/TextAreaUI/TextAreaUI'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'
import {useQueryClient} from '@tanstack/react-query'
import {StarRating} from '../PostCommentSection/PostCommentSection'
import styles from './SetCommentBlock.module.scss'
import {CreateImagesInput} from '../../inputs'

interface SetCommentBlockProps {
  postId: string
}

export function SetCommentBlock({postId}: SetCommentBlockProps) {
  const queryClient = useQueryClient()
  const {data: myComment, isLoading: commentLoading} = useMyComment(postId)
  const {data: ratingData, isLoading: ratingLoading} = usePostRating(postId)

  const hasComment = !!myComment

  const [text, setText] = useState('')
  const [stars, setStars] = useState<number | null>(null)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [keepImageUrls, setKeepImageUrls] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    if (myComment) {
      setText(myComment.text)
      setKeepImageUrls(myComment.imageUrls ?? [])
    } else if (myComment === null) {
      setText('')
      setKeepImageUrls([])
    }
  }, [myComment])

  useEffect(() => {
    setStars(ratingData?.userRating ?? null)
  }, [ratingData])

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed && newFiles.length === 0 && keepImageUrls.length === 0 && stars === null) return

    setSending(true)
    const toastId = toast.loading(hasComment ? 'Сохранение...' : 'Публикуем...')

    try {
      await Promise.all([
        hasComment && myComment
          ? CommentService.update(postId, myComment.id, {
              text: trimmed,
              images: newFiles,
              keepImageUrls
            })
          : trimmed || newFiles.length > 0
            ? CommentService.create(postId, {text: trimmed, images: newFiles})
            : Promise.resolve(),
        stars !== null ? CommentService.ratePost(postId, stars) : Promise.resolve()
      ])

      setNewFiles([])
      setInputKey((k) => k + 1)

      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['myComment', postId]}),
        queryClient.invalidateQueries({queryKey: ['rating', postId]}),
        queryClient.invalidateQueries({queryKey: ['comments', postId]})
      ])

      toast.success(hasComment ? 'Изменения сохранены!' : 'Опубликовано!', {id: toastId})
    } catch {
      toast.error('Не удалось опубликовать', {id: toastId})
    } finally {
      setSending(false)
    }
  }

  if (commentLoading || ratingLoading) {
    return (
      <div className={styles.block}>
        <p className={styles.heading}>Оставить отзыв</p>
        <div className={styles.skeleton} />
      </div>
    )
  }

  const canSubmit =
    !sending && (text.trim().length > 0 || newFiles.length > 0 || keepImageUrls.length > 0 || stars !== null)

  return (
    <div className={styles.block}>
      <p className={styles.heading}>Оставить отзыв</p>

      <div className={styles.stars_row}>
        <StarRating extraClass={styles.stars} value={stars} onChange={setStars} size={56} />
      </div>

      <TextAreaUI
        placeholder='Поделитесь своими мыслями об этом посте...'
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
        activeImages={keepImageUrls}
        onFilesChange={setNewFiles}
        onActiveImagesChange={setKeepImageUrls}
        maxFiles={9}
        extraClass={styles.extra_images}
        allowMultipleFiles
        showBigFirstItem={true}
        inputIdPrefix={`comment-img-2-${postId}`}
      />

      <div className={styles.submit_row}>
        <button className={styles.submit_btn} onClick={handleSubmit} disabled={!canSubmit}>
          {hasComment ? 'Сохранить изменения' : 'Опубликовать'}
        </button>
      </div>
    </div>
  )
}
