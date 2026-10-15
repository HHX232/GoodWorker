'use client'

import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useRef } from 'react'
import type { NoteEntry } from '../types'
import { sourceRects, tileGrid } from './tileGrid'

const TICK_MS = 60_000
const MAX_TRANSCRIPT = 12_000

type Scene = { elements: readonly ExcalidrawElement[]; files: BinaryFiles }

interface Board {
  active: boolean
  elements: readonly ExcalidrawElement[] | null
  files: BinaryFiles | null
  /** Live scene from CallWhiteboard's onSceneApi; elements/files are the fallback until it exists. */
  read?: () => Scene | null
}

interface Options {
  /** isOwner && room.connected — only the owner has every line and the full board. */
  enabled: boolean
  roomName: string
  callNotes: NoteEntry[]
  board: Board
}

/** Board → JPEG tiles (≤ 2000 px, ≤ 6). snapshotBoard pulls excalidraw/three, so it loads lazily. */
// ponytail: snapshotBoard rasterises the WHOLE board at 2× before tiling, so a huge board can
// exceed the browser canvas ceiling (iOS ~16.7 MP) and come back empty — then we only warn.
// Upgrade path: render per tile (exportToCanvas over each tile's bounds) instead of one big canvas.
async function boardTiles(scene: Scene): Promise<Blob[]> {
  const { snapshotBoard } = await import('@/widgets/Lecture/board/boardSnapshot')
  const snap = await snapshotBoard(scene)
  if (!snap) return []
  const img = await createImageBitmap(snap.blob)
  const grid = tileGrid(img.width, img.height)
  const src = sourceRects(img.width, img.height, grid)
  const out: Blob[] = []
  for (const [i, t] of grid.tiles.entries()) {
    const canvas = document.createElement('canvas')
    canvas.width = t.w
    canvas.height = t.h
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    const r = src[i]
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, t.w, t.h)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (blob) out.push(blob)
  }
  img.close()
  return out
}

/**
 * Background auto-notes for the call owner: every 60 s sends the new transcript
 * lines and, if the whiteboard changed, its snapshot tiles to POST /api/call/notes.
 * No UI — failures only console.warn. flush() is the final tick before finish.
 */
export function useCallNotes({ enabled, roomName, callNotes, board }: Options): { flush: () => Promise<void> } {
  const latest = useRef({ enabled, callNotes, board })
  useEffect(() => { latest.current = { enabled, callNotes, board } })

  const sentCount = useRef(0) // callNotes accepted by the server ({ok:true})
  const seq = useRef(0)
  const sentBoardHash = useRef('')
  const stopped = useRef(false) // NO_AI → silent for the rest of the call
  const inFlight = useRef<Promise<void> | null>(null)

  const run = useCallback(async () => {
    const { callNotes: notes, board: b } = latest.current
    const end = notes.length
    // Tail ≤ MAX_TRANSCRIPT by whole lines; a single oversized line is the only thing cut mid-line.
    const lines = notes.slice(sentCount.current, end).map(n => `${n.identity}: ${n.text}`)
    let size = lines.reduce((s, l) => s + l.length + 1, -1)
    let dropped = 0
    while (size > MAX_TRANSCRIPT && lines.length - dropped > 1) size -= lines[dropped++].length + 1
    if (dropped) console.warn(`[callNotes] transcript over ${MAX_TRANSCRIPT} chars, dropped ${dropped} oldest lines`)
    const transcript = lines.slice(dropped).join('\n').slice(-MAX_TRANSCRIPT)

    let photos: Blob[] = []
    let hash = ''
    if (b.active) {
      let scene: Scene | null = null
      try { scene = b.read?.() ?? null } catch (e) { console.warn('[callNotes] live board read failed', e) }
      scene ??= { elements: b.elements ?? [], files: b.files ?? {} }
      const live = scene.elements.filter(e => !e.isDeleted)
      if (live.length) {
        // A file arriving for an already-sent scene (image loaded later) also counts as a change.
        hash = live.map(e => `${e.id}:${e.version}`).join('|') + '#' + Object.keys(scene.files).sort().join(',')
        if (hash !== sentBoardHash.current) {
          try { photos = await boardTiles(scene) } catch (e) { console.warn('[callNotes] board snapshot failed', e) }
          if (!photos.length) console.warn('[callNotes] non-empty board gave an empty snapshot')
        }
      }
    }
    if (!transcript && !photos.length) return

    // ponytail: at-least-once — after a 502/lost response the same lines go again under a new seq;
    // if the server had saved them and only the answer was lost, the notes get a duplicate.
    // Upgrade path: reuse the seq for the unconfirmed range and let the server dedupe by seq.
    seq.current += 1
    const fd = new FormData()
    fd.append('roomName', roomName)
    fd.append('seq', String(seq.current))
    fd.append('transcript', transcript)
    photos.forEach((p, i) => fd.append('photo', p, `board-${i + 1}.jpg`))

    try {
      const res = await fetch('/api/call/notes', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null) as { ok?: boolean; reason?: string; board?: string } | null
      if (res.ok && data?.ok) {
        sentCount.current = end
        // board:'failed' — text saved, board reading failed: keep the hash stale so the board goes again.
        if (photos.length && data.board !== 'failed') sentBoardHash.current = hash
        if (data.board === 'failed') console.warn('[callNotes] board reading failed, retry next tick')
      } else if (data?.reason === 'NO_AI') {
        stopped.current = true
      } else {
        console.warn('[callNotes] tick failed', res.status, data)
      }
    } catch (e) {
      console.warn('[callNotes] tick failed', e)
    }
  }, [roomName])

  // One request at a time: a tick while one is in flight just joins it.
  const tick = useCallback(() => {
    if (stopped.current || !roomName) return Promise.resolve()
    inFlight.current ??= run().finally(() => { inFlight.current = null })
    return inFlight.current
  }, [run, roomName])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => { void tick() }, TICK_MS)
    return () => clearInterval(id)
  }, [enabled, tick])

  const flush = useCallback(async () => {
    if (!latest.current.enabled) return
    await inFlight.current // let a running tick land, then send what's left
    await tick()
  }, [tick])

  return { flush }
}
