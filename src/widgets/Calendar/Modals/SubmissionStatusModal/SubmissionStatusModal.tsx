'use client'

import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import styles from './SubmissionStatusModal.module.scss'

export interface SubmissionStudentStatus {
  id: string
  name: string
  submitted: boolean
  submittedAt: string | null
  late: boolean
}

export interface SubmissionStatus {
  folderId: string
  folderName: string
  deadline: string
  students: SubmissionStudentStatus[]
}

function fmt(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/** Who has (and hasn't) submitted into a tutor's submission-dropbox folder by its deadline — opened from the calendar's deadline chip. */
export function SubmissionStatusModal({ status, onClose }: { status: SubmissionStatus | null; onClose: () => void }) {
  const t = useTranslations('calendar.fileDeadlines')
  const locale = useLocale()

  return (
    <ModalWindowDefault isOpen={!!status} onClose={onClose} additionalTitle={status?.folderName}>
      {status && (
        <div className={styles.body}>
          <p className={styles.due}>{t('dueAt', { date: fmt(status.deadline, locale) })}</p>
          <ul className={styles.list}>
            {status.students.map(s => (
              <li key={s.id} className={styles.row}>
                <span className={`${styles.dot} ${s.submitted ? (s.late ? styles.dotLate : styles.dotOk) : styles.dotMissing}`} />
                <span className={styles.name}>{s.name}</span>
                <span className={styles.state}>
                  {s.submitted ? (s.late ? t('late') : t('submitted')) : t('notSubmitted')}
                  {s.submittedAt && ` · ${fmt(s.submittedAt, locale)}`}
                </span>
              </li>
            ))}
          </ul>
          <Link href={`/files?folder=${status.folderId}`} className={styles.openFolder} onClick={onClose}>
            {t('openFolder')}
          </Link>
        </div>
      )}
    </ModalWindowDefault>
  )
}
