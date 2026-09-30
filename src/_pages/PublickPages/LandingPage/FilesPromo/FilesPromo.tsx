'use client'

import type { FilesPerson, LibraryFile, LibraryFolder } from '@/shared/types/TutorFiles/tutorFiles.types'
import { FileCard } from '@/widgets/Files/Cards/FileCard'
import { FolderCard } from '@/widgets/Files/Cards/FolderCard'
import { CheckIcon, EyeIcon, FolderOpenIcon, HardDriveIcon, UsersIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { JetBrains_Mono } from 'next/font/google'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import s from '../LandingPage.module.scss'
import f from './FilesPromo.module.scss'

// Landing info-block for /files (the tutor's storage). The right side is the
// real /files UI — the same FolderCard / FileCard with their covers — on mock
// data: click a folder to see its files. While the block is on screen, access
// to the first folder is handed out student by student (the share popover),
// then the students open it one by one (green dots + a toast), and it loops.

const HREF = '/files'
const TICK_MS = 750
const CYCLE = 17 // ticks: 0–1 popover, 2–5 grants, 6 done, 8–10 opens, … hold
const OPENED = 3 // students who "open" the folder in the demo

type Kind = 'pdf' | 'docx' | 'pptx' | 'audio' | 'lecture'
interface MockFile { name: string; kind: Kind; size: number; student?: boolean; late?: boolean; review?: 'ACCEPTED' | 'REVISION'; grade?: string }
interface MockFolder { name: string; cover: string; deadline?: boolean; files: MockFile[] }

const MIME: Record<Kind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  lecture: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  audio: 'audio/mp4',
}

// Fixed demo dates (module level — render stays pure): access until the next 31 May, a deadline next week.
const NOW = Date.now()
const UNTIL = new Date(new Date(NOW).getFullYear() + (new Date(NOW).getMonth() > 4 ? 1 : 0), 4, 31, 23, 59).toISOString()
const DEADLINE = new Date(NOW + 6 * 86400000).toISOString()
const CREATED = new Date(NOW - 3 * 86400000).toISOString()
const noop = () => {}
// Same face the /files page gives its cards (app/files/page.tsx).
const mono = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['400', '500'], variable: '--files-mono', display: 'swap' })

function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, inView]
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

export function FilesPromo() {
  const t = useTranslations('filesPromo')
  const folders = t.raw('folders') as MockFolder[]
  const names = t.raw('students') as string[]
  const [ref, inView] = useInView<HTMLElement>()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!inView || reduced) return
    const id = setInterval(() => setTick(n => (n + 1) % CYCLE), TICK_MS)
    return () => clearInterval(id)
  }, [inView, reduced])

  // Where the demo is: how many students got access, how many opened the folder.
  const granted = reduced ? names.length : Math.max(0, Math.min(names.length, tick - 1))
  const openedCount = reduced ? OPENED : Math.max(0, Math.min(OPENED, tick - 7))
  const popover = !reduced && tick <= 6
  const toast = !reduced && tick >= 8 && tick <= 12 ? names[openedCount - 1] : null

  const people: FilesPerson[] = names.slice(0, granted).map((name, i) => ({
    id: `s${i}`, name, avatarUrl: null, availableUntil: UNTIL, firstOpenedAt: i < openedCount ? CREATED : null,
  }))
  const everyone: FilesPerson[] = names.map((name, i) => ({ id: `s${i}`, name, avatarUrl: null }))

  const libFolders: LibraryFolder[] = folders.map((fo, i) => ({
    id: `demo-${i}`, name: fo.name, parentId: null, allowStudentUpload: !!fo.deadline, restrictedToStudentId: null,
    cover: fo.cover, submissionDeadline: fo.deadline ? DEADLINE : null, itemCount: fo.files.length,
    sharedWith: i === 0 ? people : i === 1 ? everyone : i === 2 ? everyone.slice(0, 2) : [], updatedAt: CREATED,
  }))
  const folder = folders[open]
  const libFiles: LibraryFile[] = folder.files.map((file, i) => ({
    id: `demo-${open}-${i}`, name: file.name, folderId: `demo-${open}`, url: '', sizeBytes: file.size, mimeType: MIME[file.kind],
    uploadedByRole: file.student ? 'STUDENT' : 'TEACHER', uploadedById: 'demo', createdAt: CREATED,
    sharedWith: file.student ? [] : libFolders[open].sharedWith, late: !!file.late,
    review: file.review ? { status: file.review, grade: file.grade ?? null, comment: null, annotations: [], reviewedAt: CREATED } : null,
    derivedFromId: null, lectureNoteId: file.kind === 'lecture' ? 'demo' : null,
  }))

  return (
    <section ref={ref} className={s.section_grid} aria-labelledby="files-promo-title">
      <div>
        <div className={s.eyebrow}>{t('eyebrow')}</div>
        <h2 id="files-promo-title" className={s.section_h2}>{t('h2')} <span className={f.red}>{t('h2_hl')}</span></h2>
        <p className={s.section_text}>{t('lead')}</p>
        <ul className={f.points}>
          {(t.raw('points') as string[]).map(p => <li key={p}><CheckIcon size={15} /> {p}</li>)}
        </ul>
        <div className={f.ctaRow}>
          <Link href={HREF} className={s.btn_red}><FolderOpenIcon size={17} />{t('cta')}</Link>
          <span className={f.vipNote}>{t('vip')}</span>
        </div>
      </div>

      <div className={`${f.window} ${mono.variable}`}>
        <div className={f.winHead}>
          <strong>{t('library')}</strong>
          <span className={f.quota}><HardDriveIcon size={13} /> {t('quota')}<i><b style={{ width: '21%' }} /></i></span>
        </div>
        <div className={f.folders}>
          {libFolders.map((fo, i) => (
            <div key={fo.id} className={`${f.folderSlot} ${open === i ? f.folderOn : ''}`}>
              <FolderCard folder={fo} onOpen={() => setOpen(i)} />
            </div>
          ))}
          {popover && (
            <div className={f.share} role="status">
              <div className={f.shareHead}><UsersIcon size={14} /> {t('share')}</div>
              <div className={f.shareName}>{folders[0].name} · {t('until')}</div>
              {names.map((name, i) => (
                <div key={name} className={f.shareRow}>
                  <span className={f.avatar}>{name[0]}</span>
                  <span className={f.shareStudent}>{name}</span>
                  <span className={`${f.switch} ${i < granted ? f.switchOn : ''}`} aria-hidden />
                </div>
              ))}
              {tick >= 6 && <div className={f.shareDone}><CheckIcon size={13} /> {t('done')}</div>}
            </div>
          )}
          {toast && <div key={toast} className={f.toast}><EyeIcon size={14} /> {t('opened', { name: toast })}</div>}
        </div>
        <div className={f.filesHead}>{t('filesIn')} · {folder.name}</div>
        <div key={open} className={f.files}>
          {libFiles.map((file, i) => (
            <div key={file.id} className={f.fileSlot} style={{ animationDelay: `${i * 0.07}s` }}>
              <FileCard file={file} onPreview={noop} onDownload={noop} lecture={file.lectureNoteId ? { onOpen: noop } : undefined} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
