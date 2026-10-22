'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { spineVars } from './bookColor'
import styles from './BookCover.module.scss'

export type BookCoverSize = 'sm' | 'md' | 'lg' | 'xl' | 'fluid'

export interface BookCoverProps {
  title: string
  /** `#RRGGBB` — spine, base, title plate and the typographic cover. */
  spineColor: string
  /** The 2:3 picture; null / broken → the typographic cover. */
  coverUrl?: string | null
  coverKind?: 'found' | 'page1' | 'photo' | null
  /** md ≈ 150px, lg ≈ 200, xl ≈ 250 (quick view), sm ≈ 90 (editor), fluid = the parent's width. */
  size?: BookCoverSize
  /** 0…100 — how much of the bottom edge is filled (reading progress). */
  progressPct?: number
  /** With `onToggleSave` the ribbon bookmark is shown (aria-pressed = saved). */
  saved?: boolean
  onToggleSave?: () => void
  className?: string
}

/** The 3D book: coloured spine, page edge, ribbon bookmark, soft shadow. Cover = picture or a typographic one. */
export function BookCover({ title, spineColor, coverUrl, coverKind, size = 'md', progressPct = 0, saved = false, onToggleSave, className }: BookCoverProps) {
  const t = useTranslations('files')
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const showImage = !!coverUrl && brokenUrl !== coverUrl
  const imgRef = useRef<HTMLImageElement>(null)
  // A server-rendered <img> can fail before React attaches onError — catch that case on mount.
  useEffect(() => {
    const el = imgRef.current
    if (el && coverUrl && el.complete && el.naturalWidth === 0) setBrokenUrl(coverUrl)
  }, [coverUrl])
  const style = { ...spineVars(spineColor), '--p': `${Math.max(0, Math.min(100, progressPct))}%` } as React.CSSProperties

  return (
    <div className={`${styles.bkw} ${styles[size]} ${className ?? ''}`} style={style}>
      <div className={styles.book}>
        <div className={styles.stack}>
          <div className={styles.cover}>
            {showImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} className={styles.art} src={coverUrl} alt="" draggable={false} onError={() => setBrokenUrl(coverUrl)} />
                {coverKind === 'photo' && <div className={styles.plate}><span>{title}</span></div>}
              </>
            ) : (
              <div className={styles.gen}>
                <svg className={styles.pat} viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <g stroke="currentColor" strokeOpacity=".18" strokeWidth="1">
                    {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M0 ${30 + i * 20}H200`} />)}
                  </g>
                  <path d="M26 0V300" stroke="currentColor" strokeOpacity=".3" />
                </svg>
                <div className={styles.genTitle}>{title}</div>
                <div className={styles.genFoot}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 15h5M10 18h3" /></svg>
                  <span>PDF</span>
                </div>
              </div>
            )}
            <span className={styles.chip}>PDF</span>
          </div>
          <div className={styles.pages} />
          <div className={styles.base}><i /></div>
        </div>
      </div>
      {onToggleSave && (
        <button
          type="button"
          className={styles.rib}
          aria-pressed={saved}
          aria-label={t('booksKitRibbonAria', { title })}
          title={saved ? t('booksKitUnsave') : t('booksKitSave')}
          onClick={e => { e.stopPropagation(); onToggleSave() }}
        >
          {saved ? (
            <svg viewBox="0 0 26 42" aria-hidden="true">
              <path d="M1.5 0v39.5L13 31l11.5 8.5V0z" className={styles.ribOn} stroke="#fff" strokeWidth="1.6" />
              <path d="m8 12.5 4 4 6.2-7.5" fill="none" className={styles.ribTick} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 26 42" aria-hidden="true">
              <path d="M1.5 0v39.5L13 31l11.5 8.5V0z" fill="rgba(24,20,44,.5)" stroke="#fff" strokeWidth="1.6" strokeDasharray="3.4 2.6" />
              <path d="M13 9.5v9M8.5 14h9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
