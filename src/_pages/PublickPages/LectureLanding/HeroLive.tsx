'use client'

import { MicIcon, RotateCcwIcon, SparklesIcon, SquareIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { DocBlocks, type Block } from './Doc'
import { HeroCopy, useReducedMotion } from './shared'
import s from './LectureLanding.module.scss'

type Compression = 'none' | 'medium' | 'strong'
const LINE_MS = 1100

/**
 * Hero A — «Нажмите на запись»: the recording orb is the button. A scripted
 * pair plays: the microphone hears everything (junk struck out), the notes
 * write themselves; then the compression tabs work on the result.
 */
export function HeroLive() {
  const t = useTranslations('lectureLanding')
  const lines = t.raw('demo.transcript') as { v: string; noise?: boolean }[]
  const notes = t.raw('demo.notes') as Record<Compression, Block[]>
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0) // lines heard so far
  const [running, setRunning] = useState(false)
  const [compression, setCompression] = useState<Compression>('none')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const done = step >= lines.length

  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setRunning(false) }
  const start = () => {
    if (timer.current) clearInterval(timer.current)
    setCompression('none')
    if (reduced) { setStep(lines.length); return }
    setStep(0)
    setRunning(true)
    timer.current = setInterval(() => {
      setStep(n => {
        if (n + 1 >= lines.length) { if (timer.current) clearInterval(timer.current); timer.current = null; setRunning(false) }
        return Math.min(n + 1, lines.length)
      })
    }, LINE_MS)
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  // Alive from the first second: the pair starts by itself once (reduced motion: the finished notes).
  const autoplayed = useRef(false)
  useEffect(() => {
    if (autoplayed.current) return
    autoplayed.current = true
    const id = setTimeout(() => start(), 1200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The notes trail the speech: only lines that said something count, and a block needs a line behind it.
  const said = lines.slice(0, step).filter(l => !l.noise).length
  const totalSaid = lines.filter(l => !l.noise).length
  const full = notes[compression]
  const shown = done ? full.length : Math.floor((said / totalSaid) * notes.none.length)
  const blocks = (done ? full : notes.none).slice(0, shown)
  const seconds = Math.round(step * 4.6 * 60)
  const clock = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <section className={s.hero}>
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <HeroCopy hint={t('live.idle')} />
        <div className={s.device}>
          <div className={s.deviceTop}>
            <button
              type="button"
              className={`${s.orbBtn} ${running ? s.orbRec : s.orbIdle}`}
              onClick={running ? stop : start}
              aria-label={running ? t('live.recording') : t('live.idle')}
            >
              <i /><i /><b>{running ? <SquareIcon size={16} fill="currentColor" /> : <MicIcon size={20} />}</b>
            </button>
            <div className={s.clock}>
              <strong>{clock}</strong>
              <small>{running ? t('live.recording') : done ? t('live.done') : t('live.idle')}</small>
            </div>
            <div className={`${s.wave} ${running ? s.waveOn : ''}`} aria-hidden>
              {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ animationDelay: `${(i * 0.13) % 0.7}s` }} />)}
            </div>
          </div>
          <div className={s.deviceBody}>
            <div className={s.heard}>
              <div className={s.paneLabel}><MicIcon size={12} /> {t('live.heard')}</div>
              {lines.slice(0, step).map((l, i) => <p key={i} className={`${s.heardLine} ${l.noise ? s.noise : ''}`}>{l.v}</p>)}
            </div>
            <div className={s.notesPane}>
              <div className={s.notesHead}>
                <span className={`${s.aiChip} ${running ? '' : s.aiChipIdle}`}><SparklesIcon size={12} /> {t('live.ai')}</span>
                <div className={s.tabs} role="tablist" aria-label={t('live.compression')}>
                  {(['none', 'medium', 'strong'] as const).map(c => (
                    <button key={c} type="button" role="tab" aria-selected={compression === c} className={compression === c ? s.tabOn : ''} disabled={!done} onClick={() => setCompression(c)}>
                      {t(`live.${c}`)}
                    </button>
                  ))}
                </div>
              </div>
              {blocks.length ? <DocBlocks key={done ? compression : 'live'} blocks={blocks} fresh={done ? undefined : new Set([blocks.length - 1])} /> : <p className={s.empty}>{t('live.emptyNotes')}</p>}
              {done && <button type="button" className={s.replay} onClick={start}><RotateCcwIcon size={13} /> {t('live.replay')}</button>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
