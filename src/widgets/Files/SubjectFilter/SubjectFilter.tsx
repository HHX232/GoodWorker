'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { FilesCheckIcon, FilesChevronDownIcon, FilesLectureIcon } from '../icons'
import { filesFetch } from '../lib'
import styles from './SubjectFilter.module.scss'

/**
 * "Предмет" next to the files search: the subjects of the user's own lectures
 * (their notes are filed into «Конспекты лекций/<Предмет>»). Hidden until
 * there is at least one. A custom listbox rather than a native <select> so the
 * long subject names wrap and the list matches the rest of the page.
 */
export function SubjectFilter({ value, onChange }: { value: string; onChange: (subject: string) => void }) {
  const t = useTranslations('files')
  const subjects = useQuery({
    queryKey: ['lecture-subjects'],
    queryFn: () => filesFetch<{ subjects: string[] }>('/api/lecture/subjects'),
    staleTime: 60_000,
    retry: false,
  })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const list = subjects.data?.subjects ?? []
  const options = [{ value: '', label: t('subjectAll') }, ...list.map(s => ({ value: s, label: s })), ...(value && !list.includes(value) ? [{ value, label: value }] : [])]
  const selected = Math.max(0, options.findIndex(o => o.value === value))

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  if (!list.length && !value) return null

  const toggle = () => { setActive(selected); setOpen(o => !o) }
  const pick = (v: string) => { onChange(v); setOpen(false) }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { toggle(); return }
      setActive(i => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault()
      pick(options[active].value)
    }
  }

  return (
    <div ref={rootRef} className={`${styles.wrap} ${value ? styles.on : ''}`} onKeyDown={onKeyDown}>
      <button type="button" className={styles.trigger} onClick={toggle} aria-label={t('subjectFilter')} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}>
        <FilesLectureIcon size={15} className={styles.icon} />
        <span className={styles.value}>{options[selected].label}</span>
        <FilesChevronDownIcon size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>
      {open && (
        <ul id={listId} className={styles.panel} role="listbox" aria-label={t('subjectFilter')}>
          {options.map((o, i) => (
            <li key={o.value || 'all'} data-i={i} role="option" aria-selected={i === selected}
              className={`${styles.option} ${i === selected ? styles.optionSelected : ''} ${i === active ? styles.optionActive : ''}`}
              onPointerEnter={() => setActive(i)} onClick={() => pick(o.value)}>
              <span className={styles.optionLabel}>{o.label}</span>
              {i === selected && <FilesCheckIcon size={15} className={styles.check} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
