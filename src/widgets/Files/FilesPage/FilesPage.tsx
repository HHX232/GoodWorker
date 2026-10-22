'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'
import { FilesShell } from '../FilesShell/FilesShell'
import styles from './FilesPage.module.scss'

/** `?folder=<id>` is the open folder, so links (chat card, bookmarks) and browser back/forward work. */
function FilesPageInner({ role }: { role: 'teacher' | 'student' }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const folderId = searchParams.get('folder')
  // `?tab=mine` — a student's own drive ("Мои файлы"); folder ids there are drive folders.
  const mine = role === 'student' && searchParams.get('tab') === 'mine'

  const go = useCallback((id: string | null, tab: 'mine' | null) => {
    const params = new URLSearchParams()
    if (tab) params.set('tab', tab)
    if (id) params.set('folder', id)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname])

  const onNavigate = useCallback((id: string | null) => go(id, null), [go])
  const drive = role === 'student'
    ? { active: mine, folderId: mine ? folderId : null, onToggle: (active: boolean) => go(null, active ? 'mine' : null), onNavigate: (id: string | null) => go(id, 'mine') }
    : undefined

  return <FilesShell role={role} folderId={mine ? null : folderId} onNavigate={onNavigate} drive={drive} />
}

/** Client composition root for app/files/page.tsx (useSearchParams needs a Suspense boundary above it). */
export function FilesPage({ role, fontClassName }: { role: 'teacher' | 'student'; fontClassName?: string }) {
  return (
    <div className={`${styles.page} ${fontClassName ?? ''}`}>
      <div className={styles.frame}>
        <Suspense fallback={null}>
          <FilesPageInner role={role} />
        </Suspense>
      </div>
    </div>
  )
}
