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

  const onNavigate = useCallback((id: string | null) => {
    router.push(id ? `${pathname}?folder=${encodeURIComponent(id)}` : pathname, { scroll: false })
  }, [router, pathname])

  return <FilesShell role={role} folderId={folderId} onNavigate={onNavigate} />
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
