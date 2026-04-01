/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useReactFlow, useStore} from '@xyflow/react'
import {Mic2Icon, PauseIcon, PlayIcon, UploadIcon, XIcon} from 'lucide-react'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './AudioBlock.module.scss'

// ── Извлечение waveform ───────────────────────────────────────────────────────

async function extractWaveform(file: File): Promise<number[]> {
  const BAR_COUNT = 80
  const arrayBuffer = await file.arrayBuffer()
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

// ── Плеер ─────────────────────────────────────────────────────────────────────

interface PlayerProps {
  url: string
  filename: string
  waveform: number[]
  accentColor?: string
  onRemove: () => void
}

function AudioPlayer({url, filename, waveform, accentColor, onRemove}: PlayerProps) {
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

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const passedBars = Math.round(progress * waveform.length)

  // Цвет акцента — цвет хедера или дефолтный
  const accent = accentColor || '#3b82f6'

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={handleEnded}
      />

      <button type='button' className={styles.playBtn} onClick={togglePlay} style={{color: accent}}>
        {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>

      <div className={styles.waveformWrap}>
        <div className={styles.waveform} onClick={handleWaveformClick}>
          {waveform.map((amp, i) => {
            const passed = i < passedBars
            const isCursor = i === passedBars
            return (
              <div
                key={i}
                className={`${styles.bar} ${passed ? styles.barPassed : ''} ${isCursor ? styles.barCursor : ''}`}
                style={
                  {
                    '--amp': amp,
                    '--accent': accent
                  } as React.CSSProperties
                }
              />
            )
          })}
        </div>

        <div className={styles.timer}>
          <span style={{color: accent}}>{fmt(currentTime)}</span>
          <span className={styles.timerTotal}>{fmt(duration)}</span>
        </div>
      </div>

      <div className={styles.meta}>
        <span className={styles.filename} title={filename}>
          {filename}
        </span>
        <button type='button' className={styles.removeBtn} onClick={onRemove}>
          <XIcon size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Основной блок ─────────────────────────────────────────────────────────────

export default function AudioBlock({nodeId}: {nodeId: string}) {
  const {updateNodeData, getNode} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)

  const audioData = useStore((s) => {
    const data = s.nodeLookup.get(nodeId)?.data as RoadNodeData & {
      audioUrl?: string
      audioFilename?: string
      audioWaveform?: number[]
    }
    return {
      url: data?.audioUrl ?? null,
      filename: data?.audioFilename ?? null,
      waveform: data?.audioWaveform ?? null,
      headerColor: data?.headerColor ?? ''
    }
  })

  const update = (patch: Record<string, any>) => {
    updateNodeData(nodeId, patch as any)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    const url = URL.createObjectURL(file)
    try {
      const waveform = await extractWaveform(file)
      update({audioUrl: url, audioFilename: file.name, audioWaveform: waveform})
    } catch {
      update({audioUrl: url, audioFilename: file.name, audioWaveform: Array(80).fill(0.5)})
    } finally {
      setExtracting(false)
    }
  }

  const remove = () => {
    update({audioUrl: null, audioFilename: null, audioWaveform: null})
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasAudio = !!audioData.url && !!audioData.waveform

  return (
    <div className={`${styles.box} nodrag nopan`}>
      <input ref={fileRef} type='file' accept='audio/*' className={styles.hidden} onChange={handleFile} />

      {!hasAudio && !extracting && (
        <button type='button' className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
          <UploadIcon size={18} />
          <span>Загрузить аудиофайл</span>
          <span className={styles.uploadHint}>MP3, WAV, OGG, M4A</span>
        </button>
      )}

      {extracting && (
        <div className={styles.extracting}>
          <div className={styles.extractingBars}>
            {Array.from({length: 16}).map((_, i) => (
              <div
                key={i}
                className={styles.extractingBar}
                style={{
                  animationDelay: `${i * 70}ms`,
                  backgroundColor: audioData.headerColor || '#3b82f6'
                }}
              />
            ))}
          </div>
          <span>Анализирую аудио...</span>
        </div>
      )}

      {hasAudio && (
        <>
          <AudioPlayer
            url={audioData.url!}
            filename={audioData.filename!}
            waveform={audioData.waveform!}
            accentColor={audioData.headerColor || undefined}
            onRemove={remove}
          />
          <p className={styles.hint}>
            <Mic2Icon size={12} />
            Ученик услышит это аудио при прохождении
          </p>
        </>
      )}
    </div>
  )
}
