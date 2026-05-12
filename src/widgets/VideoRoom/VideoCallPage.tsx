/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Room, RoomEvent, Track } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './VideoCallPage.module.scss'

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCrown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M2 20h20M4 20l2-10 6 4 4-7 4 7 6-4-2 10H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IconMicOff = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconMicOn = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
)
const IconVolumeOff = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M3 3l18 18M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconVolumeOn = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Avatar ────────────────────────────────────────────────────────────────────
const COLORS = ['#7c3aed','#db2777','#d97706','#059669','#0284c7','#dc2626','#ea580c','#65a30d']
function nameColor(n: string) {
  let h = 0; for (const c of n) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return COLORS[Math.abs(h) % COLORS.length]
}
function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) return <img className={styles.avatarImg} src={url} alt={name} />
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

// ── TURN ──────────────────────────────────────────────────────────────────────
const TURN = {
  username: 'c3f73daa4d6f7b1a2a77aa6c', credential: 'xXcp3uLUlF8L/W8h',
  urls: ['stun:stun.relay.metered.ca:80','turn:global.relay.metered.ca:80','turn:global.relay.metered.ca:80?transport=tcp','turn:global.relay.metered.ca:443','turns:global.relay.metered.ca:443?transport=tcp'],
}

type Layout = 'pip' | 'split' | 'grid'
const LAYOUTS: Layout[] = ['pip', 'split', 'grid']
const LAYOUT_LABELS: Record<Layout, string> = { pip: 'PiP', split: 'Рядом', grid: 'Сетка' }
const LAYOUT_ICONS: Record<Layout, React.ReactNode> = {
  pip: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="10" width="8" height="6" rx="1" fill="currentColor" opacity=".5"/></svg>,
  split: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="9" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="9" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="2" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg>,
}

interface Participant {
  identity: string; isLocal: boolean
  audioMuted: boolean; videoMuted: boolean
  localAudioMuted: boolean
  avatarUrl?: string
}
interface Props {
  userName: string; autoJoinRoom?: string; roomId?: string; ownerIdentity?: string; localAvatarUrl?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoCallPage({ userName, autoJoinRoom, roomId, ownerIdentity, localAvatarUrl }: Props) {
  const router = useRouter()
  const [roomName] = useState(autoJoinRoom ?? '')
  const [status, setStatus] = useState('')
  const [connected, setConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [copied, setCopied] = useState(false)
  const [layout, setLayout] = useState<Layout>('pip')
  const [mainSpeaker, setMainSpeaker] = useState<string>(ownerIdentity ?? userName)
  const roomRef = useRef<Room | null>(null)
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const enc = useRef(new TextEncoder())
  const dec = useRef(new TextDecoder())

  const isOwner = !!ownerIdentity && ownerIdentity === userName
  const isMainSpeaker = mainSpeaker === userName
  // Moderation (mute/kick/transfer): owner or current main speaker
  const canModerate = isOwner || isMainSpeaker

  // ── Broadcast helpers ──────────────────────────────────────────────────────
  const broadcast = useCallback((msg: object) => {
    try {
      roomRef.current?.localParticipant.publishData(enc.current.encode(JSON.stringify(msg)), { reliable: true })
    } catch {}
  }, [])

  const changeLayout = useCallback((l: Layout) => {
    setLayout(l)
    broadcast({ type: 'layout', layout: l })
  }, [broadcast])

  const transferSpeaker = useCallback((identity: string) => {
    setMainSpeaker(identity)
    broadcast({ type: 'speaker', identity })
  }, [broadcast])

  // ── Participants helpers ───────────────────────────────────────────────────
  const upsert = useCallback((identity: string, patch: Partial<Participant> = {}) => {
    setParticipants(prev => {
      const ex = prev.find(p => p.identity === identity)
      if (ex) return prev.map(p => p.identity === identity ? { ...p, ...patch } : p)
      return [...prev, { identity, isLocal: false, audioMuted: false, videoMuted: false, localAudioMuted: false, ...patch }]
    })
  }, [])

  const remove = useCallback((identity: string) => {
    setParticipants(prev => prev.filter(p => p.identity !== identity))
  }, [])

  const attachTrack = useCallback((identity: string, track: any) => {
    if (track.kind === Track.Kind.Video || track.kind === 'video') {
      const el = document.getElementById(`v-${identity}`) as HTMLVideoElement | null
      if (el) track.attach(el)
    } else if (track.kind === Track.Kind.Audio || track.kind === 'audio') {
      const a = track.attach() as HTMLAudioElement
      a.style.display = 'none'
      document.body.appendChild(a)
      audioElsRef.current.set(identity, a)
    }
  }, [])

  const fetchAvatar = useCallback(async (identity: string) => {
    try {
      const res = await fetch(`/api/users/avatar?identity=${encodeURIComponent(identity)}`)
      const { avatarUrl } = await res.json()
      if (avatarUrl) upsert(identity, { avatarUrl })
    } catch {}
  }, [upsert])

  // ── Owner/speaker actions ──────────────────────────────────────────────────
  const mute = useCallback(async (identity: string) => {
    // Get the audio trackSid directly from the room object at call time
    let trackSid: string | undefined
    if (roomRef.current) {
      roomRef.current.remoteParticipants.forEach(p => {
        if (p.identity === identity) {
          const audioPub = p.getTrackPublication(Track.Source.Microphone)
          if (audioPub?.trackSid) trackSid = audioPub.trackSid
        }
      })
    }
    if (!trackSid) return
    upsert(identity, { audioMuted: true }) // optimistic
    try {
      const res = await fetch('/api/livekit/mute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantIdentity: identity, trackSid, muted: true }),
      })
      if (!res.ok) upsert(identity, { audioMuted: false })
    } catch { upsert(identity, { audioMuted: false }) }
  }, [roomName, upsert])

  const kick = useCallback(async (identity: string) => {
    await fetch('/api/livekit/kick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantIdentity: identity }) })
  }, [roomName])

  const toggleLocalAudio = useCallback((identity: string) => {
    const el = audioElsRef.current.get(identity)
    if (!el) return
    el.muted = !el.muted
    upsert(identity, { localAudioMuted: el.muted })
  }, [upsert])

  const shareLink = useCallback(() => {
    const url = roomId ? `${window.location.origin}/call/${roomId}` : window.location.href
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }, [roomId])

  // ── Join ───────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    if (!roomName.trim()) return
    setStatus('Подключаемся...')
    try {
      const be = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://goodworker-api.up.railway.app'
      const res = await fetch(`${be}/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), participantName: userName }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage ?? data.error ?? 'Token error')

      const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app'
      // adaptiveStream + dynacast handle quality scaling for many participants
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        rtcConfig: { iceServers: [{ ...TURN }], iceTransportPolicy: 'all' },
      } as any)
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, p: any) => {
        upsert(p.identity)
        attachTrack(p.identity, track)
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => track.detach())
      room.on(RoomEvent.ParticipantConnected, (p: any) => {
        upsert(p.identity)
        fetchAvatar(p.identity)
        setStatus(`${p.identity} подключился`); setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
        audioElsRef.current.delete(p.identity)
        remove(p.identity); setStatus(`${p.identity} отключился`); setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.TrackMuted, (pub: any, p: any) => {
        if (pub.kind === Track.Kind.Audio || pub.kind === 'audio') upsert(p.identity, { audioMuted: true })
        if (pub.kind === Track.Kind.Video || pub.kind === 'video') upsert(p.identity, { videoMuted: true })
      })
      room.on(RoomEvent.TrackUnmuted, (pub: any, p: any) => {
        if (pub.kind === Track.Kind.Audio || pub.kind === 'audio') upsert(p.identity, { audioMuted: false })
        if (pub.kind === Track.Kind.Video || pub.kind === 'video') upsert(p.identity, { videoMuted: false })
      })
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false); setParticipants([]); setStatus(''); roomRef.current = null
      })
      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const msg = JSON.parse(dec.current.decode(payload))
          if (msg.type === 'layout') setLayout(msg.layout)
          if (msg.type === 'speaker') setMainSpeaker(msg.identity)
        } catch {}
      })

      await room.connect(lkUrl, data.token)
      upsert(room.localParticipant.identity, { isLocal: true, avatarUrl: localAvatarUrl })
      room.remoteParticipants.forEach(p => {
        upsert(p.identity)
        fetchAvatar(p.identity)
        p.trackPublications.forEach(pub => {
          if (pub.track) attachTrack(p.identity, pub.track)
        })
      })
      await room.localParticipant.enableCameraAndMicrophone()
      const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
      if (cam) setTimeout(() => attachTrack(room.localParticipant.identity, cam), 150)
      setStatus(''); setConnected(true)
    } catch (e: any) { setStatus('Ошибка: ' + e.message) }
  }, [roomName, userName, localAvatarUrl, upsert, remove, attachTrack, fetchAvatar])

  const leaveRoom = useCallback(async () => {
    await roomRef.current?.disconnect(); roomRef.current = null
    setConnected(false); setParticipants([]); router.push('/call')
  }, [router])

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return
    const next = !micEnabled
    await roomRef.current.localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
    upsert(userName, { audioMuted: !next })
  }, [micEnabled, upsert, userName])

  const toggleCam = useCallback(async () => {
    if (!roomRef.current) return
    const next = !camEnabled
    await roomRef.current.localParticipant.setCameraEnabled(next)
    setCamEnabled(next)
    upsert(userName, { videoMuted: !next })
  }, [camEnabled, upsert, userName])

  useEffect(() => {
    if (autoJoinRoom) joinRoom()
    return () => { roomRef.current?.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tile renderer ──────────────────────────────────────────────────────────
  const renderTile = (p: Participant, large = false, isPip = false) => {
    const noVid = p.videoMuted || (p.isLocal && !camEnabled)
    const audioMuted = p.audioMuted || (p.isLocal && !micEnabled)
    return (
      <div key={p.identity} className={`${styles.tile} ${p.isLocal ? styles.tileLocal : ''} ${large ? styles.tileLarge : ''} ${isPip ? styles.tilePip : ''}`}>
        <video id={`v-${p.identity}`} className={styles.video} autoPlay playsInline muted={p.isLocal} />
        {noVid && <div className={styles.noVideo}><Avatar name={p.identity} url={p.avatarUrl} /></div>}
        <div className={styles.tileMeta}>
          <span className={styles.tileName}>{p.identity}</span>
          <div className={styles.tileBadges}>
            {p.isLocal && <span className={styles.badgeYou}>ВЫ</span>}
            {/* Crown follows mainSpeaker, not ownerIdentity */}
            {p.identity === mainSpeaker && <span className={styles.badgeOwner}><IconCrown /></span>}
          </div>
        </div>
        {audioMuted && <span className={styles.mutedIcon}><IconMicOff /></span>}
        {p.localAudioMuted && <span className={styles.localMutedIcon}><IconVolumeOff /></span>}

        {/* Tile actions shown on hover for all non-local tiles */}
        {!p.isLocal && (
          <div className={styles.tileActions}>
            {/* Local audio toggle — available to everyone */}
            <button className={styles.actionBtn} onClick={() => toggleLocalAudio(p.identity)}>
              {p.localAudioMuted ? <IconVolumeOn /> : <IconVolumeOff />}
              {p.localAudioMuted ? 'Вкл. аудио' : 'Откл. аудио'}
            </button>

            {/* Moderation — owner or main speaker only */}
            {canModerate && (<>
              {p.identity !== mainSpeaker && (
                <button className={styles.actionBtn} onClick={() => transferSpeaker(p.identity)}>
                  <IconStar /> Главный
                </button>
              )}
              {!audioMuted && (
                <button className={styles.actionBtn} onClick={() => mute(p.identity)}>
                  <IconMicOff /> Заглушить
                </button>
              )}
              <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => kick(p.identity)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M16 17l5-5-5-5M21 12H9M13 22H5a2 2 0 01-2-2V4a2 2 0 012-2h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Исключить
              </button>
            </>)}
          </div>
        )}
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  // In 1-on-1 pip mode always show the remote participant large
  const mainPart = (() => {
    if (layout === 'pip' && participants.length === 2) {
      return participants.find(p => !p.isLocal) ?? participants[0]
    }
    return participants.find(p => p.identity === mainSpeaker) ?? participants[0]
  })()
  const sideParts = participants.filter(p => p !== mainPart)

  const renderVideo = () => {
    if (participants.length === 0) return (
      <div className={styles.waiting}><div className={styles.waitingPulse} /><p>Ожидаем участников...</p></div>
    )
    if (layout === 'pip') {
      return (
        <div className={styles.pipArea}>
          {mainPart && renderTile(mainPart, true)}
          {participants.length > 1 && sideParts.map((p, i) => (
            <DraggablePip key={p.identity} index={i}>
              {renderTile(p, false, true)}
            </DraggablePip>
          ))}
        </div>
      )
    }
    if (layout === 'split') return (
      <div className={styles.splitArea}>{participants.map(p => renderTile(p))}</div>
    )
    return (
      <div className={styles.gridArea} data-count={participants.length}>
        {participants.map(p => renderTile(p))}
      </div>
    )
  }

  // ── Controls bar ──────────────────────────────────────────────────────────
  const renderControls = (overlay: boolean) => (
    <div className={`${styles.controls} ${overlay ? styles.controlsOverlay : ''}`}>
      <div className={styles.ctrlLeft}>
        <button className={`${styles.pill} ${copied ? styles.pillActive : ''}`} onClick={shareLink}>
          {copied
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
          {copied ? 'Скопировано' : 'Ссылка'}
        </button>

        {/* Layout change — main speaker only */}
        {isMainSpeaker && (
          <button className={styles.pill} onClick={() => changeLayout(LAYOUTS[(LAYOUTS.indexOf(layout) + 1) % LAYOUTS.length])}>
            {LAYOUT_ICONS[layout]}
            {LAYOUT_LABELS[layout]}
          </button>
        )}
      </div>

      <div className={styles.ctrlCenter}>
        <button className={`${styles.roundBtn} ${micEnabled ? styles.roundOn : styles.roundOff}`} onClick={toggleMic}>
          <div className={styles.roundIcon}>
            {micEnabled
              ? <IconMicOn />
              : <IconMicOff />
            }
          </div>
          <span className={styles.roundLabel}>{micEnabled ? 'Микрофон' : 'Без звука'}</span>
        </button>

        <button className={`${styles.roundBtn} ${camEnabled ? styles.roundOn : styles.roundOff}`} onClick={toggleCam}>
          <div className={styles.roundIcon}>
            {camEnabled
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.5 10.5A2 2 0 0013 13m-7-5v9a2 2 0 002 2h7M21 8.723v6.554a1 1 0 01-1.447.894L15 14V10l4.553-2.276A1 1 0 0121 8.723z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </div>
          <span className={styles.roundLabel}>{camEnabled ? 'Камера' : 'Без камеры'}</span>
        </button>
      </div>

      <div className={styles.ctrlRight}>
        <button className={`${styles.roundBtn} ${styles.roundLeave}`} onClick={leaveRoom}>
          <div className={styles.roundIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.45-3.45 19.79 19.79 0 01-3.07-8.67A2 2 0 014.34 3h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 10.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="23" y1="1" x2="1" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className={styles.roundLabel}>Завершить</span>
        </button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {!connected ? (
        <div className={styles.lobby}>
          <div className={styles.lobbyCard}>
            <div className={styles.lobbyIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className={styles.lobbyTitle}>Видео-звонок</h1>
            <p className={styles.lobbySubtitle}>{autoJoinRoom ? `Подключаемся к «${autoJoinRoom}»...` : 'Введите название комнаты'}</p>
            <div className={styles.lobbyUser}><span className={styles.lobbyDot} />{userName}</div>
            {status && <p className={styles.lobbyStatus}>{status}</p>}
          </div>
        </div>
      ) : (
        <div className={styles.call}>
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <span className={styles.topDot} />
              <span className={styles.topRoom}>{roomName}</span>
              {status && <span className={styles.topStatus}>{status}</span>}
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
          </div>
          {layout !== 'pip' && renderControls(false)}
        </div>
      )}
    </div>
  )
}
