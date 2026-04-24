/* eslint-disable react-hooks/immutability */
'use client'

import {useActions} from '@/features/hooks/store/useActions'
import {PostAudioPayload} from '@/shared/types/Post/Post.type'
import {PauseIcon, PlayIcon, UploadIcon, XIcon} from 'lucide-react'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './PostAudioBlockEditor.module.scss'

// ── Waveform extractor ────────────────────────────────────────
async function extractWaveform(file: File): Promise<number[]> {
  const BAR_COUNT = 80
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
  onRemove: () => void
}

function AudioPlayer({url, filename, waveform, onRemove}: PlayerProps) {
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
    if (!el?.duration) return
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

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

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
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>

      <div className={styles.waveform_wrap}>
        <div className={styles.waveform} onClick={handleWaveformClick}>
          {waveform.map((amp, i) => {
            const passed = i < passedBars
            const isCursor = i === passedBars
            return (
              <div
                key={i}
                className={`${styles.bar} ${passed ? styles.bar_passed : ''} ${isCursor ? styles.bar_cursor : ''}`}
                style={{'--amp': amp} as React.CSSProperties}
              />
            )
          })}
        </div>
        <div className={styles.timer}>
          <span>{fmt(currentTime)}</span>
          <span className={styles.timer_sep}>/</span>
          <span className={styles.timer_total}>{fmt(duration)}</span>
        </div>
      </div>

      <div className={styles.file_row}>
        <span className={styles.filename} title={filename}>
          {filename}
        </span>
        <button type='button' className={styles.remove_btn} onClick={onRemove}>
          <XIcon size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────
interface Props {
  blockId: string
  payload: PostAudioPayload
}

export function PostAudioBlockEditor({blockId, payload}: Props) {
  const {updatePostBlockPayload} = useActions()
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)

  const update = (patch: Partial<PostAudioPayload & {waveform: number[] | null}>) =>
    updatePostBlockPayload({id: blockId, payload: {...payload, ...patch}})

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    const url = URL.createObjectURL(file)
    try {
      const waveform = await extractWaveform(file)
      update({url, filename: file.name, waveform})
    } catch {
      update({url, filename: file.name, waveform: Array(80).fill(0.5)})
    } finally {
      setExtracting(false)
    }
  }

  const remove = () => {
    update({url: null, filename: null, waveform: null})
    if (fileRef.current) fileRef.current.value = ''
  }

  // payload может не иметь waveform — берём из any
  const p = payload as PostAudioPayload & {waveform?: number[] | null}
  const hasAudio = !!p.url && !!p.waveform

  return (
    <div className={styles.box}>
      <input ref={fileRef} type='file' accept='audio/*' className={styles.hidden} onChange={handleFile} />

      {!hasAudio && !extracting && (
        <button type='button' className={styles.upload_btn} onClick={() => fileRef.current?.click()}>
          <UploadIcon size={16} />
          <span>Загрузить аудио</span>
          <span className={styles.upload_hint}>MP3 · WAV · OGG · M4A</span>
        </button>
      )}

      {extracting && (
        <div className={styles.extracting}>
          {Array.from({length: 16}).map((_, i) => (
            <div key={i} className={styles.ext_bar} style={{animationDelay: `${i * 70}ms`}} />
          ))}
          <span>Анализирую...</span>
        </div>
      )}

      {hasAudio && <AudioPlayer url={p.url!} filename={p.filename!} waveform={p.waveform!} onRemove={remove} />}
    </div>
  )
}
