'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NoteEntry } from '../types'

// Returns true only if the browser exposes a native Speech Recognition API.
// Only Chrome and Chromium-based browsers support webkitSpeechRecognition.
export function hasBrowserSpeechAPI(): boolean {
  if (typeof window === 'undefined') return false
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

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

  const srRef = useRef<any>(null)
  // Becomes true the moment the first transcript_chunk arrives from the agent.
  // When the agent is active we skip adding Chrome SR finals to callNotes to avoid duplicates.
  const agentActiveRef = useRef(false)
  // Timers for auto-clearing remote live text after agent chunks
  const clearTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const browserHasSpeech = hasBrowserSpeechAPI()

  // ── Chrome / Chromium Speech Recognition (live captions only) ─────────────
  useEffect(() => {
    if (!connected || !micEnabled || !browserHasSpeech) {
      setLiveText('')
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    let shouldRestart = true
    const sr = new SR()
    sr.continuous = true
    sr.interimResults = true
    sr.lang = 'ru-RU'
    sr.maxAlternatives = 1

    sr.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else interim += event.results[i][0].transcript
      }
      // Always show interim in the live caption overlay
      setLiveText(interim)
      if (interim) broadcast({ type: 'sr_live', identity: userName, text: interim })
      if (final) {
        const t = final.trim()
        broadcast({ type: 'sr_final', identity: userName, text: t })
        // Only add to notes when the agent is NOT active (agent provides better results)
        if (t && !agentActiveRef.current) {
          setCallNotes(prev => [...prev, { identity: userName, text: t }])
        }
      }
    }

    sr.onerror = (event: any) => {
      if (event.error === 'not-allowed') shouldRestart = false
    }

    // Chrome stops SR on silence — restart automatically
    sr.onend = () => {
      if (shouldRestart) try { sr.start() } catch {}
    }

    try { sr.start() } catch {}
    srRef.current = sr

    return () => {
      shouldRestart = false
      try { srRef.current?.stop() } catch {}
      srRef.current = null
      setLiveText('')
    }
  }, [connected, micEnabled, browserHasSpeech, broadcast, userName])

  // ── Handler for incoming data-channel messages ────────────────────────────
  // Called by VideoCallPage's data router for:
  //   sr_live / sr_final  — from Chrome SR of remote participants
  //   transcript_chunk    — from the faster-whisper LiveKit agent
  //   session_transcript  — full transcript published by agent on room close
  const handleRemoteMessage = useCallback(
    (type: string, identity: string, text: string) => {
      // ── Chrome SR messages from other remote Chrome users ──
      if (type === 'sr_live') {
        setRemoteLiveTexts(prev => ({ ...prev, [identity]: text }))
        return
      }
      if (type === 'sr_final') {
        setRemoteLiveTexts(prev => ({ ...prev, [identity]: '' }))
        // Always add remote SR finals — don't suppress even when agent is active
        if (text) setCallNotes(prev => [...prev, { identity, text }])
        return
      }

      // ── Agent transcript_chunk (faster-whisper, every ~3 s) ──
      if (type === 'transcript_chunk') {
        agentActiveRef.current = true
        if (!text) return

        setCallNotes(prev => [...prev, { identity, text }])

        const isLocal = identity === userName
        if (isLocal) {
          // For the local user: only show agent caption when Chrome SR is unavailable
          // (Chrome SR already provides faster interim captions when available)
          if (!browserHasSpeech) {
            setLiveText(text)
            setTimeout(() => setLiveText(''), 4000)
          }
        } else {
          // For remote participants: show caption for 4 s then clear
          setRemoteLiveTexts(prev => ({ ...prev, [identity]: text }))
          if (clearTimersRef.current[identity]) clearTimeout(clearTimersRef.current[identity])
          clearTimersRef.current[identity] = setTimeout(() => {
            setRemoteLiveTexts(prev => ({ ...prev, [identity]: '' }))
          }, 4000)
        }
        return
      }

      // ── Agent session_transcript (sent when the room closes) ──
      if (type === 'session_transcript') {
        if (text) setFinalTranscript(text)
      }
    },
    // browserHasSpeech and userName don't change after mount; agentActiveRef is a ref
    [userName, browserHasSpeech],
  )

  return {
    liveText,
    remoteLiveTexts,
    callNotes,
    finalTranscript,
    browserHasSpeech,
    handleRemoteMessage,
  }
}
