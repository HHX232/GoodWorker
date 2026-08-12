/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useActions } from '@/features/hooks/store/useActions'
import { useTypedSelector } from '@/features/hooks/store/useTypedSelector'
import { PostBlockType } from '@/shared/types/Post/Post.type'
import { DateTimePickerField } from '@/shared/ui/Calendar/DateTimePickerField'
import { PostCanvas } from '@/widgets/PostBlocks/PostCanvas/PostCanvas'
import { PostMenu } from '@/widgets/PostBlocks/PostMenu/PostMenu'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { ArrowLeftIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './CreateHomeworkPage.module.scss'

interface StudentOption {
  id: string
  name: string
  initials: string
  avatarColor: string
  avatarTextColor: string
}

export default function CreateHomeworkPage() {
  const t = useTranslations('homework')
  const router = useRouter()
  const searchParams = useSearchParams()
  const preSelectedId = searchParams.get('studentId')

  const { resetPostConstructor, addPostBlock, reorderPostBlocks } = useActions()
  const blocks = useTypedSelector((s) => s.postSlice.blocks)
  const mainContentRef = useRef<HTMLDivElement>(null)

  const [title, setTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(preSelectedId ? [preSelectedId] : [])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [sendDate, setSendDate] = useState('')
  const [sendTime, setSendTime] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggingType, setDraggingType] = useState<PostBlockType | null>(null)

  useEffect(() => {
    resetPostConstructor()
    fetch('/api/teacher/students')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.students)) setStudents(d.students)
      })
      .catch(() => {})
  }, [])  // eslint-disable-line

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragStart = (e: DragStartEvent) => {
    const { origin, type } = e.active.data.current ?? {}
    if (origin === 'palette') setDraggingType(type)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setDraggingType(null)
    if (!over) return
    const { origin, type } = active.data.current ?? {}
    if (origin === 'palette' && (over.id === 'canvas-drop' || blocks.find((b) => b.id === over.id))) {
      addPostBlock(type)
    } else if (origin === 'canvas') {
      const aId = String(active.id), oId = String(over.id)
      if (aId !== oId) reorderPostBlocks({ activeId: aId, overId: oId })
    }
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error(t('errorTitle')); return }
    if (selectedIds.length === 0) { toast.error(t('errorStudents')); return }
    if (blocks.length === 0) { toast.error(t('errorBlocks')); return }

    setSaving(true)
    try {
      const sendAt = sendDate ? `${sendDate}T${sendTime || '09:00'}:00` : undefined
      const dueAt = dueDate ? `${dueDate}T${dueTime || '23:59'}:00` : undefined

      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: { blocks },
          sendAt,
          dueAt,
          studentIds: selectedIds,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Ошибка')
        return
      }

      toast.success(t('createdSuccess'))
      resetPostConstructor()
      router.back()
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <DragOverlay dropAnimation={null}>
        {draggingType && (
          <div style={{
            padding: '8px 14px',
            background: '#534AB7',
            color: '#fff',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(83,74,183,0.35)',
            opacity: 0.92,
            whiteSpace: 'nowrap',
          }}>
            + {draggingType}
          </div>
        )}
      </DragOverlay>
      <div className={`container ${styles.layout}`}>

        {/* Settings sidebar */}
        <aside className={styles.sidebar}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            <ArrowLeftIcon size={15} />
            {t('back')}
          </button>

          <h1 className={styles.pageTitle}>{t('createTitle')}</h1>

          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>{t('titleLabel')}</label>
            <input
              className={styles.input}
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Students */}
          <div className={styles.field}>
            <label className={styles.label}>
              {t('studentsLabel')}
              {selectedIds.length > 0 && (
                <span className={styles.selectedCount}>{selectedIds.length}</span>
              )}
            </label>
            {students.length === 0 ? (
              <div className={styles.emptyStudents}>{t('noStudentsAvailable')}</div>
            ) : (
              <div className={styles.studentList}>
                {students.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.studentChip} ${selectedIds.includes(s.id) ? styles.studentChipActive : ''}`}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <span
                      className={styles.studentAvatar}
                      style={{ background: s.avatarColor, color: s.avatarTextColor }}
                    >
                      {s.initials}
                    </span>
                    <span className={styles.studentName}>{s.name}</span>
                    {selectedIds.includes(s.id) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send at */}
          <div className={styles.field}>
            <label className={styles.label}>{t('sendAtLabel')}</label>
            <DateTimePickerField
              date={sendDate}
              time={sendTime}
              onDateChange={setSendDate}
              onTimeChange={setSendTime}
              minDate={today}
              placeholder={t('sendAtLabel')}
            />
          </div>

          {/* Due date */}
          <div className={styles.field}>
            <label className={styles.label}>{t('dueAtLabel')}</label>
            <DateTimePickerField
              date={dueDate}
              time={dueTime}
              onDateChange={setDueDate}
              onTimeChange={setDueTime}
              minDate={today}
              placeholder={t('dueAtLabel')}
            />
          </div>

          <button
            className={styles.createBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('creating') : t('createBtn')}
          </button>
        </aside>

        {/* Canvas */}
        <main className={styles.canvas} ref={mainContentRef}>
          <PostCanvas isDraggingFromPalette={!!draggingType} />
        </main>

        {/* Block palette */}
        <PostMenu mainContentRef={mainContentRef} />
      </div>
    </DndContext>
  )
}
