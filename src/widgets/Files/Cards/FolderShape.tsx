'use client'

import { resolveCover } from '@/shared/lib/tutorFiles/covers'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { folderBackPath, folderFrontPath } from '../lib'
import styles from './FolderShape.module.scss'

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

interface FolderShapeProps {
  folderId: string
  cover: string | null
  /** Dashed empty outline instead of a filled folder ("new folder" tile). */
  ghost?: boolean
  className?: string
  children: ReactNode
}

/**
 * The folder silhouette from the Floe reference: a back sheet peeking out on
 * the right, the front with its tab on the left. The path is rebuilt for the
 * measured size so corners stay round at any card width; until measured
 * (first paint / no ResizeObserver) it degrades to a rounded rectangle.
 */
export function FolderShape({ folderId, cover, ghost = false, className, children }: FolderShapeProps) {
  const [ref, { w, h }] = useSize<HTMLDivElement>()
  const resolved = resolveCover(folderId, cover)
  const background = resolved.kind === 'image' ? `center / cover no-repeat url("${resolved.url}")` : resolved.preset.background
  const dark = resolved.kind === 'image' || resolved.preset.dark
  const measured = w > 0 && h > 0
  const front = measured ? folderFrontPath(w, h) : ''
  const back = measured ? folderBackPath(w, h) : ''

  return (
    <div ref={ref} className={`${styles.shape} ${dark ? styles.dark : ''} ${ghost ? styles.ghost : ''} ${className ?? ''}`} data-dark={dark || undefined}>
      {!ghost && (
        <>
          <div className={styles.back} style={{ background, clipPath: measured ? `path('${back}')` : undefined }} aria-hidden="true" />
          <div className={styles.front} style={{ background, clipPath: measured ? `path('${front}')` : undefined }} aria-hidden="true" />
        </>
      )}
      {measured && (
        <svg className={styles.outline} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <path d={front} />
        </svg>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  )
}
