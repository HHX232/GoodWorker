'use client'
import { readPref, useLocalPref } from './localPref'

// Move sounds synthesised with WebAudio — no audio files. Respects the `gw-chess-sound` switch.
const KEY = 'gw-chess-sound'
export type MoveSoundKind = 'move' | 'capture' | 'check' | 'end'

let ctx: AudioContext | null = null

function tock(ac: AudioContext, at: number, freq: number, gain: number, dur: number) {
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 4
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(bp).connect(g).connect(ac.destination)
  src.start(at)
}

function tone(ac: AudioContext, at: number, freq: number, gain: number, dur: number) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(ac.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

export function playMoveSound(kind: MoveSoundKind) {
  if (typeof window === 'undefined' || readPref(KEY) === 'off') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime + 0.005
    if (kind === 'move') tock(ctx, t, 1400, 1.6, 0.07)
    if (kind === 'capture') {
      tock(ctx, t, 900, 2.2, 0.09)
      tock(ctx, t + 0.045, 1700, 1.4, 0.06)
    }
    if (kind === 'check') {
      tock(ctx, t, 1400, 1.4, 0.07)
      tone(ctx, t + 0.03, 1046, 0.12, 0.25)
    }
    if (kind === 'end') {
      tone(ctx, t, 523, 0.14, 0.5)
      tone(ctx, t + 0.16, 784, 0.12, 0.7)
    }
  } catch {
    // no WebAudio — silent
  }
}

export function useSoundEnabled(): [boolean, (on: boolean) => void] {
  const [v, set] = useLocalPref(KEY, 'on')
  return [v !== 'off', (on) => set(on ? 'on' : 'off')]
}
