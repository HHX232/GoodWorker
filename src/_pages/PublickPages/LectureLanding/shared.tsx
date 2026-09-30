'use client'

import { FolderOpenIcon, MousePointerClickIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import s from './LectureLanding.module.scss'

export const LECTURE_HREF = '/lecture'
export const FILES_HREF = '/files?tab=mine'

export function useReducedMotion(): boolean {
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

/** The record button of the site: dark, with the red dot of a live recording. */
export function StartButton({ label }: { label: string }) {
  return <Link href={LECTURE_HREF} className={s.cta}><span className={s.ctaDot} aria-hidden />{label}</Link>
}

/** Eyebrow, headline, lead and the two CTAs — the same words in every hero variant. */
export function HeroCopy({ hint, center = false }: { hint?: string; center?: boolean }) {
  const t = useTranslations('lectureLanding')
  return (
    <div className={center ? s.heroCenter : undefined}>
      <div className={s.eyebrow}>{t('eyebrow')}</div>
      <h1 className={s.h1}>{t('h1')} <span className={s.hl}>{t('h1Hl')}</span></h1>
      <p className={s.lead}>{t('lead')}</p>
      <div className={s.ctaRow}>
        <StartButton label={t('cta')} />
        <Link href={FILES_HREF} className={s.ghost}><FolderOpenIcon size={17} /> {t('ctaFiles')}</Link>
        <span className={s.ctaNote}>{t('ctaNote')}</span>
      </div>
      {hint && <div className={s.tryHint} style={center ? { justifyContent: 'center' } : undefined}><MousePointerClickIcon size={15} /> {hint}</div>}
    </div>
  )
}
