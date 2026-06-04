'use client'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {TextAreaUI} from '@/shared/ui/inputs/TextAreaUI/TextAreaUI'
import {useState} from 'react'
import {toast} from 'sonner'
import {useTranslations} from 'next-intl'
import styles from './PostComplaintModal.module.scss'

interface Props {
  isOpen: boolean
  onClose: () => void
  postId: string
  postTitle?: string
}

export function PostComplaintModal({isOpen, onClose, postId, postTitle}: Props) {
  const t = useTranslations('PostComplaintModal')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleClose = () => {
    setText('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          text: text.trim(),
          postId,
          targetId: postId,
          targetType: 'POST',
        }),
      })
      if (res.status === 401) {
        toast.error(t('loginError'))
        return
      }
      if (res.status === 409) {
        toast.info(t('alreadyReported'))
        handleClose()
        return
      }
      if (!res.ok) throw new Error()
      toast.success(t('success'))
      handleClose()
    } catch {
      toast.error(t('error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={handleClose}
      additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('title')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={handleClose} disabled={submitting}>
            {t('cancel')}
          </button>
          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
      }
    >
      <div className={styles.modal_content}>
        {postTitle && (
          <div className={styles.post_info}>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
              <polyline points='14 2 14 8 20 8' />
            </svg>
            <span className={styles.post_title}>{postTitle}</span>
          </div>
        )}
        <div>
          <p className={styles.section_title}>{t('describeLabel')}</p>
          <TextAreaUI
            placeholder={t('placeholder')}
            currentValue={text}
            onSetValue={setText}
            theme='newWhite'
          />
        </div>
      </div>
    </ModalWindowDefault>
  )
}
