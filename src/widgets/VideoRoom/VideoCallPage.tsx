/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Room, RoomEvent, Track } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './VideoCallPage.module.scss'

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7c3aed','#db2777','#d97706','#059669','#0284c7','#dc2626','#ea580c','#65a30d']
function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function NameAvatar({ name }: { name: string }) {
  return (
    <div className={styles.nameAvatar} style={{ background: avatarColor(name) }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── TURN ──────────────────────────────────────────────────────────────────────
const TURN_CONFIG = {
  username: 'c3f73daa4d6f7b1a2a77aa6c',
  credential: 'xXcp3uLUlF8L/W8h',
  urls: [
    'stun:stun.relay.metered.ca:80',
    'turn:global.relay.metered.ca:80',
    'turn:global.relay.metered.ca:80?transport=tcp',
    'turn:global.relay.metered.ca:443',
    'turns:global.relay.metered.ca:443?transport=tcp',
  ],
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParticipantState {
  identity: string
  isLocal: boolean
  audioMuted: boolean
  videoMuted: boolean
  audioTrackSid?: string
}

interface VideoCallPageProps {
  userName: string
  autoJoinRoom?: string
  ownerIdentity?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoCallPage({ userName, autoJoinRoom, ownerIdentity }: VideoCallPageProps) {
  const router = useRouter()
  const [roomName, setRoomName] = useState(autoJoinRoom ?? '')
  const [status, setStatus] = useState('')
  const [connected, setConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [participants, setParticipants] = useState<ParticipantState[]>([])
  const [copied, setCopied] = useState(false)

  const roomRef = useRef<Room | null>(null)
  const isOwner = !!ownerIdentity && ownerIdentity === userName

  // ── Helpers ────────────────────────────────────────────────────────────────
  const shareLink = useCallback(() => {
    const url = `${window.location.origin}/call/${encodeURIComponent(roomName.trim())}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [roomName])

  const addParticipant = useCallback((identity: string, isLocal = false) => {
    setParticipants((prev) => {
      if (prev.find((p) => p.identity === identity)) return prev
      return [...prev, { identity, isLocal, audioMuted: false, videoMuted: false }]
    })
  }, [])

  const removeParticipant = useCallback((identity: string) => {
    setParticipants((prev) => prev.filter((p) => p.identity !== identity))
  }, [])

  const patchParticipant = useCallback((identity: string, patch: Partial<ParticipantState>) => {
    setParticipants((prev) => prev.map((p) => (p.identity === identity ? { ...p, ...patch } : p)))
  }, [])

  const attachTrack = useCallback((identity: string, track: any) => {
    if (track.kind === 'video') {
      const el = document.getElementById(`vcall-video-${identity}`) as HTMLVideoElement | null
      if (el) track.attach(el)
    } else if (track.kind === 'audio') {
      const a = track.attach() as HTMLAudioElement
      a.style.display = 'none'
      document.body.appendChild(a)
    }
  }, [])

  const muteParticipant = useCallback(async (identity: string, trackSid: string) => {
    await fetch('/api/livekit/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomName.trim(), participantIdentity: identity, trackSid, muted: true }),
    })
  }, [roomName])

  // ── Join ───────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    if (!roomName.trim()) return
    setStatus('Подключаемся...')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://goodworker-api.up.railway.app'
      const res = await fetch(`${backendUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), participantName: userName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage ?? data.error ?? 'Token error')

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app'

      const room = new Room({
        rtcConfig: { iceServers: [{ ...TURN_CONFIG }], iceTransportPolicy: 'all' },
      } as any)
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: any, pub: any, participant: any) => {
        addParticipant(participant.identity)
        attachTrack(participant.identity, track)
        if (track.kind === 'audio') {
          patchParticipant(participant.identity, { audioTrackSid: pub.trackSid })
        }
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => track.detach())
      room.on(RoomEvent.ParticipantConnected, (p: any) => {
        addParticipant(p.identity)
        setStatus(`${p.identity} подключился`)
        setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
        removeParticipant(p.identity)
        setStatus(`${p.identity} отключился`)
        setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.TrackMuted, (pub: any, p: any) => {
        if (pub.kind === 'audio') patchParticipant(p.identity, { audioMuted: true })
        if (pub.kind === 'video') patchParticipant(p.identity, { videoMuted: true })
      })
      room.on(RoomEvent.TrackUnmuted, (pub: any, p: any) => {
        if (pub.kind === 'audio') patchParticipant(p.identity, { audioMuted: false })
        if (pub.kind === 'video') patchParticipant(p.identity, { videoMuted: false })
      })
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false)
        setParticipants([])
        setStatus('')
        roomRef.current = null
      })

      await room.connect(livekitUrl, data.token)
      setStatus('')

      addParticipant(room.localParticipant.identity, true)
      await room.localParticipant.enableCameraAndMicrophone()

      const camTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
      if (camTrack) setTimeout(() => attachTrack(room.localParticipant.identity, camTrack), 150)

      setConnected(true)
    } catch (e: any) {
      setStatus('Ошибка: ' + e.message)
    }
  }, [roomName, userName, addParticipant, removeParticipant, patchParticipant, attachTrack])

  const leaveRoom = useCallback(async () => {
    await roomRef.current?.disconnect()
    roomRef.current = null
    setConnected(false)
    setParticipants([])
    setStatus('')
    router.push('/call')
  }, [router])

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return
    const next = !micEnabled
    await roomRef.current.localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
  }, [micEnabled])

  const toggleCam = useCallback(async () => {
    if (!roomRef.current) return
    const next = !camEnabled
    await roomRef.current.localParticipant.setCameraEnabled(next)
    setCamEnabled(next)
  }, [camEnabled])

  useEffect(() => {
    if (autoJoinRoom) joinRoom()
    return () => { roomRef.current?.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Layout logic ───────────────────────────────────────────────────────────
  const ownerPart = ownerIdentity ? participants.find((p) => p.identity === ownerIdentity) : null
  const localPart = participants.find((p) => p.isLocal)
  const otherParticipants = participants.filter((p) =>
    p.identity !== ownerIdentity && !(ownerIdentity ? false : p.isLocal)
  )
  // speaker-view: owner is featured (large), others are small — unless current user IS the owner
  const featuredPart = !isOwner && ownerPart ? ownerPart : null
  const smallParticipants = featuredPart
    ? participants.filter((p) => p.identity !== ownerPart?.identity)
    : participants

  // ── Tile renderer ──────────────────────────────────────────────────────────
  const renderTile = (p: ParticipantState, large = false) => (
    <div
      key={p.identity}
      className={`${styles.tile} ${p.isLocal ? styles.tileLocal : ''} ${large ? styles.tileLarge : ''}`}
    >
      <video
        id={`vcall-video-${p.identity}`}
        className={styles.tileVideo}
        autoPlay playsInline
        muted={p.isLocal}
      />
      {(p.videoMuted || (!p.isLocal && !camEnabled && p.isLocal)) && (
        <div className={styles.noCamera}>
          <NameAvatar name={p.identity} />
        </div>
      )}
      {/* local cam off */}
      {p.isLocal && !camEnabled && (
        <div className={styles.noCamera}>
          <NameAvatar name={p.identity} />
        </div>
      )}
      <div className={styles.tileMeta}>
        <span className={styles.tileName}>{p.identity}</span>
        {p.isLocal && <span className={styles.tileYou}>ВЫ</span>}
        {ownerIdentity && p.identity === ownerIdentity && !p.isLocal && (
          <span className={styles.tileOwner}>ВЛАДЕЛЕЦ</span>
        )}
      </div>
      {p.audioMuted && <span className={styles.mutedBadge}>🔇</span>}
      {/* mute button — visible for owner on remote participants */}
      {isOwner && !p.isLocal && p.audioTrackSid && !p.audioMuted && (
        <button
          className={styles.muteBadgeBtn}
          onClick={() => muteParticipant(p.identity, p.audioTrackSid!)}
          title="Заглушить"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zM19 10v2a7 7 0 01-14 0v-2"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {!connected ? (
        <div className={styles.lobby}>
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className={styles.lobbyTitle}>Видео-звонок</h1>
            <p className={styles.lobbySubtitle}>
              {autoJoinRoom ? `Подключаемся к «${autoJoinRoom}»...` : 'Введите название комнаты'}
            </p>
            <div className={styles.lobbyUser}>
              <span className={styles.lobbyUserDot} />
              <span>{userName}</span>
            </div>
            {!autoJoinRoom && (
              <>
                <div className={styles.lobbyField}>
                  <label className={styles.lobbyLabel}>Комната</label>
                  <div className={styles.lobbyInputRow}>
                    <input
                      className={styles.lobbyInput}
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Название комнаты..."
                      onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                      autoFocus
                    />
                    <button className={styles.lobbyShareBtn} onClick={shareLink} disabled={!roomName.trim()}>
                      {copied
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      }
                    </button>
                  </div>
                  {copied && <span className={styles.copiedHint}>Ссылка скопирована!</span>}
                </div>
                <button className={styles.lobbyBtn} onClick={joinRoom} disabled={!roomName.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Войти в комнату
                </button>
              </>
            )}
            {status && <p className={styles.lobbyStatus}>{status}</p>}
          </div>
        </div>
      ) : (
        <div className={styles.call}>
          {/* Top bar */}
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <span className={styles.topBarDot} />
              <span className={styles.topBarRoom}>{roomName}</span>
              {status && <span className={styles.topBarStatus}>{status}</span>}
            </div>
            <div className={styles.topBarRight}>
              <span className={styles.topBarUser}>{userName}</span>
              {isOwner && <span className={styles.ownerBadge}>Владелец</span>}
            </div>
          </div>

          {/* Video area */}
          {featuredPart ? (
            /* Speaker view: owner large, others strip */
            <div className={styles.speakerView}>
              <div className={styles.featuredArea}>
                {renderTile(featuredPart, true)}
              </div>
              {smallParticipants.length > 0 && (
                <div className={styles.stripArea}>
                  {smallParticipants.map((p) => renderTile(p, false))}
                </div>
              )}
            </div>
          ) : (
            /* Grid view */
            <div className={styles.grid} data-count={participants.length}>
              {participants.length === 0 ? (
                <div className={styles.waiting}>
                  <div className={styles.waitingPulse} />
                  <p>Ожидаем участников...</p>
                </div>
              ) : (
                participants.map((p) => renderTile(p))
              )}
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.controlsLeft}>
              <button
                className={`${styles.roundBtn} ${copied ? styles.roundBtnCopied : ''}`}
                onClick={shareLink}
              >
                <div className={styles.roundBtnIcon}>
                  {copied
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </div>
                <span className={styles.roundBtnLabel}>{copied ? 'Скопировано' : 'Поделиться'}</span>
              </button>
            </div>

            <div className={styles.controlsCenter}>
              <button
                className={`${styles.roundBtn} ${micEnabled ? styles.roundBtnOn : styles.roundBtnOff}`}
                onClick={toggleMic}
              >
                <div className={styles.roundBtnIcon}>
                  {micEnabled
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </div>
                <span className={styles.roundBtnLabel}>{micEnabled ? 'Микрофон' : 'Без звука'}</span>
              </button>

              <button
                className={`${styles.roundBtn} ${camEnabled ? styles.roundBtnOn : styles.roundBtnOff}`}
                onClick={toggleCam}
              >
                <div className={styles.roundBtnIcon}>
                  {camEnabled
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.5 10.5A2 2 0 0013 13m-7-5v9a2 2 0 002 2h7M21 8.723v6.554a1 1 0 01-1.447.894L15 14V10l4.553-2.276A1 1 0 0121 8.723z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </div>
                <span className={styles.roundBtnLabel}>{camEnabled ? 'Камера' : 'Без камеры'}</span>
              </button>
            </div>

            <div className={styles.controlsRight}>
              <button className={`${styles.roundBtn} ${styles.roundBtnLeave}`} onClick={leaveRoom}>
                <div className={styles.roundBtnIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.45-3.45 19.79 19.79 0 01-3.07-8.67A2 2 0 014.34 3h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 10.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="23" y1="1" x2="1" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className={styles.roundBtnLabel}>Завершить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
