'use client'

import { CameraIcon, CheckIcon, MicIcon, PauseIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { DocBlocks, type Block } from './Doc'
import Link from 'next/link'
import { HeroCopy, LECTURE_HREF, useReducedMotion } from './shared'
import s from './LectureLanding.module.scss'

type BoardState = 'idle' | 'scanning' | 'added'
const TICK_MS = 500
const TICKS_PER_BLOCK = 3
const START_SECONDS = 41 * 60 + 7

/**
 * The first screen: the lecture is being recorded (the orb and its wave —
 * click to pause), the notes write themselves from what was said, and the
 * chalkboard below the orb can be photographed — its intersection points,
 * graph and the answer land in the notes as fresh blocks. If nobody clicks,
 * the board is photographed on its own once the spoken part is written.
 */
export function HeroStudio() {
  const t = useTranslations('lectureLanding.hero')
  const chalk = t.raw('chalk') as string[]
  const spoken = t.raw('notes') as Block[]
  const fromBoard = t.raw('fromBoard') as Block[]
  const heard = t.raw('heard') as { v: string; noise?: boolean }[]
  const reduced = useReducedMotion()
  const [ticks, setTicks] = useState(0)
  const [recording, setRecording] = useState(true)
  const [board, setBoard] = useState<BoardState>('idle')
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const written = reduced ? spoken.length : Math.min(spoken.length, Math.floor(ticks / TICKS_PER_BLOCK))
  const spokenDone = written >= spoken.length
  const boardShown = reduced || board === 'added'

  useEffect(() => {
    if (!recording || reduced) return
    const id = setInterval(() => setTicks(n => n + 1), TICK_MS)
    return () => clearInterval(id)
  }, [recording, reduced])
  useEffect(() => () => { if (scanTimer.current) clearTimeout(scanTimer.current) }, [])

  const snap = () => {
    if (board !== 'idle') return
    setBoard('scanning')
    scanTimer.current = setTimeout(() => setBoard('added'), reduced ? 0 : 1700)
  }
  // Nobody touched the board: once the spoken part is written, the photo is taken by itself.
  const autoSnapped = useRef(false)
  useEffect(() => {
    if (!spokenDone || reduced || autoSnapped.current || board !== 'idle') return
    const id = setTimeout(() => { autoSnapped.current = true; snap() }, 900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spokenDone, reduced, board])

  const replay = () => {
    if (scanTimer.current) clearTimeout(scanTimer.current)
    autoSnapped.current = false
    setBoard('idle')
    setTicks(0)
    setRecording(true)
  }

  // One heard line every two ticks; the notes trail behind it.
  const heardCount = reduced ? heard.length : Math.min(heard.length, Math.ceil(ticks / 2))
  const blocks = [...spoken.slice(0, written), ...(boardShown ? fromBoard : [])]
  const fresh = new Set<number>()
  if (!reduced) {
    if (!spokenDone && written > 0) fresh.add(written - 1)
    if (boardShown) fromBoard.forEach((_, i) => fresh.add(written + i))
  }
  const seconds = START_SECONDS + Math.floor((ticks * TICK_MS) / 1000)
  const clock = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const aiState = board === 'scanning' ? t('scanning') : boardShown ? t('ready') : recording ? t('writing') : t('paused')

  return (
    <section className={s.hero}>
      <div className={`${s.wrap} ${s.heroGrid} ${s.heroWide}`}>
        <HeroCopy hint={t('hint')} />
        <div className={s.studio}>
          <div className={s.studioLeft}>
            <div className={s.recCard}>
              <button
                type="button"
                className={`${s.orbBtn} ${s.orbBig} ${recording ? s.orbRec : s.orbIdle}`}
                onClick={() => setRecording(r => !r)}
                aria-pressed={recording}
                aria-label={recording ? t('pause') : t('resume')}
              >
                <i /><i /><b>{recording ? <PauseIcon size={20} fill="currentColor" /> : <MicIcon size={22} />}</b>
              </button>
              <div className={s.clock}>
                <strong>{clock}</strong>
                <small><span className={`${s.recDot} ${recording ? '' : s.recDotOff}`} aria-hidden />{recording ? t('recording') : t('paused')}</small>
              </div>
              <div className={`${s.wave} ${s.waveWide} ${recording && !reduced ? s.waveOn : ''}`} aria-hidden>
                {Array.from({ length: 22 }, (_, i) => <span key={i} style={{ animationDelay: `${(i * 0.17) % 0.9}s` }} />)}
              </div>
            </div>

            <div className={`${s.photo} ${s.photoCompact}`} role="img" aria-label={chalk.join('. ')}>
              <div className={s.chalk}>{chalk.map((c, i) => <span key={i}>{c}</span>)}</div>
              {board === 'scanning' && <><div className={s.flash} /><div className={s.scan} /></>}
              {boardShown && <span className={s.photoDone}><CheckIcon size={13} /> {t('added')}</span>}
            </div>
            <Link href={LECTURE_HREF} className={s.photoBtn}>
              <CameraIcon size={18} /> {board === 'scanning' ? t('scanning') : t('snap')}
            </Link>

            {/* What the microphone hears right now — junk struck out, the notes are made from the rest. */}
            <div className={s.heardCard} aria-live="off">
              <div className={s.paneLabel}><MicIcon size={12} /> {t('heardTitle')}</div>
              {heard.slice(0, heardCount).slice(-5).map((l, i, shown) => (
                <p key={heardCount - shown.length + i} className={`${s.heardLine} ${l.noise ? s.noise : ''}`}>{l.v}</p>
              ))}
            </div>
          </div>

          <div className={s.studioNotes}>
            <div className={s.notesHead}>
              <span className={s.studioTitle}>{t('notesTitle')}</span>
              <span className={`${s.aiChip} ${recording || board === 'scanning' ? '' : s.aiChipIdle}`}><SparklesIcon size={12} /> {aiState}</span>
            </div>
            {blocks.length
              ? <DocBlocks blocks={blocks} fresh={fresh} />
              : <p className={s.empty}>{t('empty')}</p>}
            {boardShown && !reduced && <button type="button" className={s.replay} onClick={replay}><RotateCcwIcon size={13} /> {t('replay')}</button>}
          </div>
        </div>
      </div>
    </section>
  )
}
