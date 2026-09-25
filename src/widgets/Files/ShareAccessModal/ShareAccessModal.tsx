'use client'

import type { FilesPerson } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useLocale } from 'next-intl'
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
  submissionDeadline?: string | null
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
  const locale = useLocale()
  // Idea 5: optional access window for this grant; idea 2: submissions deadline.
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [openFrom, setOpenFrom] = useState('')
  const [closeAfter, setCloseAfter] = useState('')
  const [deadline, setDeadline] = useState(toLocalInput(target.submissionDeadline ?? null))

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
      await filesFetch('/api/tutor-files/grants', jsonInit('POST', {
        itemType: target.itemType,
        itemId: target.id,
        studentIds: toGrant,
        ...(openFrom ? { availableFrom: new Date(openFrom).toISOString() } : {}),
        ...(closeAfter ? { availableUntil: new Date(closeAfter).toISOString() } : {}),
      }))
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

  const saveDeadline = async (value: string) => {
    setDeadline(value)
    try {
      await filesFetch(`/api/tutor-files/folders/${target.id}`, jsonInit('PATCH', { submissionDeadline: value ? new Date(value).toISOString() : null }))
      onChanged()
    } catch (e) {
      fail(e)
    }
  }

  const windowLabel = (p: FilesPerson) => {
    const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const parts: string[] = []
    if (p.availableFrom && new Date(p.availableFrom) > new Date()) parts.push(t('scheduleFromShort', { date: fmt(p.availableFrom) }))
    if (p.availableUntil) parts.push(t('scheduleUntilShort', { date: fmt(p.availableUntil) }))
    return parts.join(' · ')
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

      {target.itemType === 'folder' && allowUpload && (
        <label className={styles.inlineField}>
          <span className={styles.inlineLabel}>{t('deadline')}</span>
          <input type="datetime-local" className={styles.dateInput} value={deadline} onChange={e => saveDeadline(e.target.value)} />
          {deadline && <button type="button" className={styles.clear} onClick={() => saveDeadline('')}>{t('clear')}</button>}
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
                {has && <span className={styles.hasLabel}>{windowLabel(grantsData!.students.find(g => g.id === s.id)!) || t('shareHas')}</span>}
              </label>
              {has && (
                <button type="button" className={styles.revoke} onClick={() => revoke(s.id)} disabled={busy}>{t('shareRevoke')}</button>
              )}
            </li>
          )
        })}
      </ul>

      <div className={styles.schedule}>
        <button type="button" className={styles.scheduleToggle} onClick={() => setScheduleOpen(v => !v)} aria-expanded={scheduleOpen}>
          {t('schedule')}{(openFrom || closeAfter) && !scheduleOpen ? ' ·' : ''}
        </button>
        {scheduleOpen && (
          <div className={styles.scheduleFields}>
            <label className={styles.inlineField}>
              <span className={styles.inlineLabel}>{t('scheduleFrom')}</span>
              <input type="datetime-local" className={styles.dateInput} value={openFrom} onChange={e => setOpenFrom(e.target.value)} />
            </label>
            <label className={styles.inlineField}>
              <span className={styles.inlineLabel}>{t('scheduleUntil')}</span>
              <input type="datetime-local" className={styles.dateInput} value={closeAfter} onChange={e => setCloseAfter(e.target.value)} />
            </label>
            <p className={styles.note}>{t('scheduleHint')}</p>
          </div>
        )}
      </div>

      {target.itemType === 'folder' && students.length > 0 && <p className={styles.note}>{t('shareInherited')}</p>}
    </FilesModal>
  )
}

/** ISO → value for <input type="datetime-local"> in the viewer's local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
