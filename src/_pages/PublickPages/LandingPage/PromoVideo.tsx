'use client'

import { GraduationCap, Play, Presentation, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import st from './PromoVideo.module.scss'

// Превью в кружке — беззвучное 480p (быстро грузится), в плеере — 720p со звуком.
const VIDEOS = {
  teachers: { player: '/promo/GoodWorker_Teachers_v5_720.mp4', preview: '/promo/GoodWorker_Teachers_v5_480_preview.mp4', poster: '/promo/GoodWorker_Teachers_v5_480.jpg', sec: 40 },
  students: { player: '/promo/GoodWorker_Students_720.mp4', preview: '/promo/GoodWorker_Students_480_preview.mp4', poster: '/promo/GoodWorker_Students_480.jpg', sec: 35 },
} as const
type Role = keyof typeof VIDEOS
const ROLES: Role[] = ['teachers', 'students']
const MOTION_MS = 450

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function PromoVideo({ defaultRole = 'teachers' }: { defaultRole?: Role }) {
  const t = useTranslations('LandingPage')
  const [role, setRole] = useState<Role>(defaultRole)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const circleRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const visibleRef = useRef(false)
  const btnRefs = useRef<Partial<Record<Role, HTMLButtonElement | null>>>({})
  const rolesRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)

  const playPreview = () => {
    if (visibleRef.current && !reducedMotion()) previewRef.current?.play().catch(() => {})
  }

  // Плашка под активной кнопкой роли — пишем стиль напрямую, без лишних рендеров
  useLayoutEffect(() => {
    const place = () => {
      const b = btnRefs.current[role], th = thumbRef.current
      if (!b || !th) return
      th.style.width = `${b.offsetWidth}px`
      th.style.transform = `translateX(${b.offsetLeft}px)`
    }
    place()
    window.addEventListener('resize', place)
    document.fonts?.ready.then(place)
    return () => window.removeEventListener('resize', place)
  }, [role])
  // анимация плашки — только после первого размещения
  useEffect(() => {
    const id = requestAnimationFrame(() => rolesRef.current?.classList.add(st.ready))
    return () => cancelAnimationFrame(id)
  }, [])

  // Превью играет только в зоне видимости
  useEffect(() => {
    const el = rootRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => {
      visibleRef.current = e.isIntersecting
      if (e.isIntersecting) playPreview()
      else previewRef.current?.pause()
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const openPlayer = () => {
    previewRef.current?.pause()
    setOpen(true)
  }
  const pick = (next: Role) => {
    if (next !== role) { setRole(next); setProgress(0) }
    openPlayer()
  }

  const v = VIDEOS[role]
  const words = { teachers: t('promo_word_teacher'), students: t('promo_word_student') }

  return (
    <div ref={rootRef} className={st.block} data-role={role}>
      <button
        ref={circleRef}
        type='button'
        className={st.circle}
        onClick={openPlayer}
        aria-label={t('promo_watch_aria', { who: words[role], time: fmt(v.sec) })}
      >
        <video
          ref={previewRef}
          key={role}
          src={v.preview}
          poster={v.poster}
          muted
          loop
          playsInline
          preload='metadata'
          onTimeUpdate={e => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || v.sec))}
        />
        <svg className={st.ring} viewBox='0 0 72 72' aria-hidden='true'>
          <circle className={st.ring_track} cx='36' cy='36' r='34.5' />
          <circle className={st.ring_bar} cx='36' cy='36' r='34.5' pathLength={100} strokeDasharray='100' strokeDashoffset={100 - progress * 100} />
        </svg>
        <span className={st.badge}><Play size={11} fill='currentColor' strokeWidth={0} /></span>
      </button>

      <div className={st.text}>
        <div className={st.eyebrow}>{t('promo_eyebrow')} · {fmt(v.sec)}</div>
        <div className={st.title}>
          {t.rich('promo_title', {
            word: () => (
              <span className={st.roll}>
                <span className={st.roll_in} aria-live='polite'>
                  <span>{words.teachers}</span>
                  <span>{words.students}</span>
                </span>
              </span>
            ),
          })}
        </div>
      </div>

      <div ref={rolesRef} className={st.roles} role='group' aria-label={t('promo_roles_aria')}>
        <span ref={thumbRef} className={st.thumb} aria-hidden='true' />
        {ROLES.map(r => (
          <button
            key={r}
            ref={el => { btnRefs.current[r] = el }}
            type='button'
            aria-pressed={role === r}
            onClick={() => pick(r)}
          >
            {r === 'teachers' ? <Presentation size={18} /> : <GraduationCap size={18} />}
            {r === 'teachers' ? t('promo_btn_teacher') : t('promo_btn_student')}
            <small>{fmt(VIDEOS[r].sec)}</small>
          </button>
        ))}
      </div>

      {open && createPortal(
        <PlayerModal
          src={v.player}
          poster={v.poster}
          fromRef={circleRef}
          onClosed={() => { setOpen(false); playPreview() }}
        />,
        document.body,
      )}
    </div>
  )
}

function PlayerModal({ src, poster, fromRef, onClosed }: {
  src: string
  poster: string
  fromRef: React.RefObject<HTMLElement | null>
  onClosed: () => void
}) {
  const t = useTranslations('LandingPage')
  const [shown, setShown] = useState(false)
  const [failed, setFailed] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)

  // FLIP: плеер «вырастает» из кружка
  const flipTransform = () => {
    const el = playerRef.current, from = fromRef.current
    if (!el || !from) return ''
    const a = from.getBoundingClientRect(), b = el.getBoundingClientRect()
    return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`
  }

  useLayoutEffect(() => {
    const ret = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    // play() здесь — в том же такте, что и клик: браузер разрешает звук
    videoRef.current?.play().catch(() => {})
    const el = playerRef.current
    if (el && !reducedMotion()) {
      el.style.transition = 'none'
      el.style.transform = flipTransform()
      void el.offsetWidth
      el.style.transition = ''
      el.style.transform = ''
    }
    requestAnimationFrame(() => setShown(true))
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      html.style.overflow = prevOverflow
      ret?.focus({ preventScroll: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (closingRef.current) return
    closingRef.current = true
    videoRef.current?.pause()
    setShown(false)
    const reduced = reducedMotion()
    if (playerRef.current && !reduced) playerRef.current.style.transform = flipTransform()
    setTimeout(onClosed, reduced ? 0 : MOTION_MS)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key !== 'Tab') return
      // фокус не уходит из диалога: видео ↔ «закрыть»
      const first = videoRef.current, last = closeRef.current
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${st.modal} ${shown ? st.on : ''}`} role='dialog' aria-modal='true' aria-label={t('promo_dialog_aria')}>
      <div className={st.backdrop} onClick={close} />
      <div ref={playerRef} className={st.player}>
        <video ref={videoRef} src={src} poster={poster} controls playsInline onError={() => setFailed(true)} />
        {failed && <div className={st.error} style={{ backgroundImage: `url(${poster})` }}>{t('promo_error')}</div>}
      </div>
      <button ref={closeRef} type='button' className={st.close} onClick={close} aria-label={t('promo_close')}>
        <X size={18} />
      </button>
    </div>
  )
}
