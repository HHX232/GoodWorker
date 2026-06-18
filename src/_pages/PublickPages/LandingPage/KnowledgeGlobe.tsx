'use client'
import { useEffect, useRef } from 'react'

interface Vec3 { x: number; y: number; z: number }

const phi = (i: number, n: number) => Math.acos(-1 + (2 * i) / n)
const theta = (i: number, n: number) => Math.sqrt(n * Math.PI) * phi(i, n)

function fibSphere(n: number, r: number): Vec3[] {
  return Array.from({ length: n }, (_, i) => ({
    x: r * Math.cos(theta(i, n)) * Math.sin(phi(i, n)),
    y: r * Math.sin(theta(i, n)) * Math.sin(phi(i, n)),
    z: r * Math.cos(phi(i, n)),
  }))
}

function rotateX(p: Vec3, a: number): Vec3 {
  return { x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) }
}
function rotateY(p: Vec3, a: number): Vec3 {
  return { x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) }
}
function project(p: Vec3, fov: number, cx: number, cy: number) {
  const z = p.z + fov
  return { sx: (p.x * fov) / z + cx, sy: (p.y * fov) / z + cy, scale: fov / z }
}

const LABELS = [
  'Курс · React', 'Звонок · Анна', 'Пост · TypeScript', 'Тест · JSX',
  'Учитель · Дмитрий', 'Курс · CSS', 'Дедлайн · TODO', 'Курс · Next.js',
  'Урок · Хуки', 'Пост · Node.js', 'Учитель · Мария', 'Курс · Python',
]

const N = 44
const R = 1.0
const FOV = 3.5

export default function KnowledgeGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodes = fibSphere(N, R)
    const stride = Math.floor(N / LABELS.length)
    const labelSet = new Set(LABELS.map((_, k) => k * stride + 1))

    const edges: [number, number][] = []
    const edgeSet = new Set<string>()
    nodes.forEach((p, i) => {
      const sorted = nodes
        .map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) }))
        .filter(x => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
      sorted.forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push([i, j]) }
      })
    })

    let rotX = 0.2, rotY = 0
    let dragging = false, lastX = 0, lastY = 0
    let raf = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      canvas.style.width = container.clientWidth + 'px'
      canvas.style.height = container.clientHeight + 'px'
      ctx.scale(dpr, dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      rotY += (e.clientX - lastX) * 0.01
      rotX += (e.clientY - lastY) * 0.01
      rotX = Math.max(-1.3, Math.min(1.3, rotX))
      lastX = e.clientX; lastY = e.clientY
    }
    const onUp = () => { dragging = false }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    let t = 0
    const draw = (dt: number) => {
      t += dt
      if (!dragging) rotY += 0.004

      const W = container.clientWidth
      const H = container.clientHeight
      const cx = W / 2, cy = H / 2
      const scale = Math.min(W, H) * 0.38

      ctx.clearRect(0, 0, W, H)

      const transformed = nodes.map(p => rotateY(rotateX(p, rotX), rotY))
      const projected = transformed.map(p => project(
        { x: p.x * scale, y: p.y * scale, z: p.z * scale },
        FOV * scale, cx, cy
      ))

      // subtle ring
      ctx.save()
      ctx.strokeStyle = 'rgba(147,51,234,0.13)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const ringR = scale * 1.08
      ctx.ellipse(cx, cy, ringR, ringR * 0.38, rotX * 0.4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // edges
      edges.forEach(([a, b]) => {
        const pa = projected[a], pb = projected[b]
        const depthFade = ((projected[a].scale + projected[b].scale) / 2 - 0.4) / 0.6
        ctx.beginPath()
        ctx.moveTo(pa.sx, pa.sy)
        ctx.lineTo(pb.sx, pb.sy)
        ctx.strokeStyle = `rgba(167,139,250,${Math.max(0, depthFade * 0.35)})`
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // nodes
      const sorted = projected
        .map((p, i) => ({ ...p, i }))
        .sort((a, b) => a.scale - b.scale)

      sorted.forEach(({ sx, sy, scale: s, i }) => {
        const isLabeled = labelSet.has(i)
        const depth = (s - 0.4) / 0.6
        const pulse = 1 + Math.sin(t * 2 + i * 0.7) * 0.08

        if (isLabeled) {
          const r = 5 * s * pulse
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(147,51,234,${0.5 + depth * 0.5})`
          ctx.fill()

          // label
          if (depth > 0.3) {
            ctx.font = `${Math.round(10 * s)}px -apple-system, sans-serif`
            ctx.fillStyle = `rgba(90,30,180,${Math.max(0, (depth - 0.3) * 1.4)})`
            ctx.textAlign = 'left'
            const lbl = LABELS[Array.from(labelSet).indexOf(i)]
            if (lbl) ctx.fillText(lbl, sx + r + 3, sy + 3)
          }
        } else {
          const r = (i % 3 === 0 ? 3 : 2) * s
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(14,14,18,${0.25 + depth * 0.45})`
          ctx.fill()
        }
      })

      // live badge
      ctx.font = '11px JetBrains Mono, monospace'
      ctx.fillStyle = 'rgba(124,58,237,0.65)'
      ctx.textAlign = 'left'
      ctx.fillText('knowledge_graph · live', 12, 22)
    }

    let last = performance.now()
    const loop = (now: number) => {
      draw((now - last) / 1000)
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480 }}>
      <div style={{
        position: 'absolute', inset: '10% 5%', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 45%, rgba(168,85,247,0.22), rgba(124,58,237,0.07) 50%, transparent 70%)',
        filter: 'blur(8px)',
      }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'grab' }}
      />
    </div>
  )
}
