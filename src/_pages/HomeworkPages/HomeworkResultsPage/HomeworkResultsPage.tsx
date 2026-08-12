/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useActions } from '@/features/hooks/store/useActions'
import { useTypedSelector } from '@/features/hooks/store/useTypedSelector'
import { PostBlockType } from '@/shared/types/Post/Post.type'
import { PostCanvas } from '@/widgets/PostBlocks/PostCanvas/PostCanvas'
import { PostMenu } from '@/widgets/PostBlocks/PostMenu/PostMenu'
import { DateTimePickerField } from '@/shared/ui/Calendar/DateTimePickerField'
import { toast } from 'sonner'
import { ArrowLeftIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './HomeworkResultsPage.module.scss'

interface StudentResult {
  assignmentId: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  status: string
  completedBlocks: number
  totalBlocks: number
  startedAt: string | null
  submittedAt: string | null
  blockProgress: number[]
  grade: number | null
  gradeComment: string | null
  gradePhotos: string[]
  reviewedAt: string | null
}

interface ResultsData {
  homework: { id: string; title: string; totalBlocks: number }
  results: StudentResult[]
}

interface HomeworkData {
  id: string
  title: string
  content: { blocks: any[] }
  dueAt: string | null
  sendAt: string | null
  assignmentCount: number
}

interface Props {
  hwId: string
}

type Tab = 'editor' | 'results'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Не начато',
  IN_PROGRESS: 'В процессе',
  SUBMITTED: 'Сдано',
  REVIEWED: 'Проверено',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#94a3b8',
  IN_PROGRESS: '#f59e0b',
  SUBMITTED: '#10b981',
  REVIEWED: '#6366f1',
}

function formatDuration(startedAt: string | null, submittedAt: string | null): string {
  if (!startedAt || !submittedAt) return '—'
  const diffMs = new Date(submittedAt).getTime() - new Date(startedAt).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} мин`
  return `${Math.floor(mins / 60)}ч ${mins % 60}м`
}

// ── Grade panel ────────────────────────────────────────────────────────────
function GradePanel({
  result,
  onGraded,
}: {
  result: StudentResult
  onGraded: (updated: Partial<StudentResult>) => void
}) {
  const [editing, setEditing] = useState(result.grade === null)
  const [selectedGrade, setSelectedGrade] = useState<number>(result.grade ?? 0)
  const [comment, setComment] = useState(result.gradeComment ?? '')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (selectedGrade < 1 || selectedGrade > 10) {
      toast.error('Выберите оценку от 1 до 10')
      return
    }
    setSaving(true)
    try {
      const form = new FormData()
      form.append('grade', String(selectedGrade))
      form.append('comment', comment)
      form.append('clearPhotos', '1')
      for (const f of photoFiles) form.append('photos', f)

      const res = await fetch(`/api/homework/${result.assignmentId}/grade`, {
        method: 'PATCH',
        body: form,
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Ошибка')
        return
      }
      const data = await res.json()
      toast.success('Оценка сохранена')
      setEditing(false)
      onGraded({
        grade: data.assignment.grade,
        gradeComment: data.assignment.gradeComment,
        gradePhotos: data.assignment.gradePhotos,
        reviewedAt: data.assignment.reviewedAt,
        status: 'REVIEWED',
      })
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  if (!editing && result.grade !== null) {
    return (
      <div className={styles.gradeDisplay}>
        <div className={styles.gradeScoreRow}>
          <div className={styles.gradeScore}>
            {result.grade}<span>/10</span>
          </div>
          {result.reviewedAt && (
            <span className={styles.gradeDate}>
              {new Date(result.reviewedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          )}
          <button className={styles.gradeEditBtn} onClick={() => setEditing(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Изменить
          </button>
        </div>
        {result.gradeComment && (
          <p className={styles.gradeComment}>{result.gradeComment}</p>
        )}
        {result.gradePhotos?.length > 0 && (
          <div className={styles.gradePhotoRow}>
            {result.gradePhotos.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} className={styles.gradePhotoThumb} alt="" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.gradeForm}>
      <p className={styles.gradeFormLabel}>Оценка</p>
      <div className={styles.gradeButtons}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            className={`${styles.gradeBtn} ${selectedGrade === n ? styles.gradeBtnActive : ''} ${n <= 4 ? styles.gradeBtnLow : n <= 7 ? styles.gradeBtnMid : styles.gradeBtnHigh}`}
            onClick={() => setSelectedGrade(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        className={styles.gradeTextarea}
        placeholder="Комментарий (необязательно)"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
      />
      <div className={styles.gradePhotoUpload}>
        <button
          className={styles.gradePhotoBtn}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Прикрепить фото
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={e => setPhotoFiles(Array.from(e.target.files ?? []))}
        />
        {photoFiles.length > 0 && (
          <span className={styles.photoCount}>{photoFiles.length} фото выбрано</span>
        )}
      </div>
      <div className={styles.gradeFormActions}>
        {result.grade !== null && (
          <button className={styles.gradeCancelBtn} onClick={() => setEditing(false)}>
            Отмена
          </button>
        )}
        <button
          className={styles.gradeSaveBtn}
          onClick={handleSave}
          disabled={saving || selectedGrade < 1}
        >
          {saving ? 'Сохранение...' : 'Сохранить оценку'}
        </button>
      </div>
    </div>
  )
}

export function HomeworkResultsPage({ hwId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('editor')

  const { loadBlocks, addPostBlock, reorderPostBlocks, resetPostConstructor } = useActions()
  const blocks = useTypedSelector((s) => s.postSlice.blocks)
  const mainContentRef = useRef<HTMLDivElement>(null)
  const [hwData, setHwData] = useState<HomeworkData | null>(null)
  const [hwLoading, setHwLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [sendDate, setSendDate] = useState('')
  const [sendTime, setSendTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [draggingType, setDraggingType] = useState<PostBlockType | null>(null)

  const [resultsData, setResultsData] = useState<ResultsData | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    fetch(`/api/homework/hw/${hwId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { toast.error(d.error); return }
        const hw: HomeworkData = d.homework
        setHwData(hw)
        setTitle(hw.title)
        if (hw.dueAt) {
          const dt = new Date(hw.dueAt)
          setDueDate(dt.toISOString().split('T')[0])
          setDueTime(dt.toTimeString().slice(0, 5))
        }
        if (hw.sendAt) {
          const dt = new Date(hw.sendAt)
          setSendDate(dt.toISOString().split('T')[0])
          setSendTime(dt.toTimeString().slice(0, 5))
        }
        const storeBlocks = (hw.content?.blocks ?? []).map((b: any) => ({
          id: b.id ?? Math.random().toString(36).slice(2),
          type: b.type as PostBlockType,
          payload: b.payload ?? {},
        }))
        loadBlocks(storeBlocks)
      })
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setHwLoading(false))
    return () => { resetPostConstructor() }
  }, [hwId]) // eslint-disable-line

  useEffect(() => {
    if (tab !== 'results') return
    if (resultsData) return
    setResultsLoading(true)
    fetch(`/api/homework/${hwId}/results`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setResultsError(d.error)
        else setResultsData(d)
      })
      .catch(() => setResultsError('Ошибка загрузки'))
      .finally(() => setResultsLoading(false))
  }, [tab, hwId, resultsData])

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
    if (!title.trim()) { toast.error('Введите название'); return }
    setSaving(true)
    try {
      const dueAt = dueDate ? `${dueDate}T${dueTime || '23:59'}:00` : undefined
      const sendAt = sendDate ? `${sendDate}T${sendTime || '09:00'}:00` : undefined
      const res = await fetch(`/api/homework/hw/${hwId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: { blocks }, dueAt, sendAt }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Ошибка'); return }
      toast.success('Сохранено')
    } catch { toast.error('Ошибка сети') }
    finally { setSaving(false) }
  }

  const toggleExpand = useCallback((studentId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }, [])

  const handleGraded = useCallback((studentId: string, updated: Partial<StudentResult>) => {
    setResultsData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        results: prev.results.map(r =>
          r.studentId === studentId ? { ...r, ...updated } : r
        ),
      }
    })
  }, [])

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
      <div className={`container ${styles.page}`}>
        <div className={styles.pageHeader}>
          <button className={styles.backBtn} onClick={() => router.back()}>
            <ArrowLeftIcon size={15} /> Назад
          </button>
          <div className={styles.tabRow}>
            <button
              className={`${styles.tabBtn} ${tab === 'editor' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('editor')}
            >
              Редактор
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'results' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('results')}
            >
              Результаты
              {resultsData && (
                <span className={styles.tabCount}>{resultsData.results.length}</span>
              )}
            </button>
          </div>
        </div>

        {tab === 'editor' && (
          hwLoading ? (
            <div className={styles.loadingState}>Загрузка...</div>
          ) : (
            <div className={styles.editorLayout}>
              <aside className={styles.editorSidebar}>
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>Название</label>
                  <input
                    className={styles.editorInput}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Название домашнего задания"
                  />
                </div>
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>Дата отправки</label>
                  <DateTimePickerField date={sendDate} time={sendTime} minDate={today} onDateChange={setSendDate} onTimeChange={setSendTime} />
                </div>
                <div className={styles.editorField}>
                  <label className={styles.editorLabel}>Дата сдачи</label>
                  <DateTimePickerField date={dueDate} time={dueTime} minDate={today} onDateChange={setDueDate} onTimeChange={setDueTime} />
                </div>
                {hwData && (
                  <div className={styles.editorInfo}>
                    <span>{hwData.assignmentCount} ученик(ов)</span>
                  </div>
                )}
                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </aside>
              <main className={styles.editorMain} ref={mainContentRef}>
                <PostCanvas isDraggingFromPalette={!!draggingType} />
              </main>
              <PostMenu mainContentRef={mainContentRef} />
            </div>
          )
        )}

        {tab === 'results' && (
          <div className={styles.resultsSection}>
            {resultsLoading && <div className={styles.loadingState}>Загрузка результатов...</div>}
            {resultsError && <div className={styles.errorState}>{resultsError}</div>}
            {resultsData && (
              <>
                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{resultsData.results.length}</span>
                    <span className={styles.statLabel}>Всего учеников</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>
                      {resultsData.results.filter(r => r.status === 'SUBMITTED' || r.status === 'REVIEWED').length}
                    </span>
                    <span className={styles.statLabel}>Сдали</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>
                      {resultsData.results.filter(r => r.status === 'IN_PROGRESS').length}
                    </span>
                    <span className={styles.statLabel}>В процессе</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>
                      {resultsData.results.filter(r => r.grade !== null).length}/{resultsData.results.length}
                    </span>
                    <span className={styles.statLabel}>Проверено</span>
                  </div>
                </div>

                <div className={styles.studentList}>
                  {resultsData.results.map(r => {
                    const pct = resultsData.homework.totalBlocks > 0
                      ? Math.round((r.completedBlocks / resultsData.homework.totalBlocks) * 100)
                      : 0
                    const isExpanded = expanded.has(r.studentId)
                    return (
                      <div
                        key={r.studentId}
                        className={`${styles.studentCard} ${r.grade !== null ? styles.studentCardReviewed : ''}`}
                      >
                        <div className={styles.studentCardHead} onClick={() => toggleExpand(r.studentId)}>
                          <div className={styles.studentAvatar}>
                            {r.studentAvatar
                              ? <img src={r.studentAvatar} alt="" />
                              : <span>{r.studentName.slice(0, 2).toUpperCase()}</span>
                            }
                          </div>
                          <div className={styles.studentInfo}>
                            <p className={styles.studentName}>{r.studentName}</p>
                            <div className={styles.progressRow}>
                              <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={styles.progressLabel}>
                                {r.completedBlocks}/{resultsData.homework.totalBlocks}
                              </span>
                            </div>
                          </div>
                          <div className={styles.studentMeta}>
                            <span
                              className={styles.statusBadge}
                              style={{ background: STATUS_COLORS[r.status] + '22', color: STATUS_COLORS[r.status] }}
                            >
                              {STATUS_LABELS[r.status] ?? r.status}
                            </span>
                            {r.grade !== null && (
                              <span className={styles.gradeBadge}>{r.grade}/10</span>
                            )}
                            <span className={styles.duration}>{formatDuration(r.startedAt, r.submittedAt)}</span>
                          </div>
                          <svg
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>

                        {isExpanded && (
                          <div className={styles.expandedContent}>
                            <div className={styles.gradeSeparator}>
                              <span>Оценка учителя</span>
                            </div>
                            <GradePanel
                              result={r}
                              onGraded={(updated) => handleGraded(r.studentId, updated)}
                            />
                            {resultsData.homework.totalBlocks > 0 && (
                              <>
                                <div className={styles.gradeSeparator}>
                                  <span>Блоки</span>
                                </div>
                                <div className={styles.blockGrid}>
                                  {Array.from({ length: resultsData.homework.totalBlocks }, (_, i) => (
                                    <div
                                      key={i}
                                      className={`${styles.blockDot} ${r.blockProgress.includes(i) ? styles.blockDotDone : ''}`}
                                      title={`Блок ${i + 1}: ${r.blockProgress.includes(i) ? 'выполнен' : 'не выполнен'}`}
                                    >
                                      {i + 1}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DndContext>
  )
}
