/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './VideoCallPage.module.scss'
import {
  IconCrown, IconMicOff, IconMicOn, IconStar, IconVolumeOff, IconVolumeOn,
  IconNotes, IconCam, IconCamOff, IconLink, IconCheck, IconKick, IconCopy, IconPhone, IconVideo,
  IconScreenShare, IconScreenShareOff, IconClipboard, IconPalette,
} from './icons'
import { LAYOUTS, LAYOUT_LABELS, type Layout, type Participant } from './types'
import { useVideoRoom } from './hooks/useVideoRoom'
import { useTranscription } from './hooks/useTranscription'
import Image from 'next/image'
import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import {
  CallTestStudentView,
  CallTestTeacherView,
  StudentProgress,
  AnswerRecord,
  serializeAnswer,
} from './CallTestPanel/CallTestPanel'
import { StudentAnswer } from '@/features/Tasks/TaskResult/scoreBlock'
import { QuickTestBuilder } from './QuickTestBuilder/QuickTestBuilder'
import { CallWhiteboard } from './CallWhiteboard/CallWhiteboard'

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

// ── Live caption widget (collapsible) ────────────────────────────────────────
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

interface AnalyzedError {
  id: string
  description: string | null
  fragment: string | null
  isCorrection: boolean
  student: { name: string }
  categories: { category: { translations: { name: string }[] } }[]
}

interface Props {
  userName: string
  autoJoinRoom?: string
  roomId?: string
  ownerIdentity?: string
  localAvatarUrl?: string
  topic?: string
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VideoCallPage({ userName, autoJoinRoom, roomId, ownerIdentity, localAvatarUrl, topic }: Props) {
  const router = useRouter()
  const [roomName] = useState(autoJoinRoom ?? '')
  const [layout, setLayout] = useState<Layout>('pip')
  const [mainSpeaker, setMainSpeaker] = useState<string>(ownerIdentity ?? userName)
  const [copied, setCopied] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const isMobile = typeof navigator !== 'undefined' && /Android|iP(hone|ad|od)/i.test(navigator.userAgent)

  const [debugChunks, setDebugChunks] = useState(0)
  const [debugMsgs, setDebugMsgs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)

  // Teacher-only: post-call error confirmation
  const [showAnalyzing, setShowAnalyzing] = useState(false)
  const [analyzedErrors, setAnalyzedErrors] = useState<AnalyzedError[]>([])
  const [showErrorConfirm, setShowErrorConfirm] = useState(false)
  const [errorEditMode, setErrorEditMode] = useState(false)
  const [removedErrorIds, setRemovedErrorIds] = useState<Set<string>>(new Set())
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  // ── Call test / whiteboard state ───────────────────────────────────────────
  const [callTest, setCallTest] = useState<{ testId: string | null; title: string; blocks: TestBlock[]; mode?: 'test' | 'whiteboard' } | null>(null)
  const callTestRef = useRef(callTest)
  const [callTestProgress, setCallTestProgress] = useState<Record<string, StudentProgress>>({})
  const [localTestSubmitted, setLocalTestSubmitted] = useState(false)
  const [showTestPicker, setShowTestPicker] = useState(false)
  const [testPickerTab, setTestPickerTab] = useState<'list' | 'quick' | 'board'>('list')
  // Whiteboard: remote elements and image files received via data-channel
  const [whiteboardElements, setWhiteboardElements] = useState<any[] | null>(null)
  const [whiteboardFiles, setWhiteboardFiles] = useState<Record<string, any> | null>(null)
  const [pickerTests, setPickerTests] = useState<{ id: string; title: string; content: { blocks: TestBlock[] } }[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; loading: boolean } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Controls auto-hide state
  const [controlsActive, setControlsActive] = useState(true)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable ref for the data-message router — updated on every render so the
  // LiveKit event listener (registered once) always calls the latest handler.
  const dataRouterRef = useRef<((type: string, payload: Record<string, any>, senderIdentity: string) => void) | null>(null)

  // Buffer for reassembling chunked large messages (e.g. whiteboard with images)
  const chunkBufferRef = useRef<Map<string, { parts: string[]; received: number; total: number }>>(new Map())

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

  // Hoist stable values before the data-router useEffect so the Compiler sees them declared first
  const isOwner = !ownerIdentity || ownerIdentity === userName
  const { broadcast, disconnect, joinRoom, mute, muteVideo, kick, toggleLocalAudio, toggleMic, toggleCam, reloadCamera, switchCamera, updateVideoQualities, toggleScreenShare } = room
  const { screenShareEnabled, sharingIdentity } = room

  // Keep refs in sync via effect (React Compiler forbids ref writes during render)
  useEffect(() => { callTestRef.current = callTest }, [callTest])
  const whiteboardElementsRef = useRef<any[] | null>(null)
  useEffect(() => { whiteboardElementsRef.current = whiteboardElements }, [whiteboardElements])
  // Tracks previous testIsMain value so we only reload camera on hide/stop, not on initial mount
  const testWasMainRef = useRef(false)

  const transcription = useTranscription({
    connected: room.connected,
    micEnabled: room.micEnabled,
    userName,
    broadcast: room.broadcast,
    agentPresent: !!room.agentIdentity,
  })

  // Wire the data-channel router once (all deps are stable useCallbacks, so this runs once).
  // useEffect — not render — to satisfy React's "no ref writes during render" rule.
  const { handleRemoteMessage } = transcription
  useEffect(() => {
    dataRouterRef.current = (type, payload, senderIdentity) => {
      // Log every incoming data-channel message for the mobile debug panel
      const preview = payload.text ?? payload.transcript ?? payload.layout ?? payload.identity ?? ''
      const entry = `${type}${preview ? ' «' + String(preview).slice(0, 30) + '»' : ''} ← ${senderIdentity.slice(0, 12)}`
      setDebugMsgs(prev => [entry, ...prev].slice(0, 12))
      if (type === 'transcript_chunk') setDebugChunks(c => c + 1)

      // ── Chunk reassembly (for large whiteboard payloads) ──────────────────
      if (type === '_chunk') {
        const { id, i, n, d } = payload
        if (!chunkBufferRef.current.has(id)) {
          chunkBufferRef.current.set(id, { parts: new Array(n).fill(''), received: 0, total: n })
        }
        const buf = chunkBufferRef.current.get(id)!
        buf.parts[i] = d as string
        buf.received++
        if (buf.received === buf.total) {
          chunkBufferRef.current.delete(id)
          try {
            const full = JSON.parse(buf.parts.join(''))
            dataRouterRef.current?.(full.type, full, senderIdentity)
          } catch {}
        }
        return
      }

      if (type === 'layout') { setLayout(payload.layout); return }
      if (type === 'speaker') { setMainSpeaker(payload.identity); return }

      // ── Call test messages ─────────────────────────────────────────────────
      if (type === 'call_test_start') {
        setCallTest({ testId: payload.testId ?? null, title: payload.title, blocks: payload.blocks })
        setCallTestProgress({})
        setLocalTestSubmitted(false)
        return
      }
      if (type === 'call_test_answer') {
        setCallTestProgress(prev => {
          const cur = prev[senderIdentity] ?? { answers: {}, submitted: false }
          return { ...prev, [senderIdentity]: { ...cur, answers: { ...cur.answers, [payload.blockId]: payload.answer } } }
        })
        return
      }
      if (type === 'call_test_submit') {
        setCallTestProgress(prev => {
          const cur = prev[senderIdentity] ?? { answers: {}, submitted: false }
          return { ...prev, [senderIdentity]: { ...cur, answers: payload.answers ?? cur.answers, submitted: true } }
        })
        return
      }
      if (type === 'call_test_stop') {
        setCallTest(null)
        setCallTestProgress({})
        setLocalTestSubmitted(false)
        return
      }
      if (type === 'call_test_request') {
        // Student is requesting test state — re-broadcast if we're the owner and test is active
        if (isOwner && callTestRef.current) {
          const t = callTestRef.current
          if (t.mode === 'whiteboard') {
            broadcast({ type: 'call_whiteboard_start' })
            if (whiteboardElementsRef.current && whiteboardElementsRef.current.length > 0) {
              broadcast({ type: 'call_whiteboard_update', elements: whiteboardElementsRef.current })
            }
          } else {
            broadcast({ type: 'call_test_start', testId: t.testId, title: t.title, blocks: t.blocks })
          }
        }
        return
      }

      // ── Whiteboard messages ────────────────────────────────────────────────
      if (type === 'call_whiteboard_start') {
        setCallTest({ testId: null, title: 'Доска', blocks: [], mode: 'whiteboard' })
        setWhiteboardElements(null)
        setWhiteboardFiles(null)
        return
      }
      if (type === 'call_whiteboard_update') {
        if (payload.elements) setWhiteboardElements(payload.elements)
        if (payload.files && Object.keys(payload.files).length > 0) {
          setWhiteboardFiles(prev => ({ ...prev, ...payload.files }))
        }
        return
      }

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

  const isMainSpeaker = mainSpeaker === userName
  const canModerate = isOwner

  // ── Chunked broadcast (splits messages >55 KB to stay under LiveKit's 65535-byte limit) ──
  const CHUNK_SIZE = 50_000
  const broadcastChunked = useCallback((msg: object) => {
    const str = JSON.stringify(msg)
    if (str.length <= CHUNK_SIZE) { broadcast(msg); return }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const total = Math.ceil(str.length / CHUNK_SIZE)
    for (let idx = 0; idx < total; idx++) {
      broadcast({ type: '_chunk', id, i: idx, n: total, d: str.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE) })
    }
  }, [broadcast])

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

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, loading = true) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, loading })
    if (!loading) {
      toastTimerRef.current = setTimeout(() => setToast(null), 2200)
    }
  }, [])

  // ── Camera actions with toast ──────────────────────────────────────────────
  const handleReloadCamera = useCallback(async () => {
    showToast('Перезапуск камеры...')
    await reloadCamera()
    showToast('Камера перезапущена', false)
  }, [reloadCamera, showToast])

  const handleSwitchCamera = useCallback(async () => {
    showToast('Смена камеры...')
    await switchCamera()
    showToast('Камера изменена', false)
  }, [switchCamera, showToast])

  const handleToggleScreenShare = useCallback(async () => {
    showToast(screenShareEnabled ? 'Остановка демонстрации...' : 'Запуск демонстрации...')
    await toggleScreenShare()
    setToast(null)
  }, [screenShareEnabled, toggleScreenShare, showToast])

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setControlsActive(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsActive(false), 3000)
  }, [])

  const hideControlsNow = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    setControlsActive(false)
  }, [])

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

    const transcriptRaw = transcription.finalTranscript
      ?? transcription.callNotes.map(n => `${n.identity}: ${n.text}`).join('\n')

    // Save transcript
    if (transcriptRaw) {
      try {
        await fetch('/api/call/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            transcriptRaw,
            transcriptJson: transcription.finalTranscript ? null : transcription.callNotes,
            participants: room.participants.map(p => ({ identity: p.identity })),
          }),
        })
      } catch {}
    }

    // Teacher-only: analyze errors before disconnecting
    if (isOwner) {
      setShowAnalyzing(true)
      try {
        const res = await fetch('/api/call/analyze-errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName }),
        })
        const data = await res.json()
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          setAnalyzedErrors(data.errors)
          setRemovedErrorIds(new Set())
          setErrorEditMode(false)
          setExpandedErrorId(null)
          setShowAnalyzing(false)
          setShowErrorConfirm(true)
          return
        }
      } catch {}
      setShowAnalyzing(false)
    }

    await disconnect()
    router.push('/profile')
  }, [isOwner, disconnect, router, roomName, transcription, room.participants,
      setShowAnalyzing, setAnalyzedErrors, setRemovedErrorIds, setErrorEditMode,
      setExpandedErrorId, setShowErrorConfirm])

  const confirmErrors = useCallback(async () => {
    if (removedErrorIds.size > 0) {
      await Promise.all(
        Array.from(removedErrorIds).map(id =>
          fetch(`/api/call/analyze-errors/${id}`, { method: 'DELETE' }).catch(() => {})
        )
      )
    }
    setShowErrorConfirm(false)
    await disconnect()
    router.push('/profile')
  }, [removedErrorIds, disconnect, router])

  // ── Sync video quality when main speaker or active speakers change ──────────
  useEffect(() => {
    if (room.connected) updateVideoQualities(mainSpeaker, room.activeSpeakers)
  }, [mainSpeaker, room.connected, room.activeSpeakers, updateVideoQualities])

  // ── Test sync: teacher re-broadcasts when someone joins; student requests ──
  const participantCount = room.participants.length
  useEffect(() => {
    if (!room.connected || participantCount === 0) return
    if (isOwner) {
      // Re-announce test to newly joined participants
      if (callTestRef.current) {
        const t = callTestRef.current
        broadcast({ type: 'call_test_start', testId: t.testId, title: t.title, blocks: t.blocks })
      }
    } else {
      // Ask teacher to send current test state
      broadcast({ type: 'call_test_request' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantCount])

  // ── Reload camera when test/whiteboard tile leaves main slot ─────────────
  // Fires after React paints new DOM. Only acts on the false→true→false transition
  // (testWasMainRef guards against the initial mount where testIsMain is already false).
  const testIsMainForEffect = callTest !== null && mainSpeaker === '__test__'
  useEffect(() => {
    const wasMain = testWasMainRef.current
    testWasMainRef.current = testIsMainForEffect
    if (wasMain && !testIsMainForEffect) {
      // Slight delay so React finishes mounting video elements before reload
      const t = setTimeout(() => reloadCamera(), 800)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIsMainForEffect])

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
    const showCaption = large || (p.identity === mainSpeaker && layout !== 'pip')

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

        {showCaption && <LiveCaptionWidget captionText={captionText} />}

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
  const testIsMain = callTest !== null && mainSpeaker === '__test__'
  const mainPart = (() => {
    if (testIsMain) return null
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
          {testIsMain
            ? renderTestTile(true)
            : mainPart && renderTile(mainPart, true)
          }
          {/* side pips: real participants */}
          {(testIsMain ? room.participants : sideParts).map((p, i) => (
            <DraggablePip key={p.identity} index={i}>{renderTile(p, false, true)}</DraggablePip>
          ))}
          {/* test as small pip when not main */}
          {!testIsMain && callTest && (
            <DraggablePip key="__test__" index={sideParts.length}>
              {renderTestTile(false)}
            </DraggablePip>
          )}
        </div>
      )
    }
    // In split/grid: whiteboard that's been hidden shows as a floating PiP;
    // regular test tiles stay in the grid so progress counters remain visible.
    const whiteboardPip = !testIsMain && callTest?.mode === 'whiteboard' && (
      <DraggablePip key="__test__" index={sideParts.length}>
        {renderTestTile(false)}
      </DraggablePip>
    )
    if (layout === 'split') return (
      <div className={styles.splitArea}>
        {room.participants.map(p => renderTile(p))}
        {callTest && callTest.mode !== 'whiteboard' && renderTestTile(false)}
        {whiteboardPip}
      </div>
    )
    const totalCount = room.participants.length + (callTest && callTest.mode !== 'whiteboard' ? 1 : 0)
    return (
      <div className={styles.gridArea} data-count={totalCount}>
        {room.participants.map(p => renderTile(p))}
        {callTest && callTest.mode !== 'whiteboard' && renderTestTile(false)}
        {whiteboardPip}
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
          <div className={styles.summaryHeader}>
            <h2 className={styles.summaryTitle}>Конспект звонка</h2>
            <button className={styles.closeBtn} onClick={() => setShowSummary(false)} aria-label="Закрыть">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
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

  // ── Error confirmation modal (teacher only) ───────────────────────────────
  const renderErrorConfirmModal = () => {
    const visible = analyzedErrors.filter(e => !removedErrorIds.has(e.id))
    const errors = visible.filter(e => !e.isCorrection)
    const corrections = visible.filter(e => e.isCorrection)

    return (
      <div className={styles.summaryOverlay}>
        <div className={styles.errorConfirmModal}>
          <h2 className={styles.summaryTitle}>Итоги занятия</h2>
          <p className={styles.errorConfirmDesc}>Система обнаружила на этом занятии:</p>

          <div className={styles.errorConfirmCounts}>
            <div className={styles.errorConfirmCount}>
              <span className={styles.errorConfirmCountNum} style={{ color: '#DC2626' }}>{errors.length}</span>
              <span className={styles.errorConfirmCountLabel}>ошибок</span>
            </div>
            <div className={styles.errorConfirmCount}>
              <span className={styles.errorConfirmCountNum} style={{ color: '#22c55e' }}>{corrections.length}</span>
              <span className={styles.errorConfirmCountLabel}>исправлений</span>
            </div>
          </div>

          {!errorEditMode ? (
            <>
              <div className={styles.errorPreviewList}>
                {visible.slice(0, 5).map(e => (
                  <div key={e.id} className={`${styles.errorPreviewItem} ${e.isCorrection ? styles.errorPreviewCorrection : styles.errorPreviewError}`}>
                    <span className={styles.errorPreviewBadge}>{e.isCorrection ? '✓' : '!'}</span>
                    <span className={styles.errorPreviewText}>{e.description}</span>
                  </div>
                ))}
                {visible.length > 5 && (
                  <p className={styles.errorPreviewMore}>+ ещё {visible.length - 5}</p>
                )}
              </div>
              <div className={styles.summaryActions}>
                <button className={styles.pill} onClick={() => setErrorEditMode(true)}>
                  Редактировать
                </button>
                <button className={styles.summaryLeaveBtn} onClick={confirmErrors}>
                  Согласен — завершить
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.errorEditList}>
                {visible.length === 0 && (
                  <p className={styles.notesEmpty}>Все записи удалены</p>
                )}
                {visible.map(e => (
                  <div key={e.id} className={`${styles.errorEditItem} ${e.isCorrection ? styles.errorEditCorrection : styles.errorEditError}`}>
                    <div className={styles.errorEditTop}>
                      <span className={`${styles.errorTypeBadge} ${e.isCorrection ? styles.errorTypeBadgeOk : styles.errorTypeBadgeBad}`}>
                        {e.isCorrection ? 'Исправлено' : 'Ошибка'}
                      </span>
                      <span className={styles.errorWho}>{e.student.name}</span>
                      <div style={{ flex: 1 }} />
                      {e.fragment && (
                        <button
                          className={styles.errorExpandBtn}
                          onClick={() => setExpandedErrorId(prev => prev === e.id ? null : e.id)}
                          title="Показать фрагмент конспекта"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points={expandedErrorId === e.id ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                          </svg>
                        </button>
                      )}
                      <button
                        className={styles.errorRemoveBtn}
                        onClick={() => setRemovedErrorIds(prev => { const s = new Set(prev); s.add(e.id); return s })}
                        title="Убрать"
                      >×</button>
                    </div>
                    <p className={styles.errorEditDesc}>{e.description}</p>
                    {expandedErrorId === e.id && e.fragment && (
                      <div className={styles.errorFragment}>
                        <span className={styles.errorFragmentLabel}>Фрагмент конспекта:</span>
                        <p className={styles.errorFragmentText}>«{e.fragment}»</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.summaryActions}>
                <button className={styles.pill} onClick={() => setErrorEditMode(false)}>← Назад</button>
                <button className={styles.summaryLeaveBtn} onClick={confirmErrors}>
                  Подтвердить и завершить
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Call test helpers ─────────────────────────────────────────────────────
  const launchTest = useCallback((testId: string | null, title: string, blocks: TestBlock[]) => {
    const payload = { type: 'call_test_start', testId, title, blocks }
    setCallTest({ testId, title, blocks })
    setCallTestProgress({})
    setLocalTestSubmitted(false)
    broadcast(payload)
    setShowTestPicker(false)
    setMainSpeaker('__test__')
    broadcast({ type: 'speaker', identity: '__test__' })
  }, [broadcast])

  const stopTest = useCallback(() => {
    setCallTest(null)
    setCallTestProgress({})
    setWhiteboardElements(null)
    broadcast({ type: 'call_test_stop' })
    setMainSpeaker(ownerIdentity ?? userName)
    broadcast({ type: 'speaker', identity: ownerIdentity ?? userName })
  }, [broadcast, ownerIdentity, userName])

  const launchWhiteboard = useCallback(() => {
    setCallTest({ testId: null, title: 'Доска', blocks: [], mode: 'whiteboard' })
    setWhiteboardElements(null)
    broadcast({ type: 'call_whiteboard_start' })
    setShowTestPicker(false)
    setMainSpeaker('__test__')
    broadcast({ type: 'speaker', identity: '__test__' })
  }, [broadcast])

  const broadcastWhiteboard = useCallback((elements: readonly any[], files: Record<string, any>) => {
    setWhiteboardElements(elements as any[])
    broadcastChunked({ type: 'call_whiteboard_update', elements, files })
  }, [broadcastChunked])

  // Students minimize the whiteboard locally (don't broadcast speaker change)
  const localHideWhiteboard = useCallback(() => {
    setMainSpeaker(ownerIdentity ?? userName)
  }, [ownerIdentity, userName])

  const hideTest = useCallback(() => {
    const fallback = ownerIdentity ?? userName
    setMainSpeaker(fallback)
    broadcast({ type: 'speaker', identity: fallback })
  }, [broadcast, ownerIdentity, userName])

  const openTestPicker = useCallback(async () => {
    setShowTestPicker(true)
    setTestPickerTab('list')
    setPickerLoading(true)
    try {
      const res = await fetch('/api/tests')
      const data = await res.json()
      if (Array.isArray(data)) setPickerTests(data)
    } catch {}
    setPickerLoading(false)
  }, [])

  // ── Virtual test tile ─────────────────────────────────────────────────────
  const renderTestTile = (large: boolean) => {
    if (!callTest) return null
    const students = room.participants.filter(p => !p.isLocal)
    const isOneOnOne = students.length === 1
    const submitted = Object.values(callTestProgress).filter(p => p.submitted).length
    const total = students.length

    if (large) {
      // ── Whiteboard mode ──────────────────────────────────────────────────
      if (callTest.mode === 'whiteboard') {
        return (
          <div key="__test__" className={`${styles.tile} ${styles.tileLarge} ${styles.testTileLarge}`}>
            <div className={styles.testTileContent}>
              <CallWhiteboard
                isOwner={isOwner}
                remoteElements={isOwner ? null : whiteboardElements}
                remoteFiles={isOwner ? null : whiteboardFiles}
                onBroadcast={broadcastWhiteboard}
                onStop={stopTest}
                onHide={isOwner ? hideTest : localHideWhiteboard}
              />
            </div>
          </div>
        )
      }

      // ── Test mode ────────────────────────────────────────────────────────
      return (
        <div key="__test__" className={`${styles.tile} ${styles.tileLarge} ${styles.testTileLarge}`}>
          <div className={styles.tileMeta}>
            <span className={styles.tileName}>📋 {callTest.title}</span>
          </div>
          <div className={styles.testTileContent}>
            {isOwner ? (
              <CallTestTeacherView
                blocks={callTest.blocks}
                title={callTest.title}
                studentProgress={callTestProgress}
                studentCount={total}
                isOneOnOne={isOneOnOne}
                studentIdentity={students[0]?.identity}
                participants={students.map(p => p.identity)}
                onStop={stopTest}
                onHide={hideTest}
              />
            ) : (
              <CallTestStudentView
                blocks={callTest.blocks}
                title={callTest.title}
                onAnswer={(blockId, answer) =>
                  broadcast({ type: 'call_test_answer', blockId, answer: serializeAnswer(answer as StudentAnswer) })
                }
                onSubmit={(answers: AnswerRecord) => {
                  setLocalTestSubmitted(true)
                  broadcast({ type: 'call_test_submit', answers })
                }}
                submitted={localTestSubmitted}
              />
            )}
          </div>
        </div>
      )
    }

    // Small preview tile
    const tileIcon = callTest.mode === 'whiteboard' ? '🎨' : '📋'
    return (
      <div
        key="__test__"
        className={`${styles.tile} ${styles.testTileSmall}`}
        onClick={() => {
          setMainSpeaker('__test__')
          broadcast({ type: 'speaker', identity: '__test__' })
        }}
      >
        <div className={styles.noVideo}>
          <div className={styles.testTileIcon}>{tileIcon}</div>
        </div>
        <div className={styles.testTilePreviewMeta}>
          <span className={styles.testTilePreviewTitle}>{callTest.title}</span>
          {isOwner && total > 0 && callTest.mode !== 'whiteboard' && (
            <span className={styles.testTilePreviewProgress}>{submitted}/{total} сдали</span>
          )}
        </div>
      </div>
    )
  }

  // ── Test picker modal ─────────────────────────────────────────────────────
  const renderTestPickerModal = () => {
    return (
      <div className={styles.testPickerOverlay}>
        <div className={styles.testPickerModal}>
          <div className={styles.testPickerHeader}>
            <p className={styles.testPickerTitle}>Запустить тест</p>
            <button className={styles.testPickerClose} onClick={() => setShowTestPicker(false)}>✕</button>
          </div>

          <div className={styles.testPickerTabs}>
            <button
              className={`${styles.testPickerTab} ${testPickerTab === 'list' ? styles.testPickerTabActive : ''}`}
              onClick={() => setTestPickerTab('list')}
            >Мои тесты</button>
            <button
              className={`${styles.testPickerTab} ${testPickerTab === 'quick' ? styles.testPickerTabActive : ''}`}
              onClick={() => setTestPickerTab('quick')}
            >Быстрый тест</button>
            <button
              className={`${styles.testPickerTab} ${testPickerTab === 'board' ? styles.testPickerTabActive : ''}`}
              onClick={() => setTestPickerTab('board')}
            >🎨 Доска</button>
          </div>

          <div className={styles.testPickerBody}>
            {testPickerTab === 'list' && (
              <div className={styles.testList}>
                {pickerLoading && <p className={styles.testListEmpty}>Загрузка...</p>}
                {!pickerLoading && pickerTests.length === 0 && (
                  <p className={styles.testListEmpty}>Нет тестов. Создайте тест в конструкторе.</p>
                )}
                {pickerTests.map(t => (
                  <div key={t.id} className={styles.testListItem}>
                    <div>
                      <div className={styles.testListName}>{t.title}</div>
                      <div className={styles.testListMeta}>{t.content.blocks.length} блоков</div>
                    </div>
                    <button
                      className={styles.testLaunchBtn}
                      onClick={() => launchTest(t.id, t.title, t.content.blocks)}
                    >▶ Запустить</button>
                  </div>
                ))}
              </div>
            )}

            {testPickerTab === 'quick' && (
              <QuickTestBuilder onLaunch={(blocks) => launchTest(null, 'Быстрый тест', blocks)} />
            )}

            {testPickerTab === 'board' && (
              <div className={styles.boardLaunchTab}>
                <div className={styles.boardLaunchIcon}>🎨</div>
                <p className={styles.boardLaunchDesc}>
                  Откройте общую доску для рисования — все участники увидят её в реальном времени.
                </p>
                <button className={styles.testLaunchBtn} onClick={launchWhiteboard}>
                  ▶ Открыть доску
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Controls bar ──────────────────────────────────────────────────────────
  const renderControls = (overlay: boolean) => (
    <div className={`${styles.controls} ${overlay ? styles.controlsOverlay : ''} ${overlay && controlsActive ? styles.controlsOverlayActive : ''}`}>
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
        {isOwner && !callTest && (
          <>
            <button className={styles.pill} onClick={openTestPicker}>
              <IconClipboard /> Тест
            </button>
            <button className={styles.pill} onClick={launchWhiteboard}>
              <IconPalette /> Доска
            </button>
          </>
        )}
        {callTest && (
          <button
            className={`${styles.pill} ${mainSpeaker === '__test__' ? styles.pillActive : ''}`}
            onClick={() => {
              setMainSpeaker('__test__')
              broadcast({ type: 'speaker', identity: '__test__' })
            }}
          >
            {callTest.mode === 'whiteboard' ? <IconPalette /> : <IconClipboard />}
            {callTest.title}
          </button>
        )}
        {!isOwner && !callTest && (
          <button
            className={styles.pill}
            onClick={() => broadcast({ type: 'call_test_request' })}
            title="Запросить тест у учителя"
          >
            <IconClipboard /> Тест?
          </button>
        )}
      </div>

      <div className={styles.ctrlBottomRow}>
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
            <button className={styles.roundBtn} onClick={handleSwitchCamera} title="Сменить камеру">
              <div className={styles.roundIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <path d="M12 17v-6M9 14l3-3 3 3"/>
                </svg>
              </div>
              <span className={styles.roundLabel}>Камера ↕</span>
            </button>
          )}
          <button className={styles.roundBtn} onClick={handleReloadCamera} title="Перезагрузить камеру">
            <div className={styles.roundIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
              </svg>
            </div>
            <span className={styles.roundLabel}>Камера ↺</span>
          </button>
          <button
            className={`${styles.roundBtn} ${screenShareEnabled ? styles.roundOn : ''}`}
            onClick={handleToggleScreenShare}
            title="Демонстрация экрана"
          >
            <div className={styles.roundIcon}>
              {screenShareEnabled ? <IconScreenShareOff /> : <IconScreenShare />}
            </div>
            <span className={styles.roundLabel}>{screenShareEnabled ? 'Стоп экран' : 'Экран'}</span>
          </button>
        </div>

        <div className={styles.ctrlRight}>
          <button className={`${styles.roundBtn} ${styles.roundLeave}`} onClick={leaveRoom}>
            <div className={styles.roundIcon}><IconPhone /></div>
            <span className={styles.roundLabel}>Завершить</span>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Screen share panel ────────────────────────────────────────────────────
  const renderScreenSharePanel = () => {
    if (!sharingIdentity) return null
    const isLocal = sharingIdentity === userName
    return (
      <div className={styles.screenSharePanel}>
        <div className={styles.screenShareHeader}>
          <span>
            {isLocal ? 'Вы демонстрируете экран' : `${sharingIdentity} демонстрирует экран`}
          </span>
          {isLocal && (
            <button className={styles.screenShareStopBtn} onClick={handleToggleScreenShare}>
              Остановить
            </button>
          )}
        </div>
        <video
          id={`ss-${sharingIdentity}`}
          className={styles.screenShareVideo}
          autoPlay
          playsInline
          muted={isLocal}
        />
      </div>
    )
  }

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
            {room.status?.startsWith('Ошибка') && (
              <button className={styles.lobbyRetryBtn} onClick={joinRoom}>Повторить</button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.call}>
          {isMobile && (
            <>
              <button className={styles.mobileLogBtn} onClick={() => setShowLogs(v => !v)}>
                {showLogs ? '✕' : '🪲'} {debugChunks > 0 ? `${debugChunks}✓` : 'лог'}
              </button>
              {showLogs && (
                <div className={styles.mobileLogPanel}>
                  <div className={styles.mobileLogHeader}>
                    <span>agent: {room.agentIdentity ?? '—'}</span>
                    <span>chunks: {debugChunks}</span>
                    <span>SR: {transcription.browserHasSpeech ? 'yes' : 'no'}</span>
                    {transcription.srError && <span style={{color:'#f87171'}}>{transcription.srError}</span>}
                  </div>
                  <div className={styles.mobileLogDivider}>── data-channel ──</div>
                  {debugMsgs.length === 0
                    ? <div className={styles.mobileLogEmpty}>нет сообщений</div>
                    : debugMsgs.map((m, i) => <div key={i} className={styles.mobileLogLine}>{m}</div>)
                  }
                  <div className={styles.mobileLogDivider}>── room events ──</div>
                  {room.debugLog.length === 0
                    ? <div className={styles.mobileLogEmpty}>нет событий</div>
                    : room.debugLog.map((m, i) => (
                      <div key={i} className={`${styles.mobileLogLine} ${m.toLowerCase().includes('error') ? styles.mobileLogErr : ''}`}>{m}</div>
                    ))
                  }
                </div>
              )}
            </>
          )}
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <span className={styles.topDot} />
              <span className={styles.topRoom}>{roomName}</span>
              {topic && <span className={styles.topTopic}>{topic}</span>}
              {room.status && !room.status.startsWith('Ошибка') && <span className={styles.topStatus}>{room.status}</span>}
            </div>
            <div className={styles.topBarRight}>
              <span className={styles.topUser}>{userName}</span>
              {isOwner && <span className={styles.topOwner}><IconCrown /> Владелец</span>}
              {!isOwner && isMainSpeaker && <span className={styles.topSpeaker}><IconMicOn /> Главный</span>}
            </div>
          </div>

          <div
            className={styles.videoArea}
            onMouseMove={resetControlsTimer}
            onMouseLeave={hideControlsNow}
          >
            {renderVideo()}
            {renderScreenSharePanel()}
            {layout === 'pip' && renderControls(true)}
            {showNotes && renderNotesPanel()}
          </div>
          {layout !== 'pip' && renderControls(false)}
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.loading ? styles.toastLoading : styles.toastDone}`}>
          {toast.loading && <span className={styles.toastSpinner} />}
          {!toast.loading && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {showSummary && renderSummaryModal()}
      {showTestPicker && renderTestPickerModal()}

      {showAnalyzing && (
        <div className={styles.summaryOverlay}>
          <div className={styles.summaryModal}>
            <h2 className={styles.summaryTitle}>Анализ урока…</h2>
            <p style={{ fontSize: 13, color: '#868897', textAlign: 'center', margin: '4px 0 0' }}>
              Обнаруживаем ошибки и исправления
            </p>
            <div className={styles.analyzingSpinner} />
          </div>
        </div>
      )}

      {showErrorConfirm && renderErrorConfirmModal()}
    </div>
  )
}
