'use client'

import { PauseIcon, PlayIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatClock } from './format'
import type { ChunkDto } from './types'
import styles from './LectureWorkspace.module.scss'

/** The whole raw transcript, chunk by chunk, with replay of each piece ("переслушать место"). */
export function TranscriptModal({ lectureId, chunks, onClose }: { lectureId: string; chunks: ChunkDto[]; onClose: () => void }) {
  const t = useTranslations('lecture')
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); audio.current?.pause() }
  }, [onClose])

  const play = (seq: number) => {
    audio.current?.pause()
    if (playing === seq) { setPlaying(null); return }
    const a = new Audio(`/api/lecture/${lectureId}/audio/${seq}`)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    audio.current = a
    setPlaying(seq)
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.transcript} role="dialog" aria-label={t('fullTranscript')}>
        <div className={styles.transcriptHead}>
          <span>{t('fullTranscript')}</span>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('close')}><XIcon size={16} /></button>
        </div>
        <p className={styles.muted}>{t('transcriptHint')}</p>
        <ol className={styles.transcriptList}>
          {chunks.map(c => (
            <li key={c.seq}>
              <span className={styles.feedTime}>{formatClock(c.startMs)}</span>
              {c.hasAudio
                ? <button type="button" className={styles.playBtn} onClick={() => play(c.seq)} aria-label={t('replay')}>{playing === c.seq ? <PauseIcon size={13} /> : <PlayIcon size={13} />}</button>
                : <span className={styles.playBtnGhost} />}
              <span className={c.isFinal ? styles.finalText : ''}>
                {c.text.split(/(⟨\?[^⟩]*⟩)/g).map((part, i) =>
                  part.startsWith('⟨?') ? <span key={i} className={styles.doubtful} title={t('doubtful')}>{part.slice(2, -1)}</span> : part)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  )
}
