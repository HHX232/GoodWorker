'use client'

import type { FilesPerson } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FilesModal } from '../FilesModal/FilesModal'
import { FilesCheckIcon, FilesSearchIcon } from '../icons'
import { filesFetch, FilesApiError, initials, jsonInit } from '../lib'
import ui from '../ui.module.scss'
import styles from './ShareAccessModal.module.scss'

export interface ShareTarget {
  itemType: 'folder' | 'file'
  id: string
  name: string
  allowStudentUpload?: boolean
}

interface LinkedStudent {
  id: string
  name: string
  avatarUrl: string | null
}

interface ShareAccessModalProps {
  target: ShareTarget
  onClose: () => void
  /** Library data changed (grants / flag) — the shell refetches. */
  onChanged: () => void
}

function Avatar({ person }: { person: { name: string; avatarUrl: string | null } }) {
  return person.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={person.avatarUrl} alt="" className={styles.avatar} />
    : <span className={styles.avatar}>{initials(person.name)}</span>
}

/**
 * R03/R04i/G03: multi-select the teacher's own students (the existing
 * GET /api/teacher/students list — TeacherStudent links only), grant in one
 * request, revoke per student, and — for folders — the "students can submit
 * here" switch.
 */
export function ShareAccessModal({ target, onClose, onChanged }: ShareAccessModalProps) {
  const t = useTranslations('files')
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [allowUpload, setAllowUpload] = useState(!!target.allowStudentUpload)

  const grantsKey = ['tutor-files', 'grants', target.itemType, target.id]
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['teacher', 'students', 'mine'],
    queryFn: () => filesFetch<{ students: LinkedStudent[] }>('/api/teacher/students'),
  })
  const { data: grantsData } = useQuery({
    queryKey: grantsKey,
    queryFn: () => filesFetch<{ students: FilesPerson[] }>(`/api/tutor-files/grants?itemType=${target.itemType}&itemId=${target.id}`),
  })

  const students = studentsData?.students ?? []
  const granted = useMemo(() => new Set((grantsData?.students ?? []).map(s => s.id)), [grantsData])
  const visible = students.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase()))
  const toGrant = [...selected].filter(id => !granted.has(id))

  const fail = (e: unknown) => toast.error(e instanceof FilesApiError && e.code === 'VIP_REQUIRED' ? t('errVip') : t('errGeneric'))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: grantsKey })
    onChanged()
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const grant = async () => {
    if (toGrant.length === 0) return
    setBusy(true)
    try {
      await filesFetch('/api/tutor-files/grants', jsonInit('POST', { itemType: target.itemType, itemId: target.id, studentIds: toGrant }))
      setSelected(new Set())
      toast.success(t('shareDone'))
      await refresh()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (studentId: string) => {
    setBusy(true)
    try {
      await filesFetch('/api/tutor-files/grants', jsonInit('DELETE', { itemType: target.itemType, itemId: target.id, studentId }))
      await refresh()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const toggleAllowUpload = async () => {
    const next = !allowUpload
    setAllowUpload(next)
    try {
      await filesFetch(`/api/tutor-files/folders/${target.id}`, jsonInit('PATCH', { allowStudentUpload: next }))
      onChanged()
    } catch (e) {
      setAllowUpload(!next)
      fail(e)
    }
  }

  return (
    <FilesModal
      size="wide"
      title={t('shareTitle', { name: target.name })}
      closeLabel={t('close')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={ui.btn} onClick={e => { e.stopPropagation(); onClose() }}>{t('close')}</button>
          <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={grant} disabled={busy || toGrant.length === 0}>
            {t('shareSubmit')}{toGrant.length > 0 ? ` · ${toGrant.length}` : ''}
          </button>
        </>
      }
    >
      {target.itemType === 'folder' && (
        <label className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.switchLabel}>{t('allowUpload')}</span>
            <span className={styles.switchHint}>{t('allowUploadHint')}</span>
          </span>
          <input type="checkbox" role="switch" className={styles.switch} checked={allowUpload} onChange={toggleAllowUpload} />
        </label>
      )}

      {students.length > 6 && (
        <div className={styles.search}>
          <FilesSearchIcon size={15} className={styles.searchIcon} />
          <input className={ui.input} value={query} onChange={e => setQuery(e.target.value)} placeholder={t('shareFind')} />
        </div>
      )}

      {!studentsLoading && students.length === 0 && <p className={styles.empty}>{t('shareNoStudents')}</p>}

      <ul className={styles.list}>
        {visible.map(s => {
          const has = granted.has(s.id)
          const checked = has || selected.has(s.id)
          return (
            <li key={s.id} className={styles.row}>
              <label className={`${styles.rowLabel} ${has ? styles.rowGranted : ''}`}>
                <input type="checkbox" className={styles.hiddenCheck} checked={checked} disabled={has || busy} onChange={() => toggle(s.id)} />
                <span className={`${styles.check} ${checked ? styles.checkOn : ''}`} aria-hidden="true">{checked && <FilesCheckIcon size={13} strokeWidth={3} />}</span>
                <Avatar person={s} />
                <span className={styles.rowName}>{s.name}</span>
                {has && <span className={styles.hasLabel}>{t('shareHas')}</span>}
              </label>
              {has && (
                <button type="button" className={styles.revoke} onClick={() => revoke(s.id)} disabled={busy}>{t('shareRevoke')}</button>
              )}
            </li>
          )
        })}
      </ul>

      {target.itemType === 'folder' && students.length > 0 && <p className={styles.note}>{t('shareInherited')}</p>}
    </FilesModal>
  )
}
