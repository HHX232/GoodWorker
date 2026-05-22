'use client'
import {InfoAudioPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {Mic2Icon, PauseIcon, PlayIcon, UploadIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './InfoAudioEditor.module.scss'

interface Props {
  payload: InfoAudioPayload
  onChange?: (payload: InfoAudioPayload) => void
  viewOnly?: boolean
}

async function extractWaveform(file: File): Promise<number[]> {
  const BAR_COUNT = 130
  const arrayBuffer = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close()
  const raw = audioBuffer.getChannelData(0)
  const blockSize = Math.floor(raw.length / BAR_COUNT)
  const peaks: number[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    let sum = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j])
    peaks.push(sum / blockSize)
  }
  const max = Math.max(...peaks, 0.001)
  return peaks.map((p) => p / max)
}

// ── AudioPlayer ───────────────────────────────────────────────

interface PlayerProps {
  url: string
  filename: string
  waveform: number[]
  onRemove?: () => void
  viewOnly?: boolean
}

const AudioPlayer = ({url, filename, waveform, onRemove, viewOnly = false}: PlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const rafRef = useRef<number>(0)

  const tick = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime)
    setProgress(el.duration ? el.currentTime / el.duration : 0)
    // eslint-disable-next-line react-hooks/immutability
    if (!el.paused) rafRef.current = requestAnimationFrame(tick)
  }, [])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    } else {
      el.pause()
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
    }
  }

  const handleEnded = () => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    cancelAnimationFrame(rafRef.current)
  }

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current
    if (!el || !el.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    el.currentTime = ratio * el.duration
    setProgress(ratio)
    if (el.paused) {
      el.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`
  const passedBars = Math.round(progress * waveform.length)

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={handleEnded}
      />

      <button type='button' className={styles.play_btn} onClick={togglePlay}>
        {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>

      <div className={styles.waveform_wrap}>
        <div className={styles.waveform} onClick={handleWaveformClick}>
          {waveform.map((amp, i) => (
            <div
              key={i}
              className={`${styles.bar} ${i < passedBars ? styles.bar_passed : ''} ${i === passedBars ? styles.bar_cursor : ''}`}
              style={{'--amp': amp} as React.CSSProperties}
            />
          ))}
        </div>
        <div className={styles.timer}>
          <span>{fmt(currentTime)}</span>
          <span className={styles.timer_total}>{fmt(duration)}</span>
        </div>
      </div>

      <div className={styles.meta}>
        <span className={styles.filename} title={filename}>
          {filename}
        </span>
        {!viewOnly && onRemove && (
          <button type='button' className={styles.remove_btn} onClick={onRemove}>
            <XIcon size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── InfoAudioEditor ───────────────────────────────────────────

export const InfoAudioEditor = ({payload, onChange, viewOnly = false}: Props) => {
  const t = useTranslations('InfoAudioEditor')
  const editable = !!onChange && !viewOnly
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)

  const update = (patch: Partial<InfoAudioPayload>) => onChange?.({...payload, ...patch})

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    const url = URL.createObjectURL(file)
    try {
      const waveform = await extractWaveform(file)
      update({url, filename: file.name, waveform})
    } catch {
      update({url, filename: file.name, waveform: Array(100).fill(0.5)})
    } finally {
      setExtracting(false)
    }
  }

  const remove = () => {
    update({url: null, filename: null, waveform: null})
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasAudio = !!payload.url && !!payload.waveform

  // ── View only ─────────────────────────────────────────────

  if (!editable) {
    if (!payload.url || !payload.waveform) return null
    return <AudioPlayer url={payload.url} filename={payload.filename ?? ''} waveform={payload.waveform} viewOnly />
  }

  // ── Edit ──────────────────────────────────────────────────

  return (
    <div className={styles.box}>
      <input ref={fileRef} type='file' accept='audio/*' className={styles.hidden} onChange={handleFile} />

      {!hasAudio && !extracting && (
        <button type='button' className={styles.upload_btn} onClick={() => fileRef.current?.click()}>
          <UploadIcon size={18} />
          <span>{t('uploadAudio')}</span>
          <span className={styles.upload_hint}>{t('audioFormats')}</span>
        </button>
      )}

      {extracting && (
        <div className={styles.extracting}>
          <div className={styles.extracting_bars}>
            {Array.from({length: 20}).map((_, i) => (
              <div key={i} className={styles.extracting_bar} style={{animationDelay: `${i * 60}ms`}} />
            ))}
          </div>
          <span>{t('analyzing')}</span>
        </div>
      )}

      {hasAudio && (
        <>
          <AudioPlayer url={payload.url!} filename={payload.filename!} waveform={payload.waveform!} onRemove={remove} />
          <p className={styles.student_hint}>
            <Mic2Icon size={12} />
            {t('studentHint')}
          </p>
        </>
      )}
    </div>
  )
}
