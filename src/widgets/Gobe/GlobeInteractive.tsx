"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import createGlobe from "cobe"
import styles from "./GlobeInteractive.module.scss"

interface InteractiveMarker {
  id: string
  location: [number, number]
  name: string
  users: number
}

interface GlobeInteractiveProps {
  markers?: InteractiveMarker[]
  className?: string
  speed?: number
}

const defaultMarkers: InteractiveMarker[] = [
  { id: "hq",      location: [37.78,  -122.44], name: "HQ",    users: 1420 },
  { id: "eu",      location: [52.52,    13.41], name: "EU",    users: 892  },
  { id: "asia",    location: [35.68,   139.65], name: "Asia",  users: 2103 },
  { id: "latam",   location: [-23.55,  -46.63], name: "LATAM", users: 567  },
  { id: "mena",    location: [25.2,     55.27], name: "MENA",  users: 734  },
  { id: "oceania", location: [-33.87,  151.21], name: "APAC",  users: 445  },
]

export function GlobeInteractive({
  markers = defaultMarkers,
  className = "",
  speed = 0.003,
}: GlobeInteractiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi:   (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup",   handlePointerUp,   { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup",   handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    function init() {
      const width = canvas.offsetWidth
      if (width === 0) return
      if (globe) return

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width, height: width,
        phi: 0, theta: 0.2,
        dark: 0, diffuse: 1.5,
        mapSamples: 16000, mapBrightness: 10,
        baseColor:   [1, 1, 1],
        markerColor: [0.1, 0.2, 0.45],
        glowColor:   [0.94, 0.93, 0.91],
        markerElevation: 0,
        markers: markers.map((m) => ({ location: m.location, size: 0.025, id: m.id })),
        arcs: [], arcColor: [0.15, 0.3, 0.55],
        arcWidth: 0.5, arcHeight: 0.25, opacity: 0.7,
      })

      function animate() {
        if (!isPausedRef.current) phi += speed
        globe!.update({
          phi:   phi + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed])

  return (
    <div className={`${styles.root} ${className}`}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={handlePointerDown}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          onClick={() => setExpanded(expanded === m.id ? null : m.id)}
          className={`${styles.marker} ${expanded === m.id ? styles.markerExpanded : ""}`}
          style={{
            positionAnchor: `--cobe-${m.id}`,
            bottom: "anchor(top)",
            left: "anchor(center)",
            opacity: `var(--cobe-visible-${m.id}, 0)`,
            filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
          }}
        >
          <span className={styles.markerName}>{m.name}</span>
          {expanded === m.id && (
            <span className={styles.markerUsers}>
              {m.users.toLocaleString()} учеников
            </span>
          )}
        </div>
      ))}
    </div>
  )
}