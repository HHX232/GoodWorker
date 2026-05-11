'use client'

import { Room, RoomEvent, Track } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './VideoRoom.module.scss'

interface ParticipantState {
  identity: string
  isLocal: boolean
  audioMuted: boolean
}

interface VideoRoomProps {
  defaultName: string
}

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

export default function VideoRoom({ defaultName }: VideoRoomProps) {
  const [roomName, setRoomName] = useState('')
  const [status, setStatus] = useState('')
  const [connected, setConnected] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [participants, setParticipants] = useState<ParticipantState[]>([])

  const roomRef = useRef<Room | null>(null)

  const setParticipant = useCallback((identity: string, patch: Partial<ParticipantState>) => {
    setParticipants((prev) =>
      prev.map((p) => (p.identity === identity ? { ...p, ...patch } : p))
    )
  }, [])

  const addParticipant = useCallback((identity: string, isLocal = false) => {
    setParticipants((prev) => {
      if (prev.find((p) => p.identity === identity)) return prev
      return [...prev, { identity, isLocal, audioMuted: false }]
    })
  }, [])

  const removeParticipant = useCallback((identity: string) => {
    setParticipants((prev) => prev.filter((p) => p.identity !== identity))
  }, [])

  const attachTrack = useCallback((identity: string, track: any) => {
    if (track.kind === 'video') {
      const el = document.getElementById(`video-${identity}`) as HTMLVideoElement | null
      if (el) track.attach(el)
    } else if (track.kind === 'audio') {
      const audioEl = track.attach()
      audioEl.style.display = 'none'
      document.body.appendChild(audioEl)
    }
  }, [])

  const joinRoom = useCallback(async () => {
    if (!roomName.trim()) return

    setStatus('Получаем токен...')
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://goodworker-api.up.railway.app'
      const res = await fetch(`${backendUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), participantName: defaultName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage ?? data.error ?? 'Token error')

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app'

      // rtcConfig not in v2 types but accepted at runtime
      const room = new Room({
        rtcConfig: {
          iceServers: [{ ...TURN_CONFIG }],
          iceTransportPolicy: 'all',
        },
      } as any)
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: any, _: any, participant: any) => {
        addParticipant(participant.identity)
        attachTrack(participant.identity, track)
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        track.detach()
      })
      room.on(RoomEvent.ParticipantConnected, (participant: any) => {
        addParticipant(participant.identity)
        setStatus(`${participant.identity} подключился`)
      })
      room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
        removeParticipant(participant.identity)
        setStatus(`${participant.identity} отключился`)
      })
      room.on(RoomEvent.TrackMuted, (pub: any, participant: any) => {
        if (pub.kind === 'audio') setParticipant(participant.identity, { audioMuted: true })
      })
      room.on(RoomEvent.TrackUnmuted, (pub: any, participant: any) => {
        if (pub.kind === 'audio') setParticipant(participant.identity, { audioMuted: false })
      })
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false)
        setParticipants([])
        setStatus('Вы покинули комнату')
        roomRef.current = null
      })

      setStatus('Подключаемся...')
      await room.connect(livekitUrl, data.token)
      setStatus(`В комнате: ${room.name}`)

      addParticipant(room.localParticipant.identity, true)
      await room.localParticipant.enableCameraAndMicrophone()

      const camTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
      if (camTrack) {
        setTimeout(() => attachTrack(room.localParticipant.identity, camTrack), 150)
      }

      setConnected(true)
    } catch (e: any) {
      setStatus('Ошибка: ' + e.message)
    }
  }, [roomName, defaultName, addParticipant, removeParticipant, setParticipant, attachTrack])

  const leaveRoom = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect()
      roomRef.current = null
    }
    setConnected(false)
    setParticipants([])
    setStatus('Вы покинули комнату')
  }, [])

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
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
    }
  }, [])

  const localPart = participants.find((p) => p.isLocal)
  const remoteParticipants = participants.filter((p) => !p.isLocal)

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <h3 className={styles.headerTitle}>Видео-комната</h3>
        {status && <span className={styles.statusBadge}>{status}</span>}
      </div>

      {!connected ? (
        <div className={styles.joinPane}>
          <div className={styles.joinField}>
            <label className={styles.joinLabel}>Название комнаты</label>
            <input
              className={styles.joinInput}
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Введите название комнаты..."
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            />
          </div>
          <button className={styles.joinBtn} onClick={joinRoom} disabled={!roomName.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Войти в комнату
          </button>
        </div>
      ) : (
        <div className={styles.roomPane}>
          <div className={styles.grid} data-count={participants.length}>
            {localPart && (
              <div className={`${styles.tile} ${styles.tileLocal}`}>
                <video
                  id={`video-${localPart.identity}`}
                  className={styles.tileVideo}
                  autoPlay
                  playsInline
                  muted
                />
                {!camEnabled && (
                  <div className={styles.noCamera}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M3 3l18 18M10.5 10.5A2 2 0 0013 13m-7-5v9a2 2 0 002 2h7M21 8.723v6.554a1 1 0 01-1.447.894L15 14V10l4.553-2.276A1 1 0 0121 8.723z" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
                <div className={styles.tileMeta}>
                  <span className={styles.tileName}>{localPart.identity} (вы)</span>
                  {localPart.audioMuted && <span className={styles.mutedIcon}>🔇</span>}
                </div>
                <span className={styles.localBadge}>LOCAL</span>
              </div>
            )}

            {remoteParticipants.map((p) => (
              <div key={p.identity} className={styles.tile}>
                <video
                  id={`video-${p.identity}`}
                  className={styles.tileVideo}
                  autoPlay
                  playsInline
                />
                <div className={styles.tileMeta}>
                  <span className={styles.tileName}>{p.identity}</span>
                  {p.audioMuted && <span className={styles.mutedIcon}>🔇</span>}
                </div>
              </div>
            ))}

            {participants.length === 0 && (
              <div className={styles.emptyRoom}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p>Ожидаем участников...</p>
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <button
              className={`${styles.ctrlBtn} ${micEnabled ? styles.ctrlOn : styles.ctrlOff}`}
              onClick={toggleMic}
              title={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {micEnabled ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18M9 9v3a3 3 0 005.12 2.12M15 9.34V5a3 3 0 00-5.94-.6M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>{micEnabled ? 'Микрофон' : 'Без звука'}</span>
            </button>

            <button
              className={`${styles.ctrlBtn} ${camEnabled ? styles.ctrlOn : styles.ctrlOff}`}
              onClick={toggleCam}
              title={camEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {camEnabled ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18M10.5 10.5A2 2 0 0013 13m-7-5v9a2 2 0 002 2h7M21 8.723v6.554a1 1 0 01-1.447.894L15 14V10l4.553-2.276A1 1 0 0121 8.723z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>{camEnabled ? 'Камера' : 'Без камеры'}</span>
            </button>

            <button className={styles.leaveBtn} onClick={leaveRoom}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Покинуть</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
