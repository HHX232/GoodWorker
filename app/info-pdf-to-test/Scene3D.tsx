'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ── Weight constants ──────────────────────────────────────────
const W_FRAME = 0.052, W_TEXT = 0.034, W_PHOTO = 0.03, W_MOTIF = 0.05, W_RING = 0.046, W_BOLD = 0.058
const TT_N = 1600

type P4 = [number, number, number, number]

function tw(arr: number[][], w: number): P4[] { return arr.map(p => [p[0], p[1], p[2], w]) as P4[] }
function tline(x0: number, x1: number, y: number, z = 0, step = 0.04, jz = 0.035): number[][] {
  const out: number[][] = [], n = Math.max(1, Math.round(Math.abs(x1 - x0) / step))
  for (let i = 0; i <= n; i++) out.push([x0 + (x1 - x0) * (i / n), y + (Math.random() - 0.5) * 0.012, z + (Math.random() - 0.5) * jz])
  return out
}
function tvline(x: number, y0: number, y1: number, step = 0.04): number[][] {
  const out: number[][] = [], n = Math.max(1, Math.round(Math.abs(y1 - y0) / step))
  for (let i = 0; i <= n; i++) out.push([x + (Math.random() - 0.5) * 0.01, y0 + (y1 - y0) * (i / n), (Math.random() - 0.5) * 0.035])
  return out
}
function trect(x0: number, x1: number, y0: number, y1: number, step?: number): number[][] {
  return [...tline(x0, x1, y1, 0, step), ...tline(x0, x1, y0, 0, step), ...tvline(x0, y0, y1, step), ...tvline(x1, y0, y1, step)]
}
function tarc(cx: number, cy: number, r: number, a0: number, a1: number, count: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i < count; i++) { const a = a0 + (a1 - a0) * (i / (count - 1)); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, (Math.random() - 0.5) * 0.035]) }
  return out
}
function tring(cx: number, cy: number, r: number, count: number, fill: boolean): number[][] {
  const out: number[][] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, rr = fill ? r * Math.sqrt(Math.random()) : r + (Math.random() - 0.5) * 0.006
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (Math.random() - 0.5) * 0.035])
  }
  return out
}
function tseg(x0: number, y0: number, x1: number, y1: number, step = 0.04): number[][] {
  const out: number[][] = [], len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / step))
  for (let i = 0; i <= n; i++) {
    const tt = i / n
    out.push([x0 + (x1 - x0) * tt + (Math.random() - 0.5) * 0.012, y0 + (y1 - y0) * tt + (Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.035])
  }
  return out
}
function tfillRect(x0: number, x1: number, y0: number, y1: number, sx: number, sy: number): number[][] {
  const out: number[][] = []
  for (let x = x0; x <= x1 + 1e-6; x += sx)
    for (let y = y0; y <= y1 + 1e-6; y += sy)
      out.push([x + (Math.random() - 0.5) * sx * 0.6, y + (Math.random() - 0.5) * sy * 0.6, (Math.random() - 0.5) * 0.05])
  return out
}
function troundRect(x0: number, x1: number, y0: number, y1: number, r: number, step?: number): number[][] {
  const s = step ?? 0.045, out: number[][] = []
  out.push(...tline(x0 + r, x1 - r, y1, 0, s), ...tline(x0 + r, x1 - r, y0, 0, s))
  out.push(...tvline(x0, y0 + r, y1 - r, s), ...tvline(x1, y0 + r, y1 - r, s))
  out.push(...tarc(x1 - r, y1 - r, r, 0, Math.PI / 2, 8), ...tarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, 8))
  out.push(...tarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 8), ...tarc(x1 - r, y0 + r, r, Math.PI * 1.5, Math.PI * 2, 8))
  return out
}
function tphoto(x0: number, x1: number, y0: number, y1: number, fs?: number): P4[] {
  const p: P4[] = []
  p.push(...tw(trect(x0, x1, y0, y1, fs ?? 0.07), W_FRAME))
  const sunX = x0 + (x1 - x0) * 0.72, sunY = y0 + (y1 - y0) * 0.74
  p.push(...tw(tring(sunX, sunY, (x1 - x0) * 0.09, 16, false), W_MOTIF))
  const by = y0 + (y1 - y0) * 0.16
  p.push(...tw(tseg(x0 + 0.02, by, x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.62), W_MOTIF))
  p.push(...tw(tseg(x0 + (x1 - x0) * 0.34, y0 + (y1 - y0) * 0.62, x0 + (x1 - x0) * 0.6, by), W_MOTIF))
  p.push(...tw(tseg(x0 + (x1 - x0) * 0.45, by, x0 + (x1 - x0) * 0.78, y0 + (y1 - y0) * 0.5), W_MOTIF))
  p.push(...tw(tseg(x0 + (x1 - x0) * 0.78, y0 + (y1 - y0) * 0.5, x1 - 0.02, by), W_MOTIF))
  p.push(...tw(tfillRect(x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, 0.16, 0.16), W_PHOTO))
  return p
}

function stageUpload(): P4[] {
  const p: P4[] = []
  p.push(...tw(tarc(-0.42, 0.18, 0.3, Math.PI * 0.5, Math.PI * 1.5, 16), W_FRAME))
  p.push(...tw(tarc(0.02, 0.34, 0.42, Math.PI * 0.05, Math.PI * 0.98, 22), W_FRAME))
  p.push(...tw(tarc(0.5, 0.16, 0.32, -Math.PI * 0.5, Math.PI * 0.5, 16), W_FRAME))
  p.push(...tw(tline(-0.42, 0.5, -0.14, 0, 0.045), W_FRAME))
  p.push(...tw(tseg(0.04, -0.05, 0.04, 0.5, 0.04), W_BOLD))
  p.push(...tw(tseg(-0.18, 0.28, 0.04, 0.52, 0.035), W_BOLD))
  p.push(...tw(tseg(0.26, 0.28, 0.04, 0.52, 0.035), W_BOLD))
  p.push(...tw(tline(-0.5, 0.0, -0.62, 0, 0.05), W_TEXT))
  p.push(...tw(tline(0.08, 0.55, -0.62, 0, 0.05), W_TEXT))
  return p
}
function stageScan(): P4[] {
  const p: P4[] = [], cx = 0, cy = 0.04, R = 0.66
  p.push(...tw(tring(cx, cy, R, 130, false), W_FRAME))
  p.push(...tw(tarc(cx, cy, R, Math.PI * 0.5, Math.PI * 1.15, 46), W_BOLD))
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    p.push([cx + Math.cos(a) * (R - 0.08), cy + Math.sin(a) * (R - 0.08), 0, W_TEXT])
    p.push([cx + Math.cos(a) * (R - 0.02), cy + Math.sin(a) * (R - 0.02), 0, W_TEXT])
  }
  p.push(...tw(tring(cx, cy, R * 0.46, 40, false), W_TEXT))
  p.push(...tw(tseg(cx, cy, cx + 0.28, cy + 0.4, 0.035), W_BOLD));
  [-0.34, 0, 0.34].forEach(dx => p.push(...tw(tring(dx, -0.86, 0.05, 10, true), W_RING)))
  p.push(...tw(tring(cx, cy, 0.06, 14, true), W_RING))
  return p
}
function stageDoc(): P4[] {
  const p: P4[] = []
  p.push(...tw(troundRect(-1.2, 1.2, -1.18, 1.18, 0.12, 0.085), W_FRAME))
  p.push(...tw(tline(-1.0, -0.2, 1.0, 0, 0.04), W_BOLD))
  p.push(...tphoto(-1.02, 0.05, 0.28, 0.86));
  [0.74, 0.58, 0.42, 0.26].forEach(y => p.push(...tw(tline(0.2, 0.2 + 0.3 + Math.random() * 0.6, y, 0, 0.05), W_TEXT)))
  const ys: number[] = []; for (let y = 0.08; y >= -1.02; y -= 0.145) ys.push(y)
  ys.forEach((y, i) => { const w = (i % 4 === 3) ? 0.5 + Math.random() * 0.5 : 1.6 + Math.random() * 0.55; p.push(...tw(tline(-1.02, Math.min(1.05, -1.02 + w), y, 0, 0.05), W_TEXT)) })
  return p
}
function stageTest(): P4[] {
  const p: P4[] = []
  p.push(...tw(troundRect(-1.32, 1.32, -1.14, 1.14, 0.12, 0.085), W_FRAME))
  p.push(...tphoto(-1.08, -0.2, 0.44, 0.98, 0.08));
  [0.86, 0.68, 0.5].forEach((y, i) => p.push(...tw(tline(-0.04, [1.08, 0.74, 0.92][i], y, 0, 0.05), W_TEXT)));
  [0.16, -0.16, -0.48, -0.8].forEach((y, i) => {
    const sel = i === 1
    p.push(...tw(troundRect(-1.12, -0.92, y - 0.1, y + 0.1, 0.04, 0.03), sel ? W_BOLD : W_RING))
    if (sel) { p.push(...tw(tseg(-1.075, y - 0.005, -1.03, y - 0.05, 0.016), W_BOLD)); p.push(...tw(tseg(-1.03, y - 0.05, -0.955, y + 0.05, 0.016), W_BOLD)) }
    p.push(...tw(tline(-0.82, -0.82 + 0.85 + Math.random() * 0.85, y, 0, 0.05), W_TEXT))
  })
  p.push(...tw(tline(-1.12, 1.12, -1.0, 0, 0.05), W_TEXT))
  p.push(...tw(tline(-1.12, 0.2, -1.0, 0.01, 0.03), W_BOLD))
  return p
}

function ttFit(arr: P4[], n: number): P4[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] }
  if (a.length > n) return a.slice(0, n)
  while (a.length < n) { const s = a[(Math.random() * arr.length) | 0]; a.push([s[0] + (Math.random() - 0.5) * 0.05, s[1] + (Math.random() - 0.5) * 0.05, s[2] + (Math.random() - 0.5) * 0.05, s[3]]) }
  return a
}
function toPos(arr: P4[]): Float32Array { const f = new Float32Array(arr.length * 3); arr.forEach((p, i) => { f[i * 3] = p[0]; f[i * 3 + 1] = p[1]; f[i * 3 + 2] = p[2] }); return f }
function toSize(arr: P4[]): Float32Array { const f = new Float32Array(arr.length); arr.forEach((p, i) => { f[i] = p[3] ?? W_TEXT }); return f }

const VERT = `
  attribute float aSize;
  attribute float aSeed;
  uniform float uScale;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    pos.z += sin(uTime * 1.6 + aSeed * 6.28) * 0.012;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = max(0.1, -mv.z);
    vAlpha = clamp(1.7 - depth * 0.16, 0.22, 1.0);
    gl_PointSize = aSize * uScale / depth;
  }
`
const FRAG = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.30, d) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`

export default function Scene3D({ height = 440, onStage }: { height?: number; onStage?: (idx: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onStageRef = useRef(onStage)
  onStageRef.current = onStage

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let w = wrap.clientWidth || 600
    let h = wrap.clientHeight || height
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scene = new THREE.Scene()
    const FOV = 45
    const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100)
    camera.position.z = 4.8
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(dpr); renderer.setSize(w, h); wrap.appendChild(renderer.domElement)
    const scaleFor = (hh: number) => (hh * dpr) / (2 * Math.tan((FOV * Math.PI / 180) / 2))

    const raw = [stageUpload(), stageScan(), stageDoc(), stageTest()].map(s => ttFit(s, TT_N))
    const stagePos = raw.map(toPos)
    const stageSize = raw.map(toSize)
    const size = new Float32Array(stageSize[0])
    const seeds = new Float32Array(TT_N), delays = new Float32Array(TT_N), dir = new Float32Array(TT_N * 2)
    for (let i = 0; i < TT_N; i++) {
      seeds[i] = Math.random(); delays[i] = Math.random() * 0.28
      const a = Math.random() * Math.PI * 2; dir[i * 2] = Math.cos(a); dir[i * 2 + 1] = Math.sin(a)
    }
    const pos = new Float32Array(stagePos[0])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    const isDark = () =>
      document.documentElement.classList.contains('theme-dark') ||
      document.documentElement.classList.contains('pomodoro-dark')
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(isDark() ? 0xe0e0de : 0x0c0c0d) }, uScale: { value: scaleFor(h) }, uTime: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    const group = new THREE.Group(); group.add(points); scene.add(group)
    const syncColor = () => mat.uniforms.uColor.value.set(isDark() ? 0xe0e0de : 0x0c0c0d)
    const mo = new MutationObserver(syncColor)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const HOLD = 1800, TRANS = 1900, STEP = HOLD + TRANS
    const smooth = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10)
    const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x

    let raf: number; const start = performance.now(); let mx = 0, my = 0, tmx = 0, tmy = 0, lastStage = -1
    const onMove = (e: PointerEvent) => { const r = wrap.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width - 0.5; tmy = (e.clientY - r.top) / r.height - 0.5 }
    const onLeave = () => { tmx = 0; tmy = 0 }
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const elapsed = performance.now() - start
      mat.uniforms.uTime.value = elapsed * 0.001
      let phase, p, transitioning
      if (reduce) { phase = 3; p = 0; transitioning = false }
      else {
        phase = Math.floor(elapsed / STEP) % 4
        const tl = elapsed % STEP; transitioning = tl > HOLD; p = transitioning ? (tl - HOLD) / TRANS : 0
      }
      const nxt = (phase + 1) % 4
      const fromP = stagePos[phase], toP = stagePos[nxt]
      const fromS = stageSize[phase], toS = stageSize[nxt]
      for (let i = 0; i < TT_N; i++) {
        const ix = i * 3, d = delays[i], e = smooth(clamp01((p - d) / (1 - 0.28)))
        let x = fromP[ix] + (toP[ix] - fromP[ix]) * e
        let y = fromP[ix + 1] + (toP[ix + 1] - fromP[ix + 1]) * e
        let z = fromP[ix + 2] + (toP[ix + 2] - fromP[ix + 2]) * e
        if (transitioning) { const curl = Math.sin(Math.PI * e) * 0.16; x += -dir[i * 2 + 1] * curl; y += dir[i * 2] * curl; z += Math.sin(Math.PI * e + seeds[i] * 6.28) * 0.12 }
        pos[ix] = x; pos[ix + 1] = y; pos[ix + 2] = z; size[i] = fromS[i] + (toS[i] - fromS[i]) * e
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aSize.needsUpdate = true
      const active = transitioning && p > 0.5 ? nxt : phase
      if (active !== lastStage) { lastStage = active; onStageRef.current?.(active) }
      const t = elapsed * 0.001
      group.rotation.y = Math.sin(t * 0.32) * 0.1 + mx * 0.38
      group.rotation.x = Math.cos(t * 0.27) * 0.055 - my * 0.26
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05
      renderer.render(scene, camera)
    }
    loop()

    const ro = new ResizeObserver(() => {
      w = wrap.clientWidth; h = wrap.clientHeight; if (!w || !h) return
      camera.aspect = w / h; camera.updateProjectionMatrix()
      renderer.setSize(w, h); mat.uniforms.uScale.value = scaleFor(h)
    })
    ro.observe(wrap)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect()
      wrap.removeEventListener('pointermove', onMove); wrap.removeEventListener('pointerleave', onLeave)
      geo.dispose(); mat.dispose(); renderer.dispose()
      renderer.domElement.parentNode?.removeChild(renderer.domElement)
    }
  }, [height])

  return <div ref={wrapRef} style={{ width: '100%', height, position: 'relative', cursor: 'crosshair' }} />
}
