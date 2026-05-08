'use client'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {TextAreaUI} from '@/shared/ui/inputs/TextAreaUI/TextAreaUI'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {toast} from 'sonner'
import styles from './NodeComplaintModal.module.scss'

interface Props {
  isOpen: boolean
  onClose: () => void
  roadmapId: string
  nodeId: string
  nodeType: string
}

export function NodeComplaintModal({isOpen, onClose, roadmapId, nodeId, nodeType}: Props) {
  const t = useTranslations('roadMap')
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
          roadmapId,
          targetId: nodeId,
          targetType: `ROADMAP_NODE:${nodeType}`,
        }),
      })
      if (res.status === 409) {
        toast.info(t('complaintAlreadyReported'))
        handleClose()
        return
      }
      if (!res.ok) throw new Error()
      toast.success(t('complaintSuccess'))
      handleClose()
    } catch {
      toast.error(t('complaintError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={handleClose}
      additionalTitle={<span style={{fontWeight: 700, fontSize: 16}}>{t('complaintModalTitle')}</span>}
      modalFooter={
        <div className={styles.footer}>
          <button className={styles.cancel_btn} onClick={handleClose} disabled={submitting}>
            {t('complaintCancel')}
          </button>
          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
          >
            {t('complaintSubmit')}
          </button>
        </div>
      }
    >
      <div className={styles.modal_content}>
        <div className={styles.node_info}>
          {t('complaintBlock')}&nbsp;<span className={styles.node_type}>{nodeType}</span>
        </div>

        <div>
          <p className={styles.section_title}>{t('complaintDescribe')}</p>
          <TextAreaUI
            placeholder={t('complaintPlaceholder')}
            currentValue={text}
            onSetValue={setText}
            theme='newWhite'
          />
        </div>
      </div>
    </ModalWindowDefault>
  )
}
