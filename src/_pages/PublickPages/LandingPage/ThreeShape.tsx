'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Kind = 'ico' | 'cube' | 'torus'

interface Props {
  kind: Kind
  accent: string
  size?: number
  labels?: string[]
}

export default function ThreeShape({ kind, accent, size = 140, labels = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    // ── Scene ───────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = kind === 'cube' ? 3.6 : 3.2

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(dpr)
    container.appendChild(renderer.domElement)

    let accentHex = 0xff7a3d
    try {
      if (accent.startsWith('#')) accentHex = parseInt(accent.slice(1), 16)
    } catch {}

    const group = new THREE.Group()
    const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = []

    // ── ICO ─────────────────────────────────────────────────
    if (kind === 'ico') {
      const g1 = new THREE.IcosahedronGeometry(1, 0)
      const m1 = new THREE.MeshBasicMaterial({ color: accentHex, wireframe: true })
      group.add(new THREE.Mesh(g1, m1))
      disposables.push(g1, m1)

      const g2 = new THREE.IcosahedronGeometry(0.6, 0)
      const m2 = new THREE.MeshBasicMaterial({ color: 0x0e0e12 })
      group.add(new THREE.Mesh(g2, m2))
      disposables.push(g2, m2)

      const dotGeo = new THREE.SphereGeometry(0.07, 8, 8)
      const errMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
      const accMat = new THREE.MeshBasicMaterial({ color: accentHex })
      disposables.push(dotGeo, errMat, accMat)

      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2
        const dot = new THREE.Mesh(dotGeo, i % 2 ? errMat : accMat)
        dot.position.set(Math.cos(ang) * 1.35, Math.sin(ang) * 1.35, 0)
        dot.userData = { angle: ang }
        group.add(dot)
      }
    }

    // ── CUBE ────────────────────────────────────────────────
    else if (kind === 'cube') {
      const faces = labels.length === 6 ? labels : ['AI', '?', '✓', 'JSX', '10×', 'QUIZ']
      const r = (accentHex >> 16) & 0xff
      const g = (accentHex >> 8) & 0xff
      const b = accentHex & 0xff
      const accentRGB = `rgb(${r},${g},${b})`

      const mats = faces.map((text, i) => {
        const c = document.createElement('canvas')
        c.width = c.height = 256
        const ctx = c.getContext('2d')!
        ctx.fillStyle = i % 2 ? '#0e0e12' : accentRGB
        ctx.fillRect(0, 0, 256, 256)
        ctx.strokeStyle = i % 2 ? accentRGB : '#0e0e12'
        ctx.lineWidth = 6
        ctx.strokeRect(14, 14, 228, 228)
        ctx.fillStyle = '#fff'
        const isSymbol = text.length <= 2 && /[?✓×]/.test(text)
        ctx.font = `bold ${isSymbol ? 150 : 78}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 128, 138)
        const tex = new THREE.CanvasTexture(c)
        tex.minFilter = THREE.LinearFilter
        disposables.push(tex)
        const mat = new THREE.MeshBasicMaterial({ map: tex })
        disposables.push(mat)
        return mat
      })

      const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5)
      disposables.push(geo)
      group.add(new THREE.Mesh(geo, mats))
    }

    // ── TORUS ───────────────────────────────────────────────
    else if (kind === 'torus') {
      const g1 = new THREE.TorusGeometry(0.95, 0.32, 16, 64)
      const m1 = new THREE.MeshBasicMaterial({ color: accentHex })
      group.add(new THREE.Mesh(g1, m1))
      disposables.push(g1, m1)

      const g2 = new THREE.TorusGeometry(0.95, 0.32, 16, 64)
      const m2 = new THREE.MeshBasicMaterial({ color: 0x0e0e12, wireframe: true, transparent: true, opacity: 0.35 })
      group.add(new THREE.Mesh(g2, m2))
      disposables.push(g2, m2)

      const dotGeo = new THREE.IcosahedronGeometry(0.12, 0)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x0e0e12 })
      disposables.push(dotGeo, dotMat)

      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2
        const dot = new THREE.Mesh(dotGeo, dotMat)
        dot.position.set(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6 * 0.4, Math.sin(ang) * 0.6)
        dot.userData = { angle: ang, orbit: true }
        group.add(dot)
      }
    }

    scene.add(group)

    // ── Drag rotation ───────────────────────────────────────
    const drag = { active: false, x: 0, y: 0, rx: 0, ry: 0, vx: 0, vy: 0 }

    const onDown = (e: PointerEvent) => {
      drag.active = true; drag.x = e.clientX; drag.y = e.clientY
      drag.rx = group.rotation.x; drag.ry = group.rotation.y
      drag.vx = 0; drag.vy = 0
      container.style.cursor = 'grabbing'
      container.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag.active) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      drag.vx = dy * 0.01; drag.vy = dx * 0.01
      group.rotation.x = drag.rx + dy * 0.012
      group.rotation.y = drag.ry + dx * 0.012
    }
    const onUp = (e: PointerEvent) => {
      drag.active = false
      container.style.cursor = 'grab'
      try { container.releasePointerCapture(e.pointerId) } catch {}
    }
    container.addEventListener('pointerdown', onDown)
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerup',   onUp)
    container.addEventListener('pointercancel', onUp)
    container.style.cursor      = 'grab'
    container.style.touchAction = 'none'

    // ── Animation ───────────────────────────────────────────
    let raf = 0
    let t = 0
    let last = performance.now()

    const animate = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      t += dt

      if (drag.active) {
        // while dragging: only orbit dots/torus dots, no auto-rotate
      } else if (kind === 'cube') {
        group.rotation.x += dt * 0.35
        group.rotation.y += dt * 0.5
      } else if (kind === 'torus') {
        // apply inertia
        drag.vx *= 0.92; drag.vy *= 0.92
        group.rotation.x += drag.vx + Math.sin(t * 0.5) * 0.003
        group.rotation.y += drag.vy + dt * 0.7
        group.children.forEach(c => {
          if (c.userData.orbit) {
            const ang = c.userData.angle + t * 0.8
            c.position.set(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6 * 0.4, Math.sin(ang) * 0.6)
          }
        })
      } else {
        drag.vx *= 0.92; drag.vy *= 0.92
        group.rotation.x += drag.vx + dt * 0.3
        group.rotation.y += drag.vy + dt * 0.45
        group.children.forEach(c => {
          if (c.userData.angle != null && !c.userData.orbit) {
            const ang = c.userData.angle + t * 0.5
            c.position.set(Math.cos(ang) * 1.35, Math.sin(ang) * 1.35, Math.sin(t + ang) * 0.3)
          }
        })
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      container.removeEventListener('pointerdown', onDown)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerup',   onUp)
      container.removeEventListener('pointercancel', onUp)
      disposables.forEach(d => d.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, accent, size])

  return <div ref={ref} style={{ width: size, height: size }} />
}
