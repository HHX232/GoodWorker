/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { PostMiniTestViewer } from '@/widgets/PostBlocks/PostMiniTestViewer'
import { PostTestLinkViewer } from '@/widgets/PostBlocks/PostTestLinkViewer'
import { InfoAudioEditor } from '@/features/BlockEditors/InfoAudioEditor/InfoAudioEditor'
import { InfoMediaEditor } from '@/features/BlockEditors/InfoMediaEditor/InfoMediaEditor'
import { InfoTextEditor } from '@/features/BlockEditors/InfoTextEditor/InfoTextEditor'
import { PostBlockType, PostMiniTestPayload, PostTestLinkPayload, getPostTestLinks } from '@/shared/types/Post/Post.type'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './HomeworkViewerPage.module.scss'

// ── Reading progress bar ──────────────────────────────────────────────────────
function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const docH = document.documentElement.scrollHeight
      const viewH = document.documentElement.clientHeight
      const total = docH - viewH
      setProgress(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0)
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className={styles.readingProgressWrap}>
      <div className={styles.readingProgressFill} style={{ width: `${progress}%` }} />
    </div>
  )
}

// ── Post link block ───────────────────────────────────────────────────────────
function HomeworkPostLinkBlock({ block, done, onComplete }: {
  block: any
  done: boolean
  onComplete: () => void
}) {
  const payload = block.payload as { postId: string; postTitle: string; postSlug?: string | null }
  if (!payload?.postId) return null

  const postUrl = payload.postSlug
    ? `/post/${payload.postSlug}/${payload.postId}`
    : `/post/post/${payload.postId}`

  return (
    <div className={styles.postLinkBlock}>
      <div className={styles.postLinkIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className={styles.postLinkContent}>
        <p className={styles.postLinkTitle}>{payload.postTitle || 'Пост'}</p>
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.postLinkBtn}
          onClick={() => { if (!done) setTimeout(() => onComplete(), 500) }}
        >
          Читать пост →
        </a>
        {done && <span className={styles.postLinkDone}>Прочитано ✓</span>}
      </div>
    </div>
  )
}

// ── Road map link block ───────────────────────────────────────────────────────
function HomeworkRoadMapLinkBlock({ block }: { block: any }) {
  const payload = block.payload as { roadmapId: string; roadmapTitle: string }
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)

  useEffect(() => {
    if (!payload?.roadmapId) return
    fetch(`/api/roadmap/progress?roadmapId=${payload.roadmapId}`)
      .then(r => r.json())
      .then(d => setProgress(d))
      .catch(() => {})
  }, [payload?.roadmapId])

  if (!payload?.roadmapId) return null

  const rmUrl = `/workflows/${payload.roadmapId}`
  const percent = progress ? Math.round((progress.completed / Math.max(progress.total, 1)) * 100) : 0

  return (
    <div className={styles.postLinkBlock}>
      <div className={`${styles.postLinkIcon} ${styles.postLinkIconGreen}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      </div>
      <div className={styles.postLinkContent}>
        <p className={styles.postLinkTitle}>{payload.roadmapTitle || 'Курс'}</p>
        {progress !== null && (
          <div className={styles.rmProgress}>
            <div className={styles.rmProgressBar}>
              <div className={styles.rmProgressFill} style={{ width: `${percent}%` }} />
            </div>
            <span className={styles.rmProgressLabel}>{progress.completed} / {progress.total} шагов</span>
          </div>
        )}
        <a href={rmUrl} target="_blank" rel="noopener noreferrer" className={styles.postLinkBtn}>
          Открыть Road Map →
        </a>
      </div>
    </div>
  )
}

interface BlockProgress {
  blockIndex: number
  completedAt: string
}

interface Assignment {
  id: string
  status: string
  studentId: string
  startedAt: string | null
  submittedAt: string | null
  grade: number | null
  gradeComment: string | null
  gradePhotos: string[]
  reviewedAt: string | null
  homework: {
    id: string
    title: string
    dueAt: string | null
    sendAt: string | null
    content: { blocks: any[] }
    teacher: { id: string; name: string; avatarUrl: string | null }
  }
  student: { id: string; name: string; avatarUrl: string | null }
  blockProgress: BlockProgress[]
}

interface Props {
  assignment: Assignment
  viewerRole?: 'STUDENT' | 'TEACHER'
  isTeacherViewer?: boolean
}

function formatDue(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function isDueOverdue(iso: string) {
  return new Date(iso) < new Date()
}

// ── Teacher grade form in viewer ──────────────────────────────────────────────
function TeacherGradePanel({ assignment }: { assignment: Assignment }) {
  const t = useTranslations('homework')
  const [editing, setEditing] = useState(assignment.grade === null)
  const [grade, setGrade] = useState<number>(assignment.grade ?? 0)
  const [comment, setComment] = useState(assignment.gradeComment ?? '')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [localGrade, setLocalGrade] = useState(assignment.grade)
  const [localComment, setLocalComment] = useState(assignment.gradeComment ?? '')
  const [localPhotos, setLocalPhotos] = useState(assignment.gradePhotos)
  const [localReviewedAt, setLocalReviewedAt] = useState(assignment.reviewedAt)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (grade < 1 || grade > 10) { toast.error(t('gradeSelectError')); return }
    setSaving(true)
    try {
      const form = new FormData()
      form.append('grade', String(grade))
      form.append('comment', comment)
      form.append('clearPhotos', '1')
      for (const f of photoFiles) form.append('photos', f)

      const res = await fetch(`/api/homework/${assignment.id}/grade`, { method: 'PATCH', body: form })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Ошибка'); return }
      const data = await res.json()
      toast.success(t('gradeSaved'))
      setEditing(false)
      setLocalGrade(data.assignment.grade)
      setLocalComment(data.assignment.gradeComment ?? '')
      setLocalPhotos(data.assignment.gradePhotos ?? [])
      setLocalReviewedAt(data.assignment.reviewedAt ?? null)
      setPhotoFiles([])
    } catch { toast.error('Ошибка сети') }
    finally { setSaving(false) }
  }

  if (!editing && localGrade !== null) {
    return (
      <div className={styles.teacherGradeCard}>
        <div className={styles.teacherGradeHeader}>
          <span className={styles.teacherGradeTitle}>{t('reviewTitle')}</span>
          <button className={styles.teacherGradeEditBtn} onClick={() => { setGrade(localGrade ?? 0); setComment(localComment); setEditing(true) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t('gradeEdit')}
          </button>
        </div>
        <div className={styles.teacherGradeScoreRow}>
          <span className={styles.teacherGradeScore}>{localGrade}<span className={styles.teacherGradeScoreDenom}>/10</span></span>
          {localReviewedAt && (
            <span className={styles.teacherGradeDate}>
              {t('reviewedAt')} {new Date(localReviewedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
        {localComment && <p className={styles.teacherGradeComment}>{localComment}</p>}
        {localPhotos.length > 0 && (
          <div className={styles.teacherGradePhotos}>
            {localPhotos.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} className={styles.teacherGradePhotoThumb} alt="" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.teacherGradeCard}>
      <p className={styles.teacherGradeTitle}>{t('reviewTitle')}</p>
      <div className={styles.gradeButtons}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            className={`${styles.gradeBtn} ${grade === n ? styles.gradeBtnActive : ''} ${n <= 4 ? styles.gradeBtnLow : n <= 7 ? styles.gradeBtnMid : styles.gradeBtnHigh}`}
            onClick={() => setGrade(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        className={styles.gradeTextarea}
        placeholder={t('gradeComment')}
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
      />
      <div className={styles.gradePhotoUpload}>
        <button className={styles.gradePhotoBtn} onClick={() => fileRef.current?.click()} type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {t('gradePhotos')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className={styles.hiddenInput} onChange={e => setPhotoFiles(Array.from(e.target.files ?? []))} />
        {photoFiles.length > 0 && <span className={styles.photoCount}>{photoFiles.length} фото</span>}
      </div>
      <div className={styles.gradeFormActions}>
        {localGrade !== null && (
          <button className={styles.gradeCancelBtn} onClick={() => setEditing(false)}>{t('gradeCancel')}</button>
        )}
        <button className={styles.gradeSaveBtn} onClick={handleSave} disabled={saving || grade < 1}>
          {saving ? t('gradeSaving') : t('gradeSave')}
        </button>
      </div>
    </div>
  )
}

// ── Block completion wrapper ──────────────────────────────────────────────────
function HomeworkBlockWrapper({
  block,
  blockIndex,
  assignmentId,
  done,
  onToggle,
  canComplete,
}: {
  block: any
  blockIndex: number
  assignmentId: string
  done: boolean
  onToggle: (index: number, completed: boolean) => void
  canComplete: boolean
}) {
  const t = useTranslations('homework')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(
    async (completed: boolean) => {
      if (loading) return
      setLoading(true)
      try {
        const res = await fetch(`/api/homework/assignment/${assignmentId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockIndex, completed }),
        })
        if (!res.ok) {
          const d = await res.json()
          toast.error(d.error ?? 'Ошибка')
          return
        }
        onToggle(blockIndex, completed)
      } catch {
        toast.error('Ошибка сети')
      } finally {
        setLoading(false)
        setMenuOpen(false)
      }
    },
    [assignmentId, blockIndex, loading, onToggle]
  )

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // MEDIA/AUDIO are auto-marked on page open; TEST/MINI_TEST complete via their own flow
  const isAutoOnly = block.type === PostBlockType.MINI_TEST
    || block.type === PostBlockType.TEST_LINK
    || block.type === PostBlockType.MEDIA
    || block.type === PostBlockType.AUDIO

  const handleDoubleClick = () => {
    if (isAutoOnly || !canComplete || done) return
    toggle(true)
  }

  return (
    <div
      className={`${styles.blockWrap} ${done ? styles.blockDone : ''} ${loading ? styles.blockLoading : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      {done && (
        <div className={styles.doneBadge}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      <div className={styles.menuWrap} ref={menuRef}>
        <button
          className={styles.menuBtn}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          aria-label="Menu"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            {!done && canComplete && !isAutoOnly && (
              <button
                className={styles.menuItem}
                onClick={(e) => { e.stopPropagation(); toggle(true) }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('blockMarkDone')}
              </button>
            )}
            {done && !isAutoOnly && (
              <button
                className={styles.menuItem}
                onClick={(e) => { e.stopPropagation(); toggle(false) }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {t('blockUnmark')}
              </button>
            )}
            {isAutoOnly && !done && (
              <div className={styles.menuHint}>{t('miniTestHint')}</div>
            )}
          </div>
        )}
      </div>

      <div className={styles.blockContent} onClick={(e) => e.stopPropagation()}>
        {block.type === PostBlockType.TEXT && (
          <InfoTextEditor payload={block.payload} viewOnly />
        )}
        {block.type === PostBlockType.MEDIA && (
          <InfoMediaEditor payload={block.payload} viewOnly />
        )}
        {block.type === PostBlockType.AUDIO && (
          <InfoAudioEditor payload={block.payload} viewOnly />
        )}
        {block.type === PostBlockType.TEST_LINK && (() => {
          const tests = getPostTestLinks(block.payload as PostTestLinkPayload)
          if (!tests.length) return null
          return <PostTestLinkViewer tests={tests} theme="purple" />
        })()}
        {block.type === PostBlockType.MINI_TEST && (
          <HomeworkMiniTestBlock
            block={block}
            assignmentId={assignmentId}
            blockIndex={blockIndex}
            done={done}
            onComplete={() => toggle(true)}
          />
        )}
        {block.type === PostBlockType.POST_LINK && (
          <HomeworkPostLinkBlock
            block={block}
            done={done}
            onComplete={() => toggle(true)}
          />
        )}
        {block.type === PostBlockType.ROAD_MAP_LINK && (
          <HomeworkRoadMapLinkBlock block={block} />
        )}
      </div>
    </div>
  )
}

// ── Mini-test wrapper for homework ────────────────────────────────────────────
function HomeworkMiniTestBlock({
  block, assignmentId, blockIndex, done, onComplete,
}: {
  block: any
  assignmentId: string
  blockIndex: number
  done: boolean
  onComplete: () => void
}) {
  const t = useTranslations('homework')
  const payload = block.payload as PostMiniTestPayload

  if (!payload?.blocks?.length) return null

  return (
    <div>
      <PostMiniTestViewer
        payload={payload}
        postId={`hw-${assignmentId}-${blockIndex}`}
        blockId={block.id}
        onComplete={onComplete}
      />
      {!done && (
        <p className={styles.miniTestHint}>{t('miniTestHint')}</p>
      )}
    </div>
  )
}

// ── Teacher review card (for student view) ────────────────────────────────────
function TeacherReviewCard({ assignment }: { assignment: Assignment }) {
  if (assignment.grade === null || assignment.grade === undefined) return null

  const teacher = assignment.homework.teacher

  return (
    <div className={styles.reviewCard}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewTeacherRow}>
          {teacher.avatarUrl ? (
            <img src={teacher.avatarUrl} className={styles.reviewAvatar} alt="" />
          ) : (
            <div className={styles.reviewAvatarFallback}>
              {teacher.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className={styles.reviewTeacherName}>{teacher.name}</p>
            <p className={styles.reviewTeacherLabel}>Оценка учителя</p>
          </div>
        </div>
        <div className={styles.reviewScore}>
          <span className={styles.reviewScoreNum}>{assignment.grade}</span>
          <span className={styles.reviewScoreDenom}>/10</span>
        </div>
      </div>
      {assignment.gradeComment && (
        <p className={styles.reviewComment}>{assignment.gradeComment}</p>
      )}
      {assignment.gradePhotos?.length > 0 && (
        <div className={styles.reviewPhotos}>
          {assignment.gradePhotos.map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noopener noreferrer">
              <img src={src} className={styles.reviewPhotoThumb} alt="" />
            </a>
          ))}
        </div>
      )}
      {assignment.reviewedAt && (
        <p className={styles.reviewDate}>
          Проверено {new Date(assignment.reviewedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

// ── Main viewer ───────────────────────────────────────────────────────────────
export default function HomeworkViewerPage({ assignment, viewerRole = 'STUDENT', isTeacherViewer }: Props) {
  const t = useTranslations('homework')
  const isTeacher = isTeacherViewer ?? viewerRole === 'TEACHER'

  const blocks = assignment.homework.content?.blocks ?? []

  // Issue 2: exclude MEDIA and AUDIO from progress counting
  const countableIndices = useMemo(() => {
    return new Set(
      blocks
        .map((b: any, i: number) => ({ type: b.type, i }))
        .filter(({ type }: { type: string }) => type !== PostBlockType.MEDIA && type !== PostBlockType.AUDIO)
        .map(({ i }: { i: number }) => i)
    )
  }, [blocks])

  const [completedSet, setCompletedSet] = useState<Set<number>>(
    () => new Set(assignment.blockProgress.map((p) => p.blockIndex))
  )
  const [status, setStatus] = useState(assignment.status)

  const totalBlocks = countableIndices.size
  const completedCount = useMemo(
    () => [...completedSet].filter(i => countableIndices.has(i)).length,
    [completedSet, countableIndices]
  )

  const handleToggle = useCallback((blockIndex: number, completed: boolean) => {
    setCompletedSet((prev) => {
      const next = new Set(prev)
      if (completed) next.add(blockIndex)
      else next.delete(blockIndex)
      const countableDone = [...next].filter(i => countableIndices.has(i)).length
      if (countableDone === 0 && next.size === 0) setStatus('PENDING')
      else if (countableDone >= totalBlocks && totalBlocks > 0) setStatus('SUBMITTED')
      else setStatus('IN_PROGRESS')
      return next
    })
  }, [countableIndices, totalBlocks])

  // Issue 4: poll for TEST_LINK blocks that aren't done yet
  useEffect(() => {
    if (isTeacher) return
    const hasUnfinishedTestLinks = blocks.some(
      (b: any, i: number) => b.type === PostBlockType.TEST_LINK && !completedSet.has(i)
    )
    if (!hasUnfinishedTestLinks) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/homework/assignment/${assignment.id}/progress`)
        if (!res.ok) return
        const data = await res.json()
        const serverCompleted: number[] = data.completedIndices ?? []
        setCompletedSet(prev => {
          const next = new Set(prev)
          let changed = false
          for (const idx of serverCompleted) {
            if (!next.has(idx)) {
              next.add(idx)
              changed = true
            }
          }
          if (changed) {
            const countableDone = [...next].filter(i => countableIndices.has(i)).length
            if (countableDone >= totalBlocks && totalBlocks > 0) setStatus('SUBMITTED')
            else if (next.size > 0) setStatus('IN_PROGRESS')
          }
          return changed ? next : prev
        })
      } catch { /* ignore */ }
    }, 5000)

    return () => clearInterval(interval)
  }, [assignment.id, blocks, isTeacher, completedSet, countableIndices, totalBlocks])

  // Auto-mark MEDIA and AUDIO blocks as done when student opens the assignment
  useEffect(() => {
    if (isTeacher) return
    const mediaAudioIndices = blocks
      .map((b: any, i: number) => ({ type: b.type, i }))
      .filter(({ type }: { type: string }) => type === PostBlockType.MEDIA || type === PostBlockType.AUDIO)
      .map(({ i }: { i: number }) => i)
      .filter((i: number) => !completedSet.has(i))

    if (mediaAudioIndices.length === 0) return

    setCompletedSet(prev => {
      const next = new Set(prev)
      mediaAudioIndices.forEach((i: number) => next.add(i))
      return next
    })
    mediaAudioIndices.forEach((blockIndex: number) => {
      fetch(`/api/homework/assignment/${assignment.id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIndex, completed: true }),
      }).catch(() => {})
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const progressPercent = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0

  const statusLabels: Record<string, string> = {
    PENDING: t('statusPending'),
    IN_PROGRESS: t('statusInProgress'),
    SUBMITTED: t('statusSubmitted'),
    REVIEWED: t('statusReviewed'),
  }

  return (
    <>
      {/* Issue 3: progress bar always rendered, CSS positions it below header */}
      <ReadingProgressBar />
      <div className={`container ${styles.page}`}>
        {/* Header card */}
        <div className={styles.headerCard}>
          <div className={styles.studentRow}>
            {assignment.student.avatarUrl ? (
              <img src={assignment.student.avatarUrl} className={styles.avatar} alt="" />
            ) : (
              <div className={styles.avatarFallback}>
                {assignment.student.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className={styles.studentName}>{assignment.student.name}</span>
          </div>

          <h1 className={styles.hwTitle}>{assignment.homework.title}</h1>

          <div className={styles.metaRow}>
            <span className={`${styles.statusBadge} ${styles[`status_${status.toLowerCase()}`]}`}>
              {statusLabels[status] ?? status}
            </span>
            {assignment.homework.dueAt && (
              <span className={`${styles.dueTag} ${isDueOverdue(assignment.homework.dueAt) && status !== 'SUBMITTED' ? styles.dueOverdue : ''}`}>
                {t('dueLabel')}: {formatDue(assignment.homework.dueAt)}
              </span>
            )}
          </div>

          {/* Block progress bar — only show for students */}
          {!isTeacher && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
              <span className={styles.progressLabel}>
                {t('blocksProgress', { done: completedCount, total: totalBlocks })}
              </span>
            </div>
          )}

          {!isTeacher && status === 'SUBMITTED' && (
            <div className={styles.allDoneBanner}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('submitted')}
            </div>
          )}
        </div>

        {/* Issue 5 & 9: Teacher grade form appears BEFORE blocks */}
        {isTeacher && <TeacherGradePanel assignment={assignment} />}

        {/* Student view: teacher review card (grade display) */}
        {!isTeacher && <TeacherReviewCard assignment={assignment} />}

        {/* Blocks */}
        <div className={styles.blocks}>
          {blocks.map((block: any, i: number) => (
            <HomeworkBlockWrapper
              key={block.id ?? i}
              block={block}
              blockIndex={i}
              assignmentId={assignment.id}
              done={completedSet.has(i)}
              onToggle={handleToggle}
              canComplete={!isTeacher}
            />
          ))}
        </div>
      </div>
    </>
  )
}
