'use client'
import {useMyRoadmapComment} from '@/features/hooks/Roadmap/useMyRoadmapComment'
import {useRoadmapRating} from '@/features/hooks/Roadmap/useRoadmapRating'
import RoadmapService from '@/features/services/RoadmapService.service'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {StarRating} from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import {CreateImagesInput} from '@/shared/ui/inputs/CreateImagesInput/CreateImagesInput'
import {TextAreaUI} from '@/shared/ui/inputs/TextAreaUI/TextAreaUI'
import {useQueryClient} from '@tanstack/react-query'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'
import styles from './RoadmapReviewModal.module.scss'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface Props {
  roadmapId: string
  isOpen: boolean
  onClose: () => void
  initialStars?: number | null
}

export function RoadmapReviewModal({roadmapId, isOpen, onClose, initialStars}: Props) {
  const t = useTranslations('roadMap')
  const queryClient = useQueryClient()
  const {data: existingComment} = useMyRoadmapComment(roadmapId)
  const {data: ratingData} = useRoadmapRating(roadmapId)

  const [stars, setStars] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [activeImages, setActiveImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // initialStars (from bar click) takes priority over saved rating
      setStars(initialStars ?? ratingData?.userRating ?? null)
      setText(existingComment?.text ?? '')
      setActiveImages(existingComment?.imageUrls ?? [])
      setNewFiles([])
    }
  }, [isOpen, existingComment, ratingData, initialStars])

  const handleSubmit = async () => {
    if (!text.trim() && newFiles.length === 0 && activeImages.length === 0 && stars === null) return

    setSubmitting(true)
    const toastId = toast.loading(t('reviewSaving'))
    try {
      const uploadedBase64 = await Promise.all(newFiles.map(fileToBase64))
      const allImageUrls = [...activeImages, ...uploadedBase64]

      await Promise.all([
        text.trim() || allImageUrls.length > 0
          ? RoadmapService.createOrUpdateComment(roadmapId, {
              text: text.trim(),
              imageUrls: allImageUrls
            })
          : Promise.resolve(),
        stars !== null ? RoadmapService.setRating(roadmapId, stars) : Promise.resolve()
      ])

      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['myRoadmapComment', roadmapId]}),
        queryClient.invalidateQueries({queryKey: ['roadmapRating', roadmapId]})
      ])

      toast.success(t('reviewSaved'), {id: toastId})
      onClose()
    } catch {
      toast.error(t('reviewError'), {id: toastId})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('reviewTitle')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={onClose} disabled={submitting}>
            {t('reviewCancel')}
          </button>
          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={
              submitting || (stars === null && !text.trim() && newFiles.length === 0 && activeImages.length === 0)
            }
          >
            {existingComment ? t('reviewUpdate') : t('reviewSubmit')}
          </button>
        </div>
      }
    >
      <div className={styles.modal_content}>
        <div className={styles.stars_row}>
          <StarRating value={stars} onChange={setStars} size={40} />
        </div>

        <div className={styles.comment_section}>
          <p className={styles.section_title}>{t('reviewComment')}</p>
          <TextAreaUI
            placeholder={t('reviewCommentPlaceholder')}
            currentValue={text}
            onSetValue={setText}
            theme='newWhite'
          />
        </div>

        <div>
          <p className={styles.section_title}>{t('reviewPhotos')}</p>
          <CreateImagesInput
            maxFiles={5}
            activeImages={activeImages}
            onFilesChange={setNewFiles}
            onActiveImagesChange={setActiveImages}
            showBigFirstItem={true}
            inputIdPrefix='roadmap-review'
          />
        </div>
      </div>
    </ModalWindowDefault>
  )
}
