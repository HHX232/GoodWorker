'use client'

import React, { useCallback, useEffect, useState } from 'react'
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
  name: string
  elements: ExcalidrawElement[]
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { slug: 'coordinate-plane', name: 'Координатная плоскость', elements: coordinatePlane as unknown as ExcalidrawElement[] },
  { slug: 'number-line', name: 'Числовая прямая', elements: numberLine as unknown as ExcalidrawElement[] },
  { slug: 'unit-circle', name: 'Единичная окружность', elements: unitCircle as unknown as ExcalidrawElement[] },
  { slug: 'triangle', name: 'Треугольник с углами', elements: triangle as unknown as ExcalidrawElement[] },
  { slug: 'axes-3d', name: 'Оси XYZ (3D)', elements: axes3d as unknown as ExcalidrawElement[] },
  { slug: 'table', name: 'Таблица', elements: table as unknown as ExcalidrawElement[] },
  { slug: 'venn-diagram', name: 'Диаграмма Венна', elements: vennDiagram as unknown as ExcalidrawElement[] },
  { slug: 'given-solution-answer', name: 'Дано / Решение / Ответ', elements: givenSolutionAnswer as unknown as ExcalidrawElement[] },
]

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

function defaultTemplateName() {
  return `Шаблон от ${new Date().toLocaleDateString('ru-RU')}`
}

export function TemplatesModal({ hasContent, onApply, onStartCreate, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('system')
  const [ownTemplates, setOwnTemplates] = useState<OwnTemplate[] | null>(null)
  const [loadingOwn, setLoadingOwn] = useState(false)
  const [ownError, setOwnError] = useState<string | null>(null)
  const [confirmApply, setConfirmApply] = useState<ExcalidrawElement[] | null>(null)
  const [creatingName, setCreatingName] = useState<string | null>(null)

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
      setOwnError('Доступно только преподавателю')
      setOwnTemplates([])
    } finally {
      setLoadingOwn(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'own' && ownTemplates === null) loadOwn()
  }, [tab, ownTemplates, loadOwn])

  const requestApply = useCallback((elements: ExcalidrawElement[]) => {
    if (hasContent) setConfirmApply(elements)
    else onApply(elements)
  }, [hasContent, onApply])

  const handleDeleteOwn = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Удалить этот шаблон?')) return
    try {
      const res = await fetch(`/api/whiteboard/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setOwnTemplates(prev => prev?.filter(t => t.id !== id) ?? null)
    } catch (err) {
      console.error('[TemplatesModal] delete failed:', err)
      toast.error('Не удалось удалить шаблон')
    }
  }, [])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${tab === 'system' ? styles.tabActive : ''}`} onClick={() => setTab('system')}>
              Системные
            </button>
            <button type="button" className={`${styles.tab} ${tab === 'own' ? styles.tabActive : ''}`} onClick={() => setTab('own')}>
              Мои шаблоны
            </button>
          </div>
          <button type="button" className={styles.close} onClick={onClose} title="Закрыть">✕</button>
        </div>

        {tab === 'system' && (
          <div className={styles.grid}>
            {SYSTEM_TEMPLATES.map(t => (
              <button key={t.slug} type="button" className={styles.card} onClick={() => requestApply(t.elements)}>
                <span className={styles.cardName}>{t.name}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'own' && (
          <div className={styles.grid}>
            <button type="button" className={styles.createCard} onClick={() => setCreatingName(defaultTemplateName())}>
              + Создать шаблон
            </button>
            {loadingOwn && <div className={styles.hint}>Загрузка…</div>}
            {!loadingOwn && ownError && <div className={styles.hint}>{ownError}</div>}
            {!loadingOwn && !ownError && ownTemplates?.length === 0 && (
              <div className={styles.hint}>Пока нет сохранённых шаблонов</div>
            )}
            {!loadingOwn && ownTemplates?.map(t => (
              <button key={t.id} type="button" className={styles.card} onClick={() => requestApply(t.snapshot)}>
                <span className={styles.cardName}>{t.name}</span>
                <span className={styles.trash} onClick={e => handleDeleteOwn(t.id, e)} title="Удалить шаблон">🗑</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmApply && (
        <div className={styles.confirmBackdrop} onClick={e => e.stopPropagation()}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmText}>Заменить текущее содержимое доски шаблоном? Это действие нельзя отменить.</div>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancel} onClick={() => setConfirmApply(null)}>Отмена</button>
              <button type="button" className={styles.confirm} onClick={() => { onApply(confirmApply); setConfirmApply(null) }}>Заменить</button>
            </div>
          </div>
        </div>
      )}

      {creatingName !== null && (
        <div className={styles.confirmBackdrop} onClick={e => e.stopPropagation()}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmText}>Название шаблона</div>
            <input
              className={styles.nameInput}
              value={creatingName}
              onChange={e => setCreatingName(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              maxLength={120}
              autoFocus
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.cancel} onClick={() => setCreatingName(null)}>Отмена</button>
              <button
                type="button"
                className={styles.confirm}
                onClick={() => onStartCreate(creatingName.trim() || defaultTemplateName())}
              >
                Начать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
