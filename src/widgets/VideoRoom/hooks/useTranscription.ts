'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteEntry } from '../types'

export function hasBrowserSpeechAPI(): boolean {
  if (typeof window === 'undefined') return false
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android|iP(hone|ad|od)/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in document)
}

// Errors where restarting SR is pointless — mic is blocked or service is down.
const FATAL_SR_ERRORS = ['not-allowed', 'audio-capture', 'service-not-allowed']

interface UseTranscriptionOptions {
  connected: boolean
  micEnabled: boolean
  userName: string
  broadcast: (msg: object) => void
}

interface UseTranscriptionResult {
  liveText: string
  remoteLiveTexts: Record<string, string>
  callNotes: NoteEntry[]
  finalTranscript: string | null
  browserHasSpeech: boolean
  srError: string | null
  handleRemoteMessage: (type: string, identity: string, text: string) => void
}

export function useTranscription({
  connected,
  micEnabled,
  userName,
  broadcast,
}: UseTranscriptionOptions): UseTranscriptionResult {
  const [liveText, setLiveText] = useState('')
  const [remoteLiveTexts, setRemoteLiveTexts] = useState<Record<string, string>>({})
  const [callNotes, setCallNotes] = useState<NoteEntry[]>([])
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null)
  const [srError, setSrError] = useState<string | null>(null)

  const srRef = useRef<any>(null)
  const clearTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const browserHasSpeech = hasBrowserSpeechAPI()

  // ── Speech Recognition ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected || !micEnabled || !browserHasSpeech) {
      setLiveText('')
      return
    }
    if (isMobileDevice()) return

    setSrError(null)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    let shouldRestart = true
    let restartTimer: ReturnType<typeof setTimeout> | null = null
    // Interim fallback: if isFinal never arrives (common on Android), commit after silence.
    let interimBuffer = ''
    let interimTimer: ReturnType<typeof setTimeout> | null = null

    // Commit buffered interim only on Android where isFinal never fires.
    // Require at least 3 words to avoid committing noise fragments.
    let interimConfidence = 0
    const commitInterim = () => {
      const t = interimBuffer.trim()
      interimBuffer = ''
      if (!t || t.split(/\s+/).length < 3 || interimConfidence < 0.4) return
      interimConfidence = 0
      broadcast({ type: 'sr_final', identity: userName, text: t })
      setCallNotes(prev => [...prev, { identity: userName, text: t }])
    }

    const sr = new SR()
    sr.continuous = true
    sr.interimResults = true
    sr.lang = 'ru-RU'
    sr.maxAlternatives = 1

    sr.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          // Skip low-confidence finals — these are usually noise/hallucinations
          if (event.results[i][0].confidence < 0.5) continue
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
          interimConfidence = Math.max(interimConfidence, event.results[i][0].confidence ?? 0)
        }
      }

      if (interim) {
        setLiveText(interim)
        broadcast({ type: 'sr_live', identity: userName, text: interim })
        interimBuffer = interim
        if (interimTimer) clearTimeout(interimTimer)
        interimTimer = setTimeout(commitInterim, 4000)
      }

      if (final) {
        const t = final.trim()
        if (interimTimer) clearTimeout(interimTimer)
        interimBuffer = ''
        interimConfidence = 0
        setLiveText('')
        if (!t) return
        broadcast({ type: 'sr_final', identity: userName, text: t })
        setCallNotes(prev => [...prev, { identity: userName, text: t }])
      }
    }

    sr.onerror = (event: any) => {
      if (FATAL_SR_ERRORS.includes(event.error)) {
        shouldRestart = false
        const msg =
          event.error === 'not-allowed'        ? 'Нет доступа к микрофону' :
          event.error === 'audio-capture'      ? 'Микрофон занят другим потоком (WebRTC). Конспект недоступен.' :
          /* service-not-allowed */              'Сервис распознавания недоступен'
        setSrError(msg)
      }
      // 'no-speech' and 'network' are transient — we still restart below.
    }

    sr.onend = () => {
      // Commit any buffered interim before restarting
      if (interimBuffer) commitInterim()
      if (!shouldRestart || document.hidden) return
      restartTimer = setTimeout(() => {
        if (!shouldRestart || document.hidden) return
        try { sr.start() } catch {}
      }, 800)
    }

    try { sr.start() } catch {}
    srRef.current = sr

    return () => {
      shouldRestart = false
      if (restartTimer) clearTimeout(restartTimer)
      if (interimTimer) clearTimeout(interimTimer)
      try { srRef.current?.stop() } catch {}
      srRef.current = null
      setLiveText('')
    }
  }, [connected, micEnabled, browserHasSpeech, broadcast, userName])

  // ── Handler for incoming data-channel messages ────────────────────────────
  const handleRemoteMessage = useCallback(
    (type: string, identity: string, text: string) => {
      if (type === 'sr_live') {
        setRemoteLiveTexts(prev => ({ ...prev, [identity]: text }))
        return
      }
      if (type === 'sr_final') {
        setRemoteLiveTexts(prev => ({ ...prev, [identity]: '' }))
        if (text) setCallNotes(prev => [...prev, { identity, text }])
        return
      }

      if (type === 'transcript_chunk') {
        if (!text) return
        setCallNotes(prev => [...prev, { identity, text }])
        const isLocal = identity === userName
        if (isLocal) {
          if (!browserHasSpeech) {
            setLiveText(text)
            setTimeout(() => setLiveText(''), 4000)
          }
        } else {
          setRemoteLiveTexts(prev => ({ ...prev, [identity]: text }))
          if (clearTimersRef.current[identity]) clearTimeout(clearTimersRef.current[identity])
          clearTimersRef.current[identity] = setTimeout(() => {
            setRemoteLiveTexts(prev => ({ ...prev, [identity]: '' }))
          }, 4000)
        }
        return
      }

      if (type === 'session_transcript') {
        if (text) setFinalTranscript(text)
      }
    },
    [userName, browserHasSpeech],
  )

  return {
    liveText,
    remoteLiveTexts,
    callNotes,
    finalTranscript,
    browserHasSpeech,
    srError,
    handleRemoteMessage,
  }
}
