'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import coordinatePlane from './templates/system/coordinate-plane.json'
import numberLine from './templates/system/number-line.json'
import unitCircle from './templates/system/unit-circle.json'
import triangle from './templates/system/triangle.json'
import axes3d from './templates/system/axes-3d.json'
import table from './templates/system/table.json'
import vennDiagram from './templates/system/venn-diagram.json'
import givenSolutionAnswer from './templates/system/given-solution-answer.json'
import styles from './TemplatesModal.module.scss'

export interface SystemTemplate {
  slug: string
  elements: ExcalidrawElement[]
}

// Names are translated at render time (whiteboard.systemTemplates.<slug>),
// not stored here — see the render loop below.
export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { slug: 'coordinate-plane', elements: coordinatePlane as unknown as ExcalidrawElement[] },
  { slug: 'number-line', elements: numberLine as unknown as ExcalidrawElement[] },
  { slug: 'unit-circle', elements: unitCircle as unknown as ExcalidrawElement[] },
  { slug: 'triangle', elements: triangle as unknown as ExcalidrawElement[] },
  { slug: 'axes-3d', elements: axes3d as unknown as ExcalidrawElement[] },
  { slug: 'table', elements: table as unknown as ExcalidrawElement[] },
  { slug: 'venn-diagram', elements: vennDiagram as unknown as ExcalidrawElement[] },
  { slug: 'given-solution-answer', elements: givenSolutionAnswer as unknown as ExcalidrawElement[] },
]

// The only system template with actual Russian text baked into its
// elements (the other 7 use language-neutral math notation — axis labels,
// degree marks, Greek letters). Swapping just these three known strings by
// exact match is far cheaper than maintaining 4 full JSON variants per
// locale; the element's stored width stays whatever it was for the Russian
// original, a minor cosmetic gap for a short single-line label rather than
// worth over-engineering here.
const GIVEN_SOLUTION_ANSWER_TEXT: Record<string, 'given' | 'solution' | 'answer'> = {
  'Дано:': 'given',
  'Решение:': 'solution',
  'Ответ:': 'answer',
}

function localizeTemplateElements(slug: string, elements: ExcalidrawElement[], t: ReturnType<typeof useTranslations>): ExcalidrawElement[] {
  if (slug !== 'given-solution-answer') return elements
  return elements.map(el => {
    if (el.type !== 'text') return el
    const key = GIVEN_SOLUTION_ANSWER_TEXT[el.text]
    if (!key) return el
    return { ...el, text: t(key), originalText: t(key) } as ExcalidrawElement
  })
}

interface OwnTemplate {
  id: string
  name: string
  snapshot: ExcalidrawElement[]
  createdAt: string
}

interface Props {
  hasContent: boolean
  onApply: (elements: ExcalidrawElement[]) => void
  onStartCreate: (name: string) => void
  onClose: () => void
}

type Tab = 'system' | 'own'

export function TemplatesModal({ hasContent, onApply, onStartCreate, onClose }: Props) {
  const t = useTranslations('whiteboard.templates')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('system')
  const [ownTemplates, setOwnTemplates] = useState<OwnTemplate[] | null>(null)
  const [loadingOwn, setLoadingOwn] = useState(false)
  const [ownError, setOwnError] = useState<string | null>(null)
  const [confirmApply, setConfirmApply] = useState<ExcalidrawElement[] | null>(null)
  const [creatingName, setCreatingName] = useState<string | null>(null)

  const defaultTemplateName = useCallback(
    () => t('defaultName', { date: new Date().toLocaleDateString(locale) }),
    [t, locale],
  )

  const loadOwn = useCallback(async () => {
    setLoadingOwn(true)
    setOwnError(null)
    try {
      const res = await fetch('/api/whiteboard/templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setOwnTemplates(data.templates)
    } catch (err) {
      console.error('[TemplatesModal] load own failed:', err)
      setOwnError(t('teacherOnly'))
      setOwnTemplates([])
    } finally {
      setLoadingOwn(false)
    }
  }, [t])

  useEffect(() => {
    if (tab === 'own' && ownTemplates === null) loadOwn()
  }, [tab, ownTemplates, loadOwn])

  const requestApply = useCallback((elements: ExcalidrawElement[]) => {
    if (hasContent) setConfirmApply(elements)
    else onApply(elements)
  }, [hasContent, onApply])

  const handleDeleteOwn = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(t('confirmDelete'))) return
    try {
      const res = await fetch(`/api/whiteboard/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setOwnTemplates(prev => prev?.filter(tpl => tpl.id !== id) ?? null)
    } catch (err) {
      console.error('[TemplatesModal] delete failed:', err)
      toast.error(t('deleteFailed'))
    }
  }, [t])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${tab === 'system' ? styles.tabActive : ''}`} onClick={() => setTab('system')}>
              {t('systemTab')}
            </button>
            <button type="button" className={`${styles.tab} ${tab === 'own' ? styles.tabActive : ''}`} onClick={() => setTab('own')}>
              {t('ownTab')}
            </button>
          </div>
          <button type="button" className={styles.close} onClick={onClose} title={t('close')}>✕</button>
        </div>

        {tab === 'system' && (
          <div className={styles.grid}>
            {SYSTEM_TEMPLATES.map(tpl => (
              <button key={tpl.slug} type="button" className={styles.card} onClick={() => requestApply(localizeTemplateElements(tpl.slug, tpl.elements, t))}>
                <span className={styles.cardName}>{t(`systemTemplates.${tpl.slug}`)}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'own' && (
          <div className={styles.grid}>
            <button type="button" className={styles.createCard} onClick={() => setCreatingName(defaultTemplateName())}>
              {t('createCard')}
            </button>
            {loadingOwn && <div className={styles.hint}>{t('loading')}</div>}
            {!loadingOwn && ownError && <div className={styles.hint}>{ownError}</div>}
            {!loadingOwn && !ownError && ownTemplates?.length === 0 && (
              <div className={styles.hint}>{t('empty')}</div>
            )}
            {!loadingOwn && ownTemplates?.map(tpl => (
              <button key={tpl.id} type="button" className={styles.card} onClick={() => requestApply(tpl.snapshot)}>
                <span className={styles.cardName}>{tpl.name}</span>
                <span className={styles.trash} onClick={e => handleDeleteOwn(tpl.id, e)} title={t('deleteTitle')}>🗑</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmApply && (
        <div className={styles.confirmBackdrop} onClick={e => e.stopPropagation()}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmText}>{t('confirmReplace')}</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancel} onClick={() => setConfirmApply(null)}>{t('cancel')}</button>
              <button type="button" className={styles.confirm} onClick={() => { onApply(confirmApply); setConfirmApply(null) }}>{t('replace')}</button>
            </div>
          </div>
        </div>
      )}

      {creatingName !== null && (
        <div className={styles.confirmBackdrop} onClick={e => e.stopPropagation()}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmText}>{t('nameLabel')}</div>
            <input
              className={styles.nameInput}
              value={creatingName}
              onChange={e => setCreatingName(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              maxLength={120}
              autoFocus
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancel} onClick={() => setCreatingName(null)}>{t('cancel')}</button>
              <button
                type="button"
                className={styles.confirm}
                onClick={() => onStartCreate(creatingName.trim() || defaultTemplateName())}
              >
                {t('start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
