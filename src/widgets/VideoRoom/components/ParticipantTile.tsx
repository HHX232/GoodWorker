'use client'

import Image from 'next/image'
import React, { useState } from 'react'
import {
  IconCamOff, IconCrown, IconKick,
  IconMicOff, IconStar,
  IconVolumeOff, IconVolumeOn,
} from '../icons'
import { type Layout, type Participant } from '../types'
import styles from '../VideoCallPage.module.scss'

// ── Avatar ────────────────────────────────────────────────────────────────────

const COLORS = ['#7c3aed','#db2777','#d97706','#059669','#0284c7','#dc2626','#ea580c','#65a30d']

function nameColor(n: string) {
  let h = 0
  for (const c of n) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) return <Image width={100} height={100} className={styles.avatarImg} src={url} alt={name} />
  return <div className={styles.avatar} style={{ background: nameColor(name) }}>{name[0]?.toUpperCase()}</div>
}

// ── Live caption ──────────────────────────────────────────────────────────────

function LiveCaptionWidget({ captionText }: { captionText: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasText = captionText.trim().length > 0
  return (
    <div className={`${styles.liveCaption} ${collapsed ? styles.liveCaptionCollapsed : ''}`}>
      <button
        className={styles.liveCaptionHeader}
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Развернуть субтитры' : 'Свернуть субтитры'}
      >
        <span>Субтитры</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d={collapsed ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
      {!collapsed && (
        <div className={styles.liveCaptionBody}>
          {hasText
            ? <><span className={styles.liveCaptionDot} /><span>{captionText}</span></>
            : <span className={styles.liveCaptionPlaceholder}>Говорите...</span>
          }
        </div>
      )}
    </div>
  )
}

// ── Draggable PiP wrapper ─────────────────────────────────────────────────────

export function DraggablePip({ children, index }: { children: React.ReactNode; index: number }) {
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  return (
    <div
      className={styles.pipTile}
      style={{ '--pip-index': index, transform: `translate(${off.x}px,${off.y}px)` } as React.CSSProperties}
      onPointerDown={(e) => {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        setOff({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy })
      }}
      onPointerUp={() => { drag.current = null }}
    >
      {children}
    </div>
  )
}

// ── Participant tile ──────────────────────────────────────────────────────────

export interface ParticipantTileProps {
  participant: Participant
  large?: boolean
  isPip?: boolean
  mainSpeaker: string
  layout: Layout
  camEnabled: boolean
  micEnabled: boolean
  liveText: string
  remoteLiveTexts: Record<string, string>
  canModerate: boolean
  onToggleLocalAudio: (identity: string) => void
  onTransferSpeaker: (identity: string) => void
  onMute: (identity: string) => void
  onMuteVideo: (identity: string) => void
  onKick: (identity: string) => void
}

export function ParticipantTile({
  participant: p,
  large = false,
  isPip = false,
  mainSpeaker,
  layout,
  camEnabled,
  micEnabled,
  liveText,
  remoteLiveTexts,
  canModerate,
  onToggleLocalAudio,
  onTransferSpeaker,
  onMute,
  onMuteVideo,
  onKick,
}: ParticipantTileProps) {
  const noVid = p.videoMuted || (p.isLocal && !camEnabled)
  const audioMuted = p.audioMuted || (p.isLocal && !micEnabled)
  const captionText = p.isLocal ? liveText : (remoteLiveTexts[p.identity] || '')
  const showCaption = large || (p.identity === mainSpeaker && layout !== 'pip')

  return (
    <div className={`${styles.tile} ${p.isLocal ? styles.tileLocal : ''} ${large ? styles.tileLarge : ''} ${isPip ? styles.tilePip : ''}`}>
      <video id={`v-${p.identity}`} className={styles.video} autoPlay playsInline muted={p.isLocal} />
      {noVid && <div className={styles.noVideo}><Avatar name={p.identity} url={p.avatarUrl} /></div>}
      <div className={styles.tileMeta}>
        <span className={styles.tileName}>{p.identity}</span>
        <div className={styles.tileBadges}>
          {p.isLocal && <span className={styles.badgeYou}>ВЫ</span>}
          {p.identity === mainSpeaker && <span className={styles.badgeOwner}><IconCrown /></span>}
        </div>
      </div>
      {audioMuted && <span className={styles.mutedIcon}><IconMicOff /></span>}
      {p.localAudioMuted && <span className={styles.localMutedIcon}><IconVolumeOff /></span>}
      {showCaption && <LiveCaptionWidget captionText={captionText} />}
      {!p.isLocal && (
        <div className={styles.tileActions}>
          <button className={styles.actionBtn} onClick={() => onToggleLocalAudio(p.identity)}>
            {p.localAudioMuted ? <IconVolumeOn /> : <IconVolumeOff />}
            {p.localAudioMuted ? 'Снять заглушение' : 'Заглушить у себя'}
          </button>
          {canModerate && (<>
            {p.identity !== mainSpeaker && (
              <button className={styles.actionBtn} onClick={() => onTransferSpeaker(p.identity)}>
                <IconStar /> Главный
              </button>
            )}
            {!audioMuted && (
              <button className={styles.actionBtn} onClick={() => onMute(p.identity)}>
                <IconMicOff /> Запретить аудио
              </button>
            )}
            {!p.videoMuted && (
              <button className={styles.actionBtn} onClick={() => onMuteVideo(p.identity)}>
                <IconCamOff /> Запретить видео
              </button>
            )}
            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => onKick(p.identity)}>
              <IconKick /> Исключить
            </button>
          </>)}
        </div>
      )}
    </div>
  )
}
