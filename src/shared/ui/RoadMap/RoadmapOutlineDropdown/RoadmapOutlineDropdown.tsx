'use client'

import React, { useEffect, useRef, useState } from 'react'
import { OutlineStep } from '@/shared/lib/roadmapOutline'
import { useTranslations } from 'next-intl'
import styles from './RoadmapOutlineDropdown.module.scss'

interface Props {
  roadmapId: string
}

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6L5 9L10 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const NodeTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'INFO_TEXT':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
        </svg>
      )
    case 'INFO_MEDIA':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'INFO_AUDIO':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      )
    case 'DOWNLOAD_FILE_LINK':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
        </svg>
      )
    case 'POST_LINK':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
    case 'ACTIVE_TEST':
    case 'TEST_LINK':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'DIVIDER':
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      )
    default:
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
  }
}

export const RoadmapOutlineDropdown = ({ roadmapId }: Props) => {
  const t = useTranslations('roadmapOutline')
  const [open, setOpen] = useState(false)
  const [steps, setSteps] = useState<OutlineStep[] | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)

    Promise.all([
      fetch(`/api/roadmap/${roadmapId}/outline`).then((r) => r.json()),
      fetch(`/api/roadmap/${roadmapId}/progress`).then((r) => r.json()),
    ])
      .then(([outlineData, progressData]) => {
        setSteps(outlineData.steps ?? [])
        setCompletedIds(new Set<string>(progressData.completedSteps ?? []))
      })
      .catch(() => setSteps([]))
      .finally(() => setLoading(false))
  }, [open, roadmapId])

  const totalNodes = steps?.filter((s) => s.depth > 0 || (s.depth === 0 && s.type !== 'DIVIDER')).length ?? 0
  const completedCount = steps?.filter((s) => completedIds.has(s.nodeId)).length ?? 0

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.trigger_open : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.trigger_label}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          {t('title')}
        </span>
        {steps !== null && totalNodes > 0 && (
          <span className={styles.progress_pill}>
            {completedCount}/{totalNodes}
          </span>
        )}
        <svg
          className={`${styles.chevron} ${open ? styles.chevron_open : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loading}>
              <span className={styles.skeleton} />
              <span className={styles.skeleton} />
              <span className={styles.skeleton} />
            </div>
          ) : !steps || steps.length === 0 ? (
            <p className={styles.empty}>{t('noSteps')}</p>
          ) : (() => {
              // Group: top-level items + their sub-items into sections for dashed line
              type Group = { header: (typeof steps)[0]; children: (typeof steps)[0][] }
              const groups: Group[] = []
              const orphans: (typeof steps)[0][] = []
              let cur: Group | null = null
              for (const s of steps) {
                if (s.type === 'DIVIDER' && s.depth === 0) { cur = { header: s, children: [] }; groups.push(cur) }
                else if (cur) cur.children.push(s)
                else orphans.push(s)
              }

              const renderItem = (step: (typeof steps)[0], sub = false) => {
                const done = completedIds.has(step.nodeId)
                const isSection = step.type === 'DIVIDER' && step.depth === 0
                return (
                  <li
                    key={step.nodeId}
                    className={`${styles.item} ${sub ? styles.item_sub : styles.item_top} ${done ? styles.item_done : ''} ${isSection ? styles.item_section : ''}`}
                  >
                    <span className={styles.number}>{step.number}</span>
                    <span className={styles.icon}><NodeTypeIcon type={step.type} /></span>
                    <span className={styles.title}>{step.title}</span>
                    {done && <span className={styles.check}><CheckIcon /></span>}
                  </li>
                )
              }

              return (
                <ul className={styles.list}>
                  {orphans.map(s => renderItem(s))}
                  {groups.map(g => (
                    <React.Fragment key={g.header.nodeId}>
                      {renderItem(g.header)}
                      {g.children.length > 0 && (
                        <div className={styles.sub_group}>
                          <ul className={styles.list}>
                            {g.children.map(s => renderItem(s, true))}
                          </ul>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </ul>
              )
            })()
          }
        </div>
      )}
    </div>
  )
}
