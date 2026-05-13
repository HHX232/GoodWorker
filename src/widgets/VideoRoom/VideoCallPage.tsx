/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './VideoCallPage.module.scss'
import {
  IconCrown, IconMicOff, IconMicOn, IconStar, IconVolumeOff, IconVolumeOn,
  IconNotes, IconCam, IconCamOff, IconLink, IconCheck, IconKick, IconCopy, IconPhone, IconVideo,
} from './icons'
import { LAYOUTS, LAYOUT_LABELS, type Layout, type Participant } from './types'
import { useVideoRoom } from './hooks/useVideoRoom'
import { useTranscription } from './hooks/useTranscription'
import Image from 'next/image'

// ── Layout icons (JSX — can't go in .ts) ──────────────────────────────────────
const LAYOUT_ICONS: Record<Layout, React.ReactNode> = {
  pip:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="10" width="8" height="6" rx="1" fill="currentColor" opacity=".5"/></svg>,
  split: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="9" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="9" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  grid:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="2" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const COLORS = ['#7c3aed','#db2777','#d97706','#059669','#0284c7','#dc2626','#ea580c','#65a30d']
function nameColor(n: string) {
  let h = 0; for (const c of n) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}
function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) return <Image width={100} height={100}  className={styles.avatarImg} src={url} alt={name} />
  return <div className={styles.avatar} style={{ background: nameColor(name) }}>{name[0]?.toUpperCase()}</div>
}

// ── Draggable PiP tile ────────────────────────────────────────────────────────
function DraggablePip({ children, index }: { children: React.ReactNode; index: number }) {
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
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

interface Props {
  userName: string
  autoJoinRoom?: string
  roomId?: string
  ownerIdentity?: string
  localAvatarUrl?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoCallPage({ userName, autoJoinRoom, roomId, ownerIdentity, localAvatarUrl }: Props) {
  const router = useRouter()
  const [roomName] = useState(autoJoinRoom ?? '')
  const [layout, setLayout] = useState<Layout>('pip')
  const [mainSpeaker, setMainSpeaker] = useState<string>(ownerIdentity ?? userName)
  const [copied, setCopied] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  // Stable ref for the data-message router — updated on every render so the
  // LiveKit event listener (registered once) always calls the latest handler.
  const dataRouterRef = useRef<((type: string, payload: Record<string, any>, senderIdentity: string) => void) | null>(null)

  // ── Hooks (order matters: room first, then transcription which needs broadcast) ──
  const room = useVideoRoom({
    roomName,
    userName,
    localAvatarUrl,
    // Delegate to the ref so we never need to re-register the LiveKit listener
    onDataMessage: useCallback(
      (type, payload, senderIdentity) => dataRouterRef.current?.(type, payload, senderIdentity),
      [],
    ),
  })

  const transcription = useTranscription({
    connected: room.connected,
    micEnabled: room.micEnabled,
    userName,
    broadcast: room.broadcast,
  })

  // Wire the data-channel router once (all deps are stable useCallbacks, so this runs once).
  // useEffect — not render — to satisfy React's "no ref writes during render" rule.
  const { handleRemoteMessage } = transcription
  useEffect(() => {
    dataRouterRef.current = (type, payload, senderIdentity) => {
      if (type === 'layout') { setLayout(payload.layout); return }
      if (type === 'speaker') { setMainSpeaker(payload.identity); return }

      // Chrome SR messages — senderIdentity IS the speaker
      if (type === 'sr_live' || type === 'sr_final') {
        handleRemoteMessage(type, senderIdentity, payload.text ?? '')
        return
      }

      // Agent messages — senderIdentity is the agent bot, payload.participant is the speaker
      if (type === 'transcript_chunk') {
        handleRemoteMessage(type, payload.participant ?? senderIdentity, payload.text ?? '')
        return
      }
      if (type === 'session_transcript') {
        handleRemoteMessage(type, '', payload.transcript ?? '')
      }
    }
  }, [handleRemoteMessage])

  const isOwner = !!ownerIdentity && ownerIdentity === userName
  const isMainSpeaker = mainSpeaker === userName
  const canModerate = isOwner

  // Destructure stable callbacks so useCallback deps are simple scalars/functions
  const { broadcast, disconnect, joinRoom, mute, muteVideo, kick, toggleLocalAudio, toggleMic, toggleCam, reloadCamera, switchCamera, updateVideoQualities } = room

  // ── Room-level broadcast actions ──────────────────────────────────────────
  const changeLayout = useCallback((l: Layout) => {
    setLayout(l)
    broadcast({ type: 'layout', layout: l })
  }, [broadcast])

  const transferSpeaker = useCallback((identity: string) => {
    setMainSpeaker(identity)
    broadcast({ type: 'speaker', identity })
    updateVideoQualities(identity, room.activeSpeakers)
  }, [broadcast, updateVideoQualities, room.activeSpeakers])

  const shareLink = useCallback(() => {
    const url = roomId ? `${window.location.origin}/call/${roomId}` : window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [roomId])

  // ── Leave ──────────────────────────────────────────────────────────────────
  const { callNotes } = transcription

  const leaveRoom = useCallback(() => {
    // Ask the agent for its accumulated transcript before showing summary
    broadcast({ type: 'transcript_request' })
    if (callNotes.length > 0 || transcription.finalTranscript) {
      setShowSummary(true)
    } else {
      disconnect().then(() => router.push('/profile'))
    }
  }, [callNotes, disconnect, router, broadcast, transcription.finalTranscript])

  const confirmLeave = useCallback(async () => {
    setShowSummary(false)

    // Save transcript to DB before disconnecting
    const entries = transcription.finalTranscript
      ? null  // raw string — send as-is
      : transcription.callNotes
    const transcriptRaw = transcription.finalTranscript
      ?? transcription.callNotes.map(n => `${n.identity}: ${n.text}`).join('\n')

    if (transcriptRaw) {
      fetch('/api/call/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          transcriptRaw,
          transcriptJson: entries ?? transcription.callNotes,
          participants: room.participants.map(p => ({ identity: p.identity })),
        }),
      }).catch(() => {})
    }

    await disconnect()
    router.push('/profile')
  }, [disconnect, router, roomName, transcription, room.participants])

  // ── Sync video quality when main speaker or active speakers change ──────────
  useEffect(() => {
    if (room.connected) updateVideoQualities(mainSpeaker, room.activeSpeakers)
  }, [mainSpeaker, room.connected, room.activeSpeakers, updateVideoQualities])

  // ── Auto-join ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoJoinRoom) joinRoom()
    return () => { disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tile renderer ──────────────────────────────────────────────────────────
  const renderTile = (p: Participant, large = false, isPip = false) => {
    const noVid = p.videoMuted || (p.isLocal && !room.camEnabled)
    const audioMuted = p.audioMuted || (p.isLocal && !room.micEnabled)
    const captionText = p.isLocal
      ? transcription.liveText
      : (transcription.remoteLiveTexts[p.identity] || '')
    // Show caption on large tile OR on main speaker tile (even in PiP).
    // This ensures the big visible tile always shows active speech.
    const showCaption = captionText.trim().length > 0 && (large || p.identity === mainSpeaker)

    return (
      <div key={p.identity} className={`${styles.tile} ${p.isLocal ? styles.tileLocal : ''} ${large ? styles.tileLarge : ''} ${isPip ? styles.tilePip : ''}`}>
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

        {showCaption && (
          <div className={styles.liveCaption}>
            <span className={styles.liveCaptionDot} />
            <span>{captionText}</span>
          </div>
        )}

        {!p.isLocal && (
          <div className={styles.tileActions}>
            <button className={styles.actionBtn} onClick={() => toggleLocalAudio(p.identity)}>
              {p.localAudioMuted ? <IconVolumeOn /> : <IconVolumeOff />}
              {p.localAudioMuted ? 'Снять заглушение' : 'Заглушить у себя'}
            </button>
            {canModerate && (<>
              {p.identity !== mainSpeaker && (
                <button className={styles.actionBtn} onClick={() => transferSpeaker(p.identity)}>
                  <IconStar /> Главный
                </button>
              )}
              {!audioMuted && (
                <button className={styles.actionBtn} onClick={() => mute(p.identity)}>
                  <IconMicOff /> Запретить аудио
                </button>
              )}
              {!p.videoMuted && (
                <button className={styles.actionBtn} onClick={() => muteVideo(p.identity)}>
                  <IconCamOff /> Запретить видео
                </button>
              )}
              <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => kick(p.identity)}>
                <IconKick /> Исключить
              </button>
            </>)}
          </div>
        )}
      </div>
    )
  }

  // ── Video layout ──────────────────────────────────────────────────────────
  const mainPart = (() => {
    if (layout === 'pip' && room.participants.length === 2) {
      return room.participants.find(p => !p.isLocal) ?? room.participants[0]
    }
    return room.participants.find(p => p.identity === mainSpeaker) ?? room.participants[0]
  })()
  const sideParts = room.participants.filter(p => p !== mainPart)

  const renderVideo = () => {
    if (room.participants.length === 0) return (
      <div className={styles.waiting}><div className={styles.waitingPulse} /><p>Ожидаем участников...</p></div>
    )
    if (layout === 'pip') {
      return (
        <div className={styles.pipArea}>
          {mainPart && renderTile(mainPart, true)}
          {room.participants.length > 1 && sideParts.map((p, i) => (
            <DraggablePip key={p.identity} index={i}>{renderTile(p, false, true)}</DraggablePip>
          ))}
        </div>
      )
    }
    if (layout === 'split') return (
      <div className={styles.splitArea}>{room.participants.map(p => renderTile(p))}</div>
    )
    return (
      <div className={styles.gridArea} data-count={room.participants.length}>
        {room.participants.map(p => renderTile(p))}
      </div>
    )
  }

  // ── Notes panel ────────────────────────────────────────────────────────────
  const renderNotesPanel = () => {
    const locallyMuted = new Set(room.participants.filter(p => p.localAudioMuted).map(p => p.identity))
    const visibleNotes = callNotes.filter(n => !locallyMuted.has(n.identity))
    return (
      <div className={styles.notesPanel}>
        <div className={styles.notesPanelHeader}>
          <span>Конспект</span>
          {!transcription.browserHasSpeech && callNotes.length === 0 && (
            <span className={styles.notesSrWarning}>Нужен агент или Chrome</span>
          )}
          <button className={styles.notesPanelClose} onClick={() => setShowNotes(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className={styles.notesList}>
          {transcription.srError && (
            <p className={styles.notesSrError}>{transcription.srError}</p>
          )}
          {visibleNotes.length === 0 ? (
            <p className={styles.notesEmpty}>
              {!transcription.browserHasSpeech
                ? 'Браузер не поддерживает Speech Recognition. Используйте Chrome.'
                : transcription.srError
                ? 'Транскрипция недоступна — текст появится если подключён агент.'
                : 'Говорите — текст появится здесь...'}
            </p>
          ) : (
            visibleNotes.map((n, i) => (
              <div key={i} className={styles.noteEntry}>
                <span className={styles.noteAuthor}>{n.identity}</span>
                <span className={styles.noteText}>{n.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Summary modal ──────────────────────────────────────────────────────────
  const renderSummaryModal = () => {
    // Prefer the agent's formatted transcript (higher quality); fall back to callNotes
    const text = transcription.finalTranscript
      ?? callNotes.map(n => `${n.identity} — ${n.text}`).join('\n')
    return (
      <div className={styles.summaryOverlay}>
        <div className={styles.summaryModal}>
          <h2 className={styles.summaryTitle}>Конспект звонка</h2>
          <pre className={styles.summaryBody}>{text || 'Нет записей'}</pre>
          <div className={styles.summaryActions}>
            {text && (
              <button className={styles.pill} onClick={() => navigator.clipboard.writeText(text)}>
                <IconCopy /> Копировать
              </button>
            )}
            <button className={styles.summaryLeaveBtn} onClick={confirmLeave}>
              Выйти из звонка
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Controls bar ──────────────────────────────────────────────────────────
  const renderControls = (overlay: boolean) => (
    <div className={`${styles.controls} ${overlay ? styles.controlsOverlay : ''}`}>
      <div className={styles.ctrlLeft}>
        <button className={`${styles.pill} ${copied ? styles.pillActive : ''}`} onClick={shareLink}>
          {copied ? <IconCheck /> : <IconLink />}
          {copied ? 'Скопировано' : 'Ссылка'}
        </button>
        {isMainSpeaker && (
          <button className={styles.pill} onClick={() => changeLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])}>
            {LAYOUT_ICONS[layout]}
            {LAYOUT_LABELS[layout]}
          </button>
        )}
        <button
          className={`${styles.pill} ${showNotes ? styles.pillActive : ''}`}
          onClick={() => setShowNotes(n => !n)}
          title={!transcription.browserHasSpeech ? 'Только в Chrome' : undefined}
        >
          <IconNotes /> Конспект
        </button>
      </div>

      <div className={styles.ctrlCenter}>
        <button className={`${styles.roundBtn} ${room.micEnabled ? styles.roundOn : styles.roundOff}`} onClick={toggleMic}>
          <div className={styles.roundIcon}>{room.micEnabled ? <IconMicOn /> : <IconMicOff />}</div>
          <span className={styles.roundLabel}>{room.micEnabled ? 'Микрофон' : 'Без звука'}</span>
        </button>
        <button className={`${styles.roundBtn} ${room.camEnabled ? styles.roundOn : styles.roundOff}`} onClick={toggleCam}>
          <div className={styles.roundIcon}>{room.camEnabled ? <IconCam /> : <IconCamOff />}</div>
          <span className={styles.roundLabel}>{room.camEnabled ? 'Камера' : 'Без камеры'}</span>
        </button>
        {room.videoDevices.length > 1 && (
          <button className={styles.roundBtn} onClick={switchCamera} title="Сменить камеру">
            <div className={styles.roundIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <path d="M12 17v-6M9 14l3-3 3 3"/>
              </svg>
            </div>
            <span className={styles.roundLabel}>Камера ↕</span>
          </button>
        )}
        <button className={styles.roundBtn} onClick={reloadCamera} title="Перезагрузить камеру">
          <div className={styles.roundIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
            </svg>
          </div>
          <span className={styles.roundLabel}>Камера ↺</span>
        </button>
      </div>

      <div className={styles.ctrlRight}>
        <button className={`${styles.roundBtn} ${styles.roundLeave}`} onClick={leaveRoom}>
          <div className={styles.roundIcon}><IconPhone /></div>
          <span className={styles.roundLabel}>Завершить</span>
        </button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {!room.connected ? (
        <div className={styles.lobby}>
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyIcon}><IconVideo /></div>
            <h1 className={styles.lobbyTitle}>Видео-звонок</h1>
            <p className={styles.lobbySubtitle}>{autoJoinRoom ? `Подключаемся к «${autoJoinRoom}»...` : 'Введите название комнаты'}</p>
            <div className={styles.lobbyUser}><span className={styles.lobbyDot} />{userName}</div>
            {room.status && <p className={styles.lobbyStatus}>{room.status}</p>}
          </div>
        </div>
      ) : (
        <div className={styles.call}>
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <span className={styles.topDot} />
              <span className={styles.topRoom}>{roomName}</span>
              {room.status && <span className={styles.topStatus}>{room.status}</span>}
            </div>
            <div className={styles.topBarRight}>
              <span className={styles.topUser}>{userName}</span>
              {isOwner && <span className={styles.topOwner}><IconCrown /> Владелец</span>}
              {!isOwner && isMainSpeaker && <span className={styles.topSpeaker}><IconMicOn /> Главный</span>}
            </div>
          </div>

          <div className={styles.videoArea}>
            {renderVideo()}
            {layout === 'pip' && renderControls(true)}
            {showNotes && renderNotesPanel()}
          </div>
          {layout !== 'pip' && renderControls(false)}
        </div>
      )}

      {showSummary && renderSummaryModal()}
    </div>
  )
}
