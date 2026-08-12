/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { TestBlock } from '@/entities/store/slices/tasksSlice.slice'
import TestService from '@/features/services/TestService.service'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StudentProgress } from './CallTestPanel/CallTestPanel'
import { ControlsBar } from './components/ControlsBar'
import { type AnalyzedError, ErrorConfirmModal } from './components/ErrorConfirmModal'
import { InviteModal } from './components/InviteModal'
import { LobbyView } from './components/LobbyView'
import { NotesPanel } from './components/NotesPanel'
import { ParticipantTile } from './components/ParticipantTile'
import { ScreenSharePanel } from './components/ScreenSharePanel'
import { SummaryModal } from './components/SummaryModal'
import { TestPickerModal } from './components/TestPickerModal'
import { type CallTestState, TestTile } from './components/TestTile'
import { TopBar, DevPanel } from './components/TopBar'
import { VideoLayout } from './components/VideoLayout'
import styles from './VideoCallPage.module.scss'
import { useTranscription } from './hooks/useTranscription'
import { useVideoRoom } from './hooks/useVideoRoom'
import { type Layout, type Participant } from './types'

interface Props {
  userName: string
  autoJoinRoom?: string
  roomId?: string
  ownerIdentity?: string
  localAvatarUrl?: string
  topic?: string
  userRole?: string
}

export default function VideoCallPage({ userName, autoJoinRoom, roomId, ownerIdentity, localAvatarUrl, topic, userRole }: Props) {
  const router = useRouter()
  const [roomName] = useState(autoJoinRoom ?? '')
  const [layout, setLayout] = useState<Layout>('pip')
  const [mainSpeaker, setMainSpeaker] = useState<string>(ownerIdentity ?? userName)
  const [copied, setCopied] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const isDev = process.env.NODE_ENV === 'development'
  const [debugChunks, setDebugChunks] = useState(0)
  const [debugMsgs, setDebugMsgs] = useState<string[]>([])

  const endRoom = useCallback(() => {
    navigator.sendBeacon('/api/call/end', JSON.stringify({ roomName }))
  }, [roomName])
  useEffect(() => {
    window.addEventListener('beforeunload', endRoom)
    return () => window.removeEventListener('beforeunload', endRoom)
  }, [endRoom])

  // Teacher-only: post-call error confirmation
  const [showAnalyzing, setShowAnalyzing] = useState(false)
  const [analyzedErrors, setAnalyzedErrors] = useState<AnalyzedError[]>([])
  const [showErrorConfirm, setShowErrorConfirm] = useState(false)
  const [errorEditMode, setErrorEditMode] = useState(false)
  const [removedErrorIds, setRemovedErrorIds] = useState<Set<string>>(new Set())
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)

  // Call test / whiteboard state
  const [callTest, setCallTest] = useState<CallTestState | null>(null)
  const callTestRef = useRef(callTest)
  const [callTestProgress, setCallTestProgress] = useState<Record<string, StudentProgress>>({})
  const [localTestSubmitted, setLocalTestSubmitted] = useState(false)
  const [showTestPicker, setShowTestPicker] = useState(false)
  const [testPickerTab, setTestPickerTab] = useState<'list' | 'quick' | 'board'>('list')
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

  // Room limit / invite state
  const [limitBlocked, setLimitBlocked] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStudents, setInviteStudents] = useState<{ id: string; name: string; email: string; avatarUrl?: string | null }[]>([])
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const dataRouterRef = useRef<((type: string, payload: Record<string, any>, senderIdentity: string) => void) | null>(null)
  const chunkBufferRef = useRef<Map<string, { parts: string[]; received: number; total: number }>>(new Map())

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const room = useVideoRoom({
    roomName,
    userName,
    localAvatarUrl,
    onDataMessage: useCallback(
      (type, payload, senderIdentity) => dataRouterRef.current?.(type, payload, senderIdentity),
      [],
    ),
  })

  const isOwner = !ownerIdentity || ownerIdentity === userName
  const { broadcast, disconnect, joinRoom, mute, muteVideo, kick, toggleLocalAudio, toggleMic, toggleCam, reloadCamera, switchCamera, updateVideoQualities, toggleScreenShare } = room
  const { screenShareEnabled, sharingIdentity } = room

  useEffect(() => { callTestRef.current = callTest }, [callTest])
  const isOwnerRef = useRef(isOwner)
  useEffect(() => { isOwnerRef.current = isOwner }, [isOwner])
  const broadcastChunkedRef = useRef<((msg: object) => void) | null>(null)
  const whiteboardElementsRef = useRef<any[] | null>(null)
  useEffect(() => { whiteboardElementsRef.current = whiteboardElements }, [whiteboardElements])
  const testWasMainRef = useRef(false)

  const transcription = useTranscription({
    connected: room.connected,
    micEnabled: room.micEnabled,
    userName,
    broadcast: room.broadcast,
    agentPresent: !!room.agentIdentity,
  })

  // ── Data-channel router ───────────────────────────────────────────────────
  const { handleRemoteMessage } = transcription
  useEffect(() => {
    dataRouterRef.current = (type, payload, senderIdentity) => {
      const preview = payload.text ?? payload.transcript ?? payload.layout ?? payload.identity ?? ''
      const entry = `${type}${preview ? ' «' + String(preview).slice(0, 30) + '»' : ''} ← ${senderIdentity.slice(0, 12)}`
      setDebugMsgs(prev => [entry, ...prev].slice(0, 12))
      if (type === 'transcript_chunk') setDebugChunks(c => c + 1)

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
        setCallTest(null); setCallTestProgress({}); setLocalTestSubmitted(false)
        return
      }
      if (type === 'call_test_request') {
        if (isOwnerRef.current && callTestRef.current) {
          const t = callTestRef.current
          if (t.mode === 'whiteboard') {
            broadcast({ type: 'call_whiteboard_start' })
            if (whiteboardElementsRef.current?.length) {
              broadcastChunkedRef.current?.({ type: 'call_whiteboard_update', elements: whiteboardElementsRef.current })
            }
          } else {
            broadcastChunkedRef.current?.({ type: 'call_test_start', testId: t.testId, title: t.title, blocks: t.blocks })
          }
        }
        return
      }

      if (type === 'call_whiteboard_start') {
        setCallTest({ testId: null, title: 'Доска', blocks: [], mode: 'whiteboard' })
        setWhiteboardElements(null); setWhiteboardFiles(null)
        return
      }
      if (type === 'call_whiteboard_update') {
        if (payload.elements) setWhiteboardElements(payload.elements)
        if (payload.files && Object.keys(payload.files).length > 0) {
          setWhiteboardFiles(prev => ({ ...prev, ...payload.files }))
        }
        return
      }

      if (type === 'sr_live' || type === 'sr_final') {
        handleRemoteMessage(type, senderIdentity, payload.text ?? '')
        return
      }
      if (type === 'transcript_chunk') {
        handleRemoteMessage(type, payload.participant ?? senderIdentity, payload.text ?? '')
        return
      }
      if (type === 'session_transcript') {
        handleRemoteMessage(type, '', payload.transcript ?? '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRemoteMessage])

  // ── Chunked broadcast ─────────────────────────────────────────────────────
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
  useEffect(() => { broadcastChunkedRef.current = broadcastChunked }, [broadcastChunked])

  // ── Room-level broadcast actions ──────────────────────────────────────────
  const changeLayout = useCallback((l: Layout) => {
    setLayout(l); broadcast({ type: 'layout', layout: l })
  }, [broadcast])

  const transferSpeaker = useCallback((identity: string) => {
    setMainSpeaker(identity)
    broadcast({ type: 'speaker', identity })
    updateVideoQualities(identity, room.activeSpeakers)
  }, [broadcast, updateVideoQualities, room.activeSpeakers])

  const shareLink = useCallback(() => {
    const url = roomId ? `${window.location.origin}/call/${roomId}` : window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }, [roomId])

  // ── Toast helpers ─────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, loading = true) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, loading })
    if (!loading) toastTimerRef.current = setTimeout(() => setToast(null), 2200)
  }, [])

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

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    setControlsActive(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setControlsActive(false), 3000)
  }, [])

  const hideControlsNow = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    setControlsActive(false)
  }, [])

  // ── Leave ─────────────────────────────────────────────────────────────────
  const { callNotes } = transcription

  const leaveRoom = useCallback(() => {
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
    if (transcriptRaw) {
      try {
        await fetch('/api/call/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName, transcriptRaw,
            transcriptJson: transcription.finalTranscript ? null : transcription.callNotes,
            participants: room.participants.map(p => ({ identity: p.identity })),
          }),
        })
      } catch {}
    }
    if (isOwner) {
      setShowAnalyzing(true)
      try {
        const res = await fetch('/api/call/analyze-errors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName }),
        })
        const data = await res.json()
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          setAnalyzedErrors(data.errors)
          setRemovedErrorIds(new Set()); setErrorEditMode(false); setExpandedErrorId(null)
          setShowAnalyzing(false); setShowErrorConfirm(true)
          return
        }
      } catch {}
      setShowAnalyzing(false)
    }
    await disconnect(); endRoom()
    router.push('/profile')
  }, [isOwner, disconnect, router, roomName, transcription, room.participants, endRoom])

  const confirmErrors = useCallback(async () => {
    if (removedErrorIds.size > 0) {
      await Promise.all(
        Array.from(removedErrorIds).map(id =>
          fetch(`/api/call/analyze-errors/${id}`, { method: 'DELETE' }).catch(() => {})
        )
      )
    }
    setShowErrorConfirm(false)
    await disconnect(); endRoom()
    router.push('/profile')
  }, [removedErrorIds, disconnect, router, endRoom])

  // ── Sync effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (room.connected) updateVideoQualities(mainSpeaker, room.activeSpeakers)
  }, [mainSpeaker, room.connected, room.activeSpeakers, updateVideoQualities])

  const participantCount = room.participants.length
  useEffect(() => {
    if (!room.connected || participantCount === 0) return
    if (isOwnerRef.current) {
      if (callTestRef.current) {
        const t = callTestRef.current
        broadcastChunkedRef.current?.({ type: 'call_test_start', testId: t.testId, title: t.title, blocks: t.blocks })
      }
    } else {
      broadcast({ type: 'call_test_request' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantCount])

  const testIsMainForEffect = callTest !== null && mainSpeaker === '__test__'
  useEffect(() => {
    const wasMain = testWasMainRef.current
    testWasMainRef.current = testIsMainForEffect
    if (wasMain && !testIsMainForEffect) {
      const t = setTimeout(() => reloadCamera(), 800)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testIsMainForEffect])

  useEffect(() => {
    if (autoJoinRoom) {
      if (roomId) {
        fetch(`/api/call/rooms/limit?roomId=${roomId}`)
          .then(r => r.json())
          .then(data => { if (!data.allowed) setLimitBlocked(true); else joinRoom() })
          .catch(() => joinRoom())
      } else {
        joinRoom()
      }
    }
    return () => { disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showInviteModal || userRole !== 'TEACHER') return
    fetch('/api/call/my-students')
      .then(r => r.json())
      .then(data => setInviteStudents(data.students ?? []))
      .catch(() => {})
  }, [showInviteModal, userRole])

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !roomId) return
    setInviteSending(true); setInviteFeedback(null)
    try {
      const res = await fetch('/api/call/rooms/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, targetEmail: inviteEmail.trim() }),
      })
      if (res.ok) {
        setInviteFeedback({ ok: true, msg: 'Приглашение отправлено' })
        setInviteEmail('')
      } else {
        const data = await res.json()
        const msg = data.error === 'USER_NOT_FOUND' ? 'Пользователь не найден' : 'Ошибка отправки'
        setInviteFeedback({ ok: false, msg })
      }
    } catch {
      setInviteFeedback({ ok: false, msg: 'Ошибка соединения' })
    } finally {
      setInviteSending(false)
    }
  }

  // ── Call test actions ─────────────────────────────────────────────────────
  const launchTest = useCallback((testId: string | null, title: string, blocks: TestBlock[]) => {
    setCallTest({ testId, title, blocks })
    setCallTestProgress({}); setLocalTestSubmitted(false)
    broadcastChunked({ type: 'call_test_start', testId, title, blocks })
    setShowTestPicker(false)
    setMainSpeaker('__test__')
    broadcast({ type: 'speaker', identity: '__test__' })
  }, [broadcast, broadcastChunked])

  const stopTest = useCallback(() => {
    setCallTest(null); setCallTestProgress({}); setWhiteboardElements(null)
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

  const localHideWhiteboard = useCallback(() => {
    setMainSpeaker(ownerIdentity ?? userName)
  }, [ownerIdentity, userName])

  const hideTest = useCallback(() => {
    const fallback = ownerIdentity ?? userName
    setMainSpeaker(fallback); broadcast({ type: 'speaker', identity: fallback })
  }, [broadcast, ownerIdentity, userName])

  const openTestPicker = useCallback(async () => {
    setShowTestPicker(true); setTestPickerTab('list'); setPickerLoading(true)
    try {
      const data = await TestService.getMyTests()
      setPickerTests(data as Parameters<typeof setPickerTests>[0])
    } catch {}
    setPickerLoading(false)
  }, [])

  const makeTestMain = useCallback(() => {
    setMainSpeaker('__test__'); broadcast({ type: 'speaker', identity: '__test__' })
  }, [broadcast])

  // ── Computed layout values ────────────────────────────────────────────────
  const testIsMain = callTest !== null && mainSpeaker === '__test__'
  const isMainSpeaker = mainSpeaker === userName
  const canModerate = isOwner

  const mainPart = (() => {
    if (testIsMain) return null
    if (layout === 'pip' && room.participants.length === 2) {
      return room.participants.find(p => !p.isLocal) ?? room.participants[0]
    }
    return room.participants.find(p => p.identity === mainSpeaker) ?? room.participants[0]
  })()
  const sideParts = room.participants.filter(p => p !== mainPart)
  const students = room.participants.filter(p => !p.isLocal)
  const locallyMutedIds = new Set(room.participants.filter(p => p.localAudioMuted).map(p => p.identity))

  // ── Tile render props ─────────────────────────────────────────────────────
  const tileSharedProps = {
    mainSpeaker, layout,
    camEnabled: room.camEnabled, micEnabled: room.micEnabled,
    liveText: transcription.liveText,
    remoteLiveTexts: transcription.remoteLiveTexts,
    canModerate,
    onToggleLocalAudio: toggleLocalAudio,
    onTransferSpeaker: transferSpeaker,
    onMute: mute,
    onMuteVideo: muteVideo,
    onKick: kick,
  }

  const renderTile = (p: Participant, large = false, isPip = false) => (
    <ParticipantTile key={p.identity} participant={p} large={large} isPip={isPip} {...tileSharedProps} />
  )

  const testTileSharedProps = {
    callTest: callTest!,
    isOwner, studentProgress: callTestProgress, students, localTestSubmitted,
    whiteboardElements, whiteboardFiles,
    onBroadcastChunked: broadcastChunked,
    onStop: stopTest, onHide: hideTest,
    onLocalHideWhiteboard: localHideWhiteboard,
    onBroadcastWhiteboard: broadcastWhiteboard,
    onSetLocalTestSubmitted: setLocalTestSubmitted,
    onMakeMain: makeTestMain,
  }

  const renderTestTile = (large: boolean) =>
    callTest ? <TestTile key="__test__" {...testTileSharedProps} large={large} /> : null

  const controlsBarSharedProps = {
    layout, isMainSpeaker, isOwner, copied, showNotes,
    micEnabled: room.micEnabled, camEnabled: room.camEnabled,
    videoDevices: room.videoDevices, screenShareEnabled,
    callTest, mainSpeaker,
    browserHasSpeech: transcription.browserHasSpeech,
    onShareLink: shareLink, onChangeLayout: changeLayout,
    onToggleNotes: () => setShowNotes(n => !n),
    onOpenTestPicker: openTestPicker, onLaunchWhiteboard: launchWhiteboard,
    onOpenInvite: () => setShowLinkModal(true),
    onMakeTestMain: makeTestMain,
    onToggleMic: toggleMic, onToggleCam: toggleCam,
    onSwitchCamera: handleSwitchCamera, onReloadCamera: handleReloadCamera,
    onToggleScreenShare: handleToggleScreenShare, onLeave: leaveRoom,
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {!room.connected ? (
        <LobbyView
          limitBlocked={limitBlocked}
          autoJoinRoom={autoJoinRoom}
          userName={userName}
          status={room.status}
          onBack={() => router.back()}
          onRetry={joinRoom}
        />
      ) : (
        <div className={styles.call}>
          {isDev && (
            <DevPanel
              debugChunks={debugChunks}
              debugMsgs={debugMsgs}
              agentIdentity={room.agentIdentity}
              browserHasSpeech={transcription.browserHasSpeech}
              srError={transcription.srError}
              debugLog={room.debugLog}
            />
          )}

          <TopBar
            roomName={roomName}
            topic={topic}
            status={room.status}
            userName={userName}
            isOwner={isOwner}
            isMainSpeaker={isMainSpeaker}
          />

          <div
            className={styles.callroom}
            onMouseMove={resetControlsTimer}
            onMouseLeave={hideControlsNow}
          >
            <VideoLayout
              layout={layout}
              participants={room.participants}
              testIsMain={testIsMain}
              mainPart={mainPart ?? null}
              sideParts={sideParts}
              callTest={callTest}
              renderTile={renderTile}
              renderTestTile={renderTestTile}
            />
            <ScreenSharePanel
              sharingIdentity={sharingIdentity}
              userName={userName}
              onStop={handleToggleScreenShare}
            />
            <ControlsBar {...controlsBarSharedProps} overlay controlsActive={controlsActive} />
            {showNotes && (
              <NotesPanel
                callNotes={callNotes}
                srError={transcription.srError}
                browserHasSpeech={transcription.browserHasSpeech}
                locallyMutedIds={locallyMutedIds}
                onClose={() => setShowNotes(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Toast */}
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

      {/* Modals */}
      {showSummary && (
        <SummaryModal
          finalTranscript={transcription.finalTranscript}
          callNotes={callNotes}
          onClose={() => setShowSummary(false)}
          onLeave={confirmLeave}
        />
      )}
      {showTestPicker && (
        <TestPickerModal
          pickerTests={pickerTests}
          pickerLoading={pickerLoading}
          activeTab={testPickerTab}
          onTabChange={setTestPickerTab}
          onClose={() => setShowTestPicker(false)}
          onLaunchTest={launchTest}
          onLaunchWhiteboard={launchWhiteboard}
        />
      )}
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
      {showErrorConfirm && (
        <ErrorConfirmModal
          analyzedErrors={analyzedErrors}
          removedErrorIds={removedErrorIds}
          errorEditMode={errorEditMode}
          expandedErrorId={expandedErrorId}
          onToggleRemove={(id) => setRemovedErrorIds(prev => { const s = new Set(prev); s.add(id); return s })}
          onSetEditMode={setErrorEditMode}
          onSetExpanded={setExpandedErrorId}
          onConfirm={confirmErrors}
        />
      )}
      {showInviteModal && (
        <InviteModal
          inviteEmail={inviteEmail}
          inviteStudents={inviteStudents}
          inviteSending={inviteSending}
          inviteFeedback={inviteFeedback}
          onEmailChange={(email) => { setInviteEmail(email); setInviteFeedback(null) }}
          onClose={() => { setShowInviteModal(false); setInviteFeedback(null) }}
          onSend={handleSendInvite}
          onSelectStudent={(email) => setInviteEmail(email)}
        />
      )}
      {showLinkModal && (
        <div
          className={styles.inviteLinkOverlay}
          onClick={e => { if (e.target === e.currentTarget) setShowLinkModal(false) }}
        >
          <div className={styles.inviteLinkCard}>
            <div className={styles.inviteLinkHeader}>
              <span>Пригласить участника</span>
              <button className={styles.inviteLinkClose} onClick={() => setShowLinkModal(false)}>✕</button>
            </div>
            <p className={styles.inviteLinkHint}>Поделитесь ссылкой на комнату</p>
            <div className={styles.inviteLinkRow}>
              <input
                className={styles.inviteLinkInput}
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : ''}
                onFocus={e => e.currentTarget.select()}
              />
              <button
                className={styles.inviteLinkCopy}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 1500)
                }}
              >
                {linkCopied
                  ? <span className={styles.inviteLinkCopied}>✓ Скопировано!</span>
                  : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
