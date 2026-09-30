'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { FilesLectureIcon } from '../icons'
import { filesFetch } from '../lib'
import styles from './SubjectFilter.module.scss'

/**
 * "Предмет" next to the files search: the subjects of the user's own lectures
 * (their notes are filed into «Конспекты лекций/<Предмет>»). Hidden until
 * there is at least one.
 */
export function SubjectFilter({ value, onChange }: { value: string; onChange: (subject: string) => void }) {
  const t = useTranslations('files')
  const subjects = useQuery({
    queryKey: ['lecture-subjects'],
    queryFn: () => filesFetch<{ subjects: string[] }>('/api/lecture/subjects'),
    staleTime: 60_000,
    retry: false,
  })
  const list = subjects.data?.subjects ?? []
  if (!list.length && !value) return null
  return (
    <label className={`${styles.wrap} ${value ? styles.on : ''}`}>
      <FilesLectureIcon size={15} className={styles.icon} />
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={t('subjectFilter')}>
        <option value="">{t('subjectAll')}</option>
        {list.map(s => <option key={s} value={s}>{s}</option>)}
        {value && !list.includes(value) && <option value={value}>{value}</option>}
      </select>
    </label>
  )
}
