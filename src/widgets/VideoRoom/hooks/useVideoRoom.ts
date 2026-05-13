/* eslint-disable react-hooks/refs */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Room, RoomEvent, Track, VideoPresets, VideoQuality } from 'livekit-client'
import { useCallback, useRef, useState } from 'react'
import type { Participant } from '../types'

const TURN = {
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

interface UseVideoRoomOptions {
  roomName: string
  userName: string
  localAvatarUrl?: string
  // Called for every data-channel message; the component routes it to the right handler
  onDataMessage: (type: string, payload: Record<string, any>, senderIdentity: string) => void
}

export function useVideoRoom({ roomName, userName, localAvatarUrl, onDataMessage }: UseVideoRoomOptions) {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([])

  const roomRef = useRef<Room | null>(null)
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const enc = useRef(new TextEncoder())
  const dec = useRef(new TextDecoder())
  // Stable ref to the latest onDataMessage so the event listener never goes stale
  const onDataMessageRef = useRef(onDataMessage)
  onDataMessageRef.current = onDataMessage

  // ── Participant helpers ────────────────────────────────────────────────────
  const upsert = useCallback((identity: string, patch: Partial<Participant> = {}) => {
    setParticipants(prev => {
      const existing = prev.find(p => p.identity === identity)
      if (existing) return prev.map(p => p.identity === identity ? { ...p, ...patch } : p)
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

  // ── Broadcast ──────────────────────────────────────────────────────────────
  const broadcast = useCallback((msg: object) => {
    try {
      roomRef.current?.localParticipant.publishData(
        enc.current.encode(JSON.stringify(msg)),
        { reliable: true },
      )
    } catch {}
  }, [])

  // ── Room actions ───────────────────────────────────────────────────────────
  const mute = useCallback(async (identity: string) => {
    let trackSid: string | undefined
    roomRef.current?.remoteParticipants.forEach(p => {
      if (p.identity === identity) {
        const pub = p.getTrackPublication(Track.Source.Microphone)
        if (pub?.trackSid) trackSid = pub.trackSid
      }
    })
    if (!trackSid) return
    upsert(identity, { audioMuted: true })
    try {
      const res = await fetch('/api/livekit/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantIdentity: identity, trackSid, muted: true }),
      })
      if (!res.ok) upsert(identity, { audioMuted: false })
    } catch {
      upsert(identity, { audioMuted: false })
    }
  }, [roomName, upsert])

  const muteVideo = useCallback(async (identity: string) => {
    let trackSid: string | undefined
    roomRef.current?.remoteParticipants.forEach(p => {
      if (p.identity === identity) {
        const pub = p.getTrackPublication(Track.Source.Camera)
        if (pub?.trackSid) trackSid = pub.trackSid
      }
    })
    if (!trackSid) return
    upsert(identity, { videoMuted: true })
    try {
      const res = await fetch('/api/livekit/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantIdentity: identity, trackSid, muted: true }),
      })
      if (!res.ok) upsert(identity, { videoMuted: false })
    } catch {
      upsert(identity, { videoMuted: false })
    }
  }, [roomName, upsert])

  const kick = useCallback(async (identity: string) => {
    await fetch('/api/livekit/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantIdentity: identity }),
    })
  }, [roomName])

  const toggleLocalAudio = useCallback((identity: string) => {
    const el = audioElsRef.current.get(identity)
    if (!el) return
    el.muted = !el.muted
    upsert(identity, { localAudioMuted: el.muted })
  }, [upsert])

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return
    const next = !micEnabled
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(next)
      setMicEnabled(next)
      upsert(userName, { audioMuted: !next })
    } catch (e) {
      console.error('toggleMic failed', e)
    }
  }, [micEnabled, upsert, userName])

  const toggleCam = useCallback(async () => {
    if (!roomRef.current) return
    const next = !camEnabled
    await roomRef.current.localParticipant.setCameraEnabled(next)
    setCamEnabled(next)
    upsert(userName, { videoMuted: !next })
  }, [camEnabled, upsert, userName])

  // ── Join ───────────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    if (!roomName.trim()) return
    setStatus('Подключаемся...')
    try {
      const be = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://goodworker-api.up.railway.app'
      const res = await fetch(`${be}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), participantName: userName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.errorMessage ?? data.error ?? 'Token error')

      const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://goodworker-livekit.up.railway.app'
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        rtcConfig: { iceServers: [{ ...TURN }], iceTransportPolicy: 'all' },
        videoCaptureDefaults: {
          resolution: VideoPresets.h1440.resolution,
        },
        publishDefaults: {
          videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h540, VideoPresets.h1080],
          videoCodec: 'vp8',
        },
      } as any)
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, p: any) => {
        if (p.identity.startsWith('agent-')) return
        upsert(p.identity)
        if (track.kind === Track.Kind.Video || track.kind === 'video') {
          // Delay so React can render the <video> element before attaching
          setTimeout(() => attachTrack(p.identity, track), 150)
        } else {
          attachTrack(p.identity, track)
        }
      })
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => track.detach())
      room.on(RoomEvent.ParticipantConnected, (p: any) => {
        if (p.identity.startsWith('agent-')) return
        upsert(p.identity)
        fetchAvatar(p.identity)
        setStatus(`${p.identity} подключился`)
        setTimeout(() => setStatus(''), 3000)
      })
      room.on(RoomEvent.ParticipantDisconnected, (p: any) => {
        if (p.identity.startsWith('agent-')) return
        audioElsRef.current.delete(p.identity)
        remove(p.identity)
        setStatus(`${p.identity} отключился`)
        setTimeout(() => setStatus(''), 3000)
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
        setConnected(false)
        setParticipants([])
        setStatus('')
        roomRef.current = null
      })
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        setActiveSpeakers(speakers.map((s: any) => s.identity).filter((id: string) => !id.startsWith('agent-')))
      })
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
        try {
          const msg = JSON.parse(dec.current.decode(payload))
          const senderIdentity: string = participant?.identity ?? msg.identity ?? ''
          onDataMessageRef.current(msg.type, msg, senderIdentity)
        } catch {}
      })

      await room.connect(lkUrl, data.token)
      upsert(room.localParticipant.identity, { isLocal: true, avatarUrl: localAvatarUrl })
      room.remoteParticipants.forEach(p => {
        if (p.identity.startsWith('agent-')) return
        upsert(p.identity)
        fetchAvatar(p.identity)
        p.trackPublications.forEach(pub => {
          if (pub.track) attachTrack(p.identity, pub.track)
        })
      })
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      })
      try {
        await room.localParticipant.setCameraEnabled(true)
      } catch {
        // no camera — continue without video
      }
      const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
      if (cam) setTimeout(() => attachTrack(room.localParticipant.identity, cam), 150)
      setStatus('')
      setConnected(true)
    } catch (e: any) {
      setStatus('Ошибка: ' + e.message)
    }
  }, [roomName, userName, localAvatarUrl, upsert, remove, attachTrack, fetchAvatar])

  // ≤3 participants: main=HIGH, rest=MEDIUM
  // 4+ participants: main=HIGH, active speaker=MEDIUM, rest=LOW
  const updateVideoQualities = useCallback((mainIdentity: string, speakers: string[]) => {
    const room = roomRef.current
    if (!room) return
    const count = room.remoteParticipants.size + 1 // +1 for local
    room.remoteParticipants.forEach(p => {
      const pub = p.getTrackPublication(Track.Source.Camera)
      if (!pub) return
      let q: VideoQuality
      if (p.identity === mainIdentity) {
        q = VideoQuality.HIGH
      } else if (count <= 3) {
        q = VideoQuality.MEDIUM
      } else {
        q = speakers.includes(p.identity) ? VideoQuality.MEDIUM : VideoQuality.LOW
      }
      try { pub.setVideoQuality(q) } catch {}
    })
  }, [])

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect()
    roomRef.current = null
  }, [])

  return {
    connected,
    status,
    participants,
    micEnabled,
    camEnabled,
    roomRef,
    audioElsRef,
    broadcast,
    joinRoom,
    disconnect,
    upsert,
    remove,
    attachTrack,
    mute,
    muteVideo,
    kick,
    toggleLocalAudio,
    toggleMic,
    toggleCam,
    activeSpeakers,
    updateVideoQualities,
  }
}
