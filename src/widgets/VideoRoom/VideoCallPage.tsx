/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Room, RoomEvent, Track } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './VideoCallPage.module.scss'

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7c3aed','#db2777','#d97706','#059669','#0284c7','#dc2626','#ea580c','#65a30d']
function avatarColor(name: string) {
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
interface Participant {
  identity: string
  isLocal: boolean
  audioMuted: boolean
  videoMuted: boolean
  audioTrackSid?: string
}

interface Props {
  userName: string
  autoJoinRoom?: string
  roomId?: string
  ownerIdentity?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoCallPage({ userName, autoJoinRoom, roomId, ownerIdentity }: Props) {
  const router = useRouter()
  const [roomName] = useState(autoJoinRoom ?? '')
  const [status, setStatus] = useState('')
  const [connected, setConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [copied, setCopied] = useState(false)
  const roomRef = useRef<Room | null>(null)

  const isOwner = !!ownerIdentity && ownerIdentity === userName

  // ── Participant state helpers ──────────────────────────────────────────────
  const upsertParticipant = useCallback((identity: string, patch: Partial<Participant> = {}) => {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.identity === identity)
      if (existing) return prev.map((p) => p.identity === identity ? { ...p, ...patch } : p)
      return [...prev, { identity, isLocal: false, audioMuted: false, videoMuted: false, ...patch }]
    })
  }, [])

  const removeParticipant = useCallback((identity: string) => {
    setParticipants((prev) => prev.filter((p) => p.identity !== identity))
  }, [])

  const attachTrack = useCallback((identity: string, track: any) => {
    if (track.kind === 'video') {
      const el = document.getElementById(`v-${identity}`) as HTMLVideoElement | null
      if (el) track.attach(el)
    } else if (track.kind === 'audio') {
      const a = track.attach() as HTMLAudioElement
      a.style.display = 'none'
      document.body.appendChild(a)
    }
  }, [])

  // ── Owner actions ──────────────────────────────────────────────────────────
  const muteParticipant = useCallback(async (identity: string, trackSid: string) => {
    await fetch('/api/livekit/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantIdentity: identity, trackSid, muted: true }),
    })
  }, [roomName])

  const kickParticipant = useCallback(async (identity: string) => {
    await fetch('/api/livekit/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantIdentity: identity }),
    })
  }, [roomName])

  const shareLink = useCallback(() => {
    const url = roomId
      ? `${window.location.origin}/call/${roomId}`
      : window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [roomId])

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
        upsertParticipant(participant.identity)
        attachTrack(participant.identity, track)
        if (track.kind === 'audio') upsertParticipant(participant.identity, { audioTrackSid: pub.trackSid })
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => track.detach())
      room.on(RoomEvent.ParticipantConnected, (p: any) => {
        upsertParticipant(p.identity)
        setStatus(`${p.identity} подключился`)
        setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
        removeParticipant(p.identity)
        setStatus(`${p.identity} отключился`)
        setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.TrackMuted, (pub: any, p: any) => {
        if (pub.kind === 'audio') upsertParticipant(p.identity, { audioMuted: true })
        if (pub.kind === 'video') upsertParticipant(p.identity, { videoMuted: true })
      })
      room.on(RoomEvent.TrackUnmuted, (pub: any, p: any) => {
        if (pub.kind === 'audio') upsertParticipant(p.identity, { audioMuted: false })
        if (pub.kind === 'video') upsertParticipant(p.identity, { videoMuted: false })
      })
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false)
        setParticipants([])
        setStatus('')
        roomRef.current = null
      })

      await room.connect(livekitUrl, data.token)

      // add local participant
      upsertParticipant(room.localParticipant.identity, { isLocal: true })

      // add already-connected remote participants
      room.remoteParticipants.forEach((p) => {
        upsertParticipant(p.identity)
        p.trackPublications.forEach((pub) => {
          if (pub.track) {
            attachTrack(p.identity, pub.track)
            if (pub.kind === 'audio') upsertParticipant(p.identity, { audioTrackSid: pub.trackSid })
          }
        })
      })

      await room.localParticipant.enableCameraAndMicrophone()
      const camTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
      if (camTrack) setTimeout(() => attachTrack(room.localParticipant.identity, camTrack), 150)

      setStatus('')
      setConnected(true)
    } catch (e: any) {
      setStatus('Ошибка: ' + e.message)
    }
  }, [roomName, userName, upsertParticipant, removeParticipant, attachTrack])

  const leaveRoom = useCallback(async () => {
    await roomRef.current?.disconnect()
    roomRef.current = null
    setConnected(false)
    setParticipants([])
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

  // ── Layout ─────────────────────────────────────────────────────────────────
  // featured = owner (when current user is NOT the owner)
  const ownerPart = ownerIdentity ? participants.find((p) => p.identity === ownerIdentity) : null
  const featuredPart = !isOwner ? ownerPart ?? null : null
  const sideParts = featuredPart
    ? participants.filter((p) => p.identity !== ownerIdentity)
    : participants

  // ── Tile ───────────────────────────────────────────────────────────────────
  const renderTile = (p: Participant, large = false) => {
    const showAvatar = p.videoMuted || (p.isLocal && !camEnabled)
    return (
      <div key={p.identity} className={`${styles.tile} ${p.isLocal ? styles.tileLocal : ''} ${large ? styles.tileLarge : ''}`}>
        <video id={`v-${p.identity}`} className={styles.tileVideo} autoPlay playsInline muted={p.isLocal} />
        {showAvatar && (
          <div className={styles.noCamera}>
            <NameAvatar name={p.identity} />
          </div>
        )}
        <div className={styles.tileMeta}>
          <span className={styles.tileName}>{p.identity}</span>
          <div className={styles.tileBadges}>
            {p.isLocal && <span className={styles.tileYou}>ВЫ</span>}
            {ownerIdentity && p.identity === ownerIdentity && <span className={styles.tileOwner}>👑</span>}
          </div>
        </div>
        {p.audioMuted && <span className={styles.mutedBadge}>🔇</span>}

        {/* owner controls */}
        {isOwner && !p.isLocal && (
          <div className={styles.ownerControls}>
            {!p.audioMuted && p.audioTrackSid && (
              <button
                className={styles.ownerBtn}
                onClick={() => muteParticipant(p.identity, p.audioTrackSid!)}
                title="Заглушить"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Заглушить
              </button>
            )}
            <button
              className={`${styles.ownerBtn} ${styles.ownerBtnKick}`}
              onClick={() => kickParticipant(p.identity)}
              title="Исключить"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M16 17l5-5-5-5M21 12H9M13 22H5a2 2 0 01-2-2V4a2 2 0 012-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Исключить
            </button>
          </div>
        )}
      </div>
    )
  }

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
              {isOwner && <span className={styles.ownerBadge}>👑 Владелец</span>}
            </div>
          </div>

          {/* Video */}
          {featuredPart ? (
            <div className={styles.speakerLayout}>
              <div className={styles.featured}>
                {renderTile(featuredPart, true)}
              </div>
              {sideParts.length > 0 && (
                <div className={styles.sideStrip}>
                  {sideParts.map((p) => renderTile(p, false))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.grid} data-count={participants.length}>
              {participants.length === 0 ? (
                <div className={styles.waiting}>
                  <div className={styles.waitingPulse} />
                  <p>Ожидаем участников...</p>
                </div>
              ) : participants.map((p) => renderTile(p))}
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <div className={styles.controlsLeft}>
              <button className={`${styles.roundBtn} ${copied ? styles.roundBtnCopied : ''}`} onClick={shareLink}>
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
              <button className={`${styles.roundBtn} ${micEnabled ? styles.roundBtnOn : styles.roundBtnOff}`} onClick={toggleMic}>
                <div className={styles.roundBtnIcon}>
                  {micEnabled
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </div>
                <span className={styles.roundBtnLabel}>{micEnabled ? 'Микрофон' : 'Без звука'}</span>
              </button>

              <button className={`${styles.roundBtn} ${camEnabled ? styles.roundBtnOn : styles.roundBtnOff}`} onClick={toggleCam}>
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
