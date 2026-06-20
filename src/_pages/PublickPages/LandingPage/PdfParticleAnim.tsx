'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useThemeCtx } from '@/app/providers/ThemeContext'
import * as THREE from 'three'

// ── Particle count & weights ─────────────────────────────────
const N = 1600
const W_FRAME = 0.052, W_TEXT = 0.034, W_PHOTO = 0.03, W_MOTIF = 0.05
const W_RING  = 0.046, W_BOLD = 0.058

type P4 = [number, number, number, number]  // [x, y, z, weight]

function tw(arr: [number,number,number][], w: number): P4[] {
  return arr.map(p => [p[0], p[1], p[2], w])
}

// ── Geometry helpers ─────────────────────────────────────────
function line(x0: number, x1: number, y: number, z = 0, step = 0.04, jz = 0.035): [number,number,number][] {
  const out: [number,number,number][] = []
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / step))
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n)
    out.push([x, y + (Math.random() - 0.5) * 0.012, z + (Math.random() - 0.5) * jz])
  }
  return out
}
function vline(x: number, y0: number, y1: number, step = 0.04): [number,number,number][] {
  const out: [number,number,number][] = []
  const n = Math.max(1, Math.round(Math.abs(y1 - y0) / step))
  for (let i = 0; i <= n; i++)
    out.push([x + (Math.random()-0.5)*0.01, y0 + (y1-y0)*(i/n), (Math.random()-0.5)*0.035])
  return out
}
function ring(cx: number, cy: number, r: number, count: number, fill = false): [number,number,number][] {
  const out: [number,number,number][] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const rr = fill ? r * Math.sqrt(Math.random()) : r + (Math.random()-0.5)*0.006
    out.push([cx + Math.cos(a)*rr, cy + Math.sin(a)*rr, (Math.random()-0.5)*0.035])
  }
  return out
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, count: number): [number,number,number][] {
  const out: [number,number,number][] = []
  for (let i = 0; i < count; i++) {
    const a = a0 + (a1-a0)*(i/(count-1))
    out.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r, (Math.random()-0.5)*0.035])
  }
  return out
}
function seg(x0: number, y0: number, x1: number, y1: number, step = 0.04): [number,number,number][] {
  const out: [number,number,number][] = []
  const len = Math.hypot(x1-x0, y1-y0)
  const n = Math.max(1, Math.round(len/step))
  for (let i = 0; i <= n; i++) {
    const t = i/n
    out.push([x0+(x1-x0)*t+(Math.random()-0.5)*0.012, y0+(y1-y0)*t+(Math.random()-0.5)*0.012, (Math.random()-0.5)*0.035])
  }
  return out
}
function fillRect(x0: number, x1: number, y0: number, y1: number, sx: number, sy: number): [number,number,number][] {
  const out: [number,number,number][] = []
  for (let x = x0; x <= x1+1e-6; x += sx)
    for (let y = y0; y <= y1+1e-6; y += sy)
      out.push([x+(Math.random()-0.5)*sx*0.6, y+(Math.random()-0.5)*sy*0.6, (Math.random()-0.5)*0.05])
  return out
}
function rect(x0: number, x1: number, y0: number, y1: number, step = 0.04): [number,number,number][] {
  return [...line(x0,x1,y1,0,step), ...line(x0,x1,y0,0,step), ...vline(x0,y0,y1,step), ...vline(x1,y0,y1,step)]
}
function roundRect(x0:number,x1:number,y0:number,y1:number,r:number,step=0.045): [number,number,number][] {
  return [
    ...line(x0+r,x1-r,y1,0,step), ...line(x0+r,x1-r,y0,0,step),
    ...vline(x0,y0+r,y1-r,step), ...vline(x1,y0+r,y1-r,step),
    ...arc(x1-r,y1-r,r,0,Math.PI/2,8), ...arc(x0+r,y1-r,r,Math.PI/2,Math.PI,8),
    ...arc(x0+r,y0+r,r,Math.PI,Math.PI*1.5,8), ...arc(x1-r,y0+r,r,Math.PI*1.5,Math.PI*2,8),
  ]
}

function photo(x0: number, x1: number, y0: number, y1: number, fs = 0.07): P4[] {
  const p: P4[] = []
  p.push(...tw(rect(x0,x1,y0,y1,fs), W_FRAME))
  const sunX = x0+(x1-x0)*0.72, sunY = y0+(y1-y0)*0.74
  p.push(...tw(ring(sunX,sunY,(x1-x0)*0.09,16,false), W_MOTIF))
  const by = y0+(y1-y0)*0.16
  p.push(...tw(seg(x0+0.02,by,x0+(x1-x0)*0.34,y0+(y1-y0)*0.62,0.045), W_MOTIF))
  p.push(...tw(seg(x0+(x1-x0)*0.34,y0+(y1-y0)*0.62,x0+(x1-x0)*0.6,by,0.045), W_MOTIF))
  p.push(...tw(seg(x0+(x1-x0)*0.45,by,x0+(x1-x0)*0.78,y0+(y1-y0)*0.5,0.045), W_MOTIF))
  p.push(...tw(seg(x0+(x1-x0)*0.78,y0+(y1-y0)*0.5,x1-0.02,by,0.045), W_MOTIF))
  p.push(...tw(fillRect(x0+0.05,x1-0.05,y0+0.05,y1-0.05,0.16,0.16), W_PHOTO))
  return p
}

// ── Stages ───────────────────────────────────────────────────
function stageUpload(): P4[] {
  const p: P4[] = []
  p.push(...tw(arc(-0.42,0.18,0.3,Math.PI*0.5,Math.PI*1.5,16), W_FRAME))
  p.push(...tw(arc(0.02,0.34,0.42,Math.PI*0.05,Math.PI*0.98,22), W_FRAME))
  p.push(...tw(arc(0.5,0.16,0.32,Math.PI*-0.5,Math.PI*0.5,16), W_FRAME))
  p.push(...tw(line(-0.42,0.5,-0.14,0,0.045), W_FRAME))
  p.push(...tw(seg(0.04,-0.05,0.04,0.5,0.04), W_BOLD))
  p.push(...tw(seg(-0.18,0.28,0.04,0.52,0.035), W_BOLD))
  p.push(...tw(seg(0.26,0.28,0.04,0.52,0.035), W_BOLD))
  p.push(...tw(line(-0.5,0.0,-0.62,0,0.05), W_TEXT))
  p.push(...tw(line(0.08,0.55,-0.62,0,0.05), W_TEXT))
  return p
}
function stageScan(): P4[] {
  const p: P4[] = []
  const cx=0, cy=0.04, R=0.66
  p.push(...tw(ring(cx,cy,R,130,false), W_FRAME))
  p.push(...tw(arc(cx,cy,R,Math.PI*0.5,Math.PI*1.15,46), W_BOLD))
  for (let k=0; k<24; k++) {
    const a=(k/24)*Math.PI*2, r0=R-0.08, r1=R-0.02
    p.push([cx+Math.cos(a)*r0,cy+Math.sin(a)*r0,0,W_TEXT])
    p.push([cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,0,W_TEXT])
  }
  p.push(...tw(ring(cx,cy,R*0.46,40,false), W_TEXT))
  p.push(...tw(seg(cx,cy,cx+0.28,cy+0.4,0.035), W_BOLD))
  p.push(...tw(ring(cx,cy,0.06,14,true), W_RING))
  ;[-0.34,0,0.34].forEach(dx => p.push(...tw(ring(dx,-0.86,0.05,10,true), W_RING)))
  return p
}
function stageDoc(): P4[] {
  const p: P4[] = []
  p.push(...tw(roundRect(-1.2,1.2,-1.18,1.18,0.12,0.085), W_FRAME))
  p.push(...tw(line(-1.0,-0.2,1.0,0,0.04), W_BOLD))
  p.push(...photo(-1.02,0.05,0.28,0.86))
  ;[0.74,0.58,0.42,0.26].forEach(y => p.push(...tw(line(0.2,0.2+0.3+Math.random()*0.6,y,0,0.05), W_TEXT)))
  const ys: number[] = []; for (let y=0.08; y>=-1.02; y-=0.145) ys.push(y)
  ys.forEach((y,i) => {
    const w = (i%4===3) ? (0.5+Math.random()*0.5) : (1.6+Math.random()*0.55)
    p.push(...tw(line(-1.02,Math.min(1.05,-1.02+w),y,0,0.05), W_TEXT))
  })
  return p
}
function stageTest(): P4[] {
  const p: P4[] = []
  p.push(...tw(roundRect(-1.32,1.32,-1.14,1.14,0.12,0.085), W_FRAME))
  p.push(...photo(-1.08,-0.2,0.44,0.98,0.08))
  ;[0.86,0.68,0.5].forEach((y,i) => p.push(...tw(line(-0.04,[1.08,0.74,0.92][i],y,0,0.05), W_TEXT)))
  const rows=[0.16,-0.16,-0.48,-0.8]
  rows.forEach((y,i) => {
    const sel = i===1
    p.push(...tw(roundRect(-1.12,-0.92,y-0.1,y+0.1,0.04,0.03), sel ? W_BOLD : W_RING))
    if (sel) {
      p.push(...tw(seg(-1.075,y-0.005,-1.03,y-0.05,0.016), W_BOLD))
      p.push(...tw(seg(-1.03,y-0.05,-0.955,y+0.05,0.016), W_BOLD))
    }
    const w = 0.85 + Math.random()*0.85
    p.push(...tw(line(-0.82,-0.82+w,y,0,0.05), W_TEXT))
  })
  p.push(...tw(line(-1.12,1.12,-1.0,0,0.05), W_TEXT))
  p.push(...tw(line(-1.12,0.2,-1.0,0.01,0.03), W_BOLD))
  return p
}

function fitN(arr: P4[], n: number): P4[] {
  const a = arr.slice()
  for (let i=a.length-1; i>0; i--) { const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]] }
  if (a.length > n) return a.slice(0,n)
  while (a.length < n) {
    const s=a[(Math.random()*arr.length)|0]
    a.push([s[0]+(Math.random()-0.5)*0.05, s[1]+(Math.random()-0.5)*0.05, s[2]+(Math.random()-0.5)*0.05, s[3]])
  }
  return a
}

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

const STAGE_COLORS_LIGHT = ['#7c3aed', '#a855f7', '#0e0e12', '#ED0606']
const STAGE_COLORS_DARK  = ['#7c3aed', '#a855f7', '#c8cae0', '#ED0606']

const STAGE_ICONS = [
  // Upload — облако + стрелка вверх
  <svg key="u" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16.5A4 4 0 0 1 4 9a5 5 0 0 1 9.9-1A4.5 4.5 0 0 1 20 12.5"/>
    <path d="M12 12v7"/><path d="M9 15l3-3 3 3"/>
  </svg>,
  // Scan — кольцо с указателем
  <svg key="s" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
  </svg>,
  // Doc — страница с текстом
  <svg key="d" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
  </svg>,
  // Test — чекбоксы
  <svg key="t" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="4" height="4" rx="1"/><path d="M5 7l1.5 1.5L9 6"/>
    <line x1="11" y1="7" x2="21" y2="7"/><rect x="3" y="13" width="4" height="4" rx="1"/>
    <line x1="11" y1="15" x2="21" y2="15"/>
  </svg>,
]
export default function PdfParticleAnim() {
  const t = useTranslations('LandingPage')
  const { isDark } = useThemeCtx()
  const isDarkRef = useRef(isDark)
  const wrapRef       = useRef<HTMLDivElement>(null)
  const stageBarRef   = useRef<HTMLDivElement>(null)
  const pinnedRef       = useRef<number>(-1)   // -1 = auto-cycle
  const pinnedAtRef     = useRef<number>(0)
  const burstClickTime  = useRef<number>(-9999)
  const [activeStage, setActiveStage] = useState(0)
  const PIN_MS = 5000

  useEffect(() => { isDarkRef.current = isDark }, [isDark])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const W = wrap.clientWidth || 560
    const H = 420
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const FOV = 45

    const scene    = new THREE.Scene()
    const camera   = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100)
    camera.position.z = 4.8

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(DPR)
    renderer.setSize(W, H)
    wrap.appendChild(renderer.domElement)

    const scaleFor = (h: number) => (h * DPR) / (2 * Math.tan((FOV * Math.PI / 180) / 2))

    const raw = [stageUpload(), stageScan(), stageDoc(), stageTest()].map(s => fitN(s, N))
    const stagePos  = raw.map(s => { const f=new Float32Array(s.length*3); s.forEach((p,i)=>{f[i*3]=p[0];f[i*3+1]=p[1];f[i*3+2]=p[2]}); return f })
    const stageSize = raw.map(s => { const f=new Float32Array(s.length);   s.forEach((p,i)=>{f[i]=p[3]||W_TEXT}); return f })

    const pos      = new Float32Array(stagePos[0])
    const size     = new Float32Array(stageSize[0])
    const seeds    = new Float32Array(N)
    const delays   = new Float32Array(N)
    const dir      = new Float32Array(N*2)
    const repelOff = new Float32Array(N*3)  // current cursor-repulsion offset per particle
    for (let i=0; i<N; i++) {
      seeds[i]  = Math.random()
      delays[i] = Math.random()*0.28
      const a = Math.random()*Math.PI*2
      dir[i*2]=Math.cos(a); dir[i*2+1]=Math.sin(a)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize',    new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(isDarkRef.current ? STAGE_COLORS_DARK[0] : STAGE_COLORS_LIGHT[0]) },
        uScale: { value: scaleFor(H) },
        uTime:  { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false,
    })

    const group = new THREE.Group()
    group.add(new THREE.Points(geo, mat))
    scene.add(group)

    const HOLD=1800, TRANS=1900, STEP=HOLD+TRANS
    const smooth = (x: number) => x<=0?0:x>=1?1:x*x*x*(x*(x*6-15)+10)
    const clamp01 = (x: number) => x<0?0:x>1?1:x

    let raf = 0
    const start = performance.now()
    let mx=0, my=0, tmx=0, tmy=0
    let lastStage = -1
    let isHovering = false
    let lastSetStage = -1
    burstClickTime.current = -9999
    // precompute for mouse→world conversion at z=0 plane
    const tanHalfFov = Math.tan((FOV * Math.PI / 180) / 2)

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect()
      tmx = (e.clientX-r.left)/r.width  - 0.5
      tmy = (e.clientY-r.top) /r.height - 0.5
      isHovering = true
    }
    const onLeave = () => { tmx=0; tmy=0; isHovering=false }
    const onClick  = () => { burstClickTime.current = performance.now() }
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)
    wrap.addEventListener('click', onClick)

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const elapsed = performance.now()-start
      mat.uniforms.uTime.value = elapsed*0.001

      // check if user pinned a stage; auto-unpin after PIN_MS
      const now = performance.now()
      const pinned = pinnedRef.current
      const isPinned = pinned >= 0 && (now - pinnedAtRef.current) < PIN_MS
      if (!isPinned && pinnedRef.current >= 0) pinnedRef.current = -1

      const phase = isPinned ? pinned : Math.floor(elapsed/STEP)%4
      const tl    = elapsed%STEP
      const transitioning = !isPinned && tl>HOLD
      const p     = transitioning ? (tl-HOLD)/TRANS : 0
      const nxt   = (phase+1)%4
      const fromP = stagePos[phase], toP = stagePos[nxt]
      const fromS = stageSize[phase], toS = stageSize[nxt]

      // click burst: sharp spike then decay
      const sinceClick = (performance.now() - burstClickTime.current) / 1000
      const burstAmt = sinceClick < 0.8 ? Math.sin(Math.PI * sinceClick / 0.8) * 0.9 : 0

      // cursor → world position at z=0 plane (same as particle depth)
      const cz = camera.position.z
      const aspect = (wrap.clientWidth || W) / H
      const mwx = isHovering ?  tmx * 2 * aspect * cz * tanHalfFov : 1e9
      const mwy = isHovering ? -tmy * 2 *         cz * tanHalfFov : 1e9

      const REPEL_R  = 0.7   // world-space radius of repulsion circle
      const MAX_PUSH = 0.4   // max displacement at center

      for (let i=0; i<N; i++) {
        const ix=i*3
        const d=delays[i]
        const e=smooth(clamp01((p-d)/(1-0.28)))

        let x=fromP[ix]  +(toP[ix]  -fromP[ix])  *e
        let y=fromP[ix+1]+(toP[ix+1]-fromP[ix+1])*e
        let z=fromP[ix+2]+(toP[ix+2]-fromP[ix+2])*e

        if (transitioning) {
          const curl=Math.sin(Math.PI*e)*0.16
          x+=-dir[i*2+1]*curl; y+=dir[i*2]*curl
          z+=Math.sin(Math.PI*e+seeds[i]*6.28)*0.12
        }

        // cursor repulsion: compute target offset then lerp (like 404 page)
        const dx = x - mwx, dy = y - mwy
        const dist = Math.sqrt(dx*dx + dy*dy)
        let rtx=0, rty=0, rtz=0
        if (isHovering && dist < REPEL_R && dist > 0.001) {
          const force = 1 - dist / REPEL_R
          rtx = (dx / dist) * force * MAX_PUSH
          rty = (dy / dist) * force * MAX_PUSH
          rtz = force * MAX_PUSH * 0.25
        }
        const lerpIn  = 0.18
        const lerpOut = 0.06
        const lsp = (isHovering && dist < REPEL_R) ? lerpIn : lerpOut
        repelOff[ix]   += (rtx - repelOff[ix])   * lsp
        repelOff[ix+1] += (rty - repelOff[ix+1]) * lsp
        repelOff[ix+2] += (rtz - repelOff[ix+2]) * lsp

        // click burst: strong radial explosion
        if (burstAmt > 0.01) {
          x += dir[i*2]   * burstAmt * (0.4 + seeds[i]*0.6)
          y += dir[i*2+1] * burstAmt * (0.4 + seeds[i]*0.6)
          z += Math.sin(seeds[i]*6.28) * burstAmt * 0.5
        }

        pos[ix]   = x + repelOff[ix]
        pos[ix+1] = y + repelOff[ix+1]
        pos[ix+2] = z + repelOff[ix+2]
        size[i]=fromS[i]+(toS[i]-fromS[i])*e
      }
      geo.attributes.position.needsUpdate=true
      geo.attributes.aSize.needsUpdate=true

      const active = transitioning && p>0.5 ? nxt : phase
      if (active!==lastStage) {
        lastStage=active
        const colors = isDarkRef.current ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT
        mat.uniforms.uColor.value.set(colors[active])
      }
      if (active !== lastSetStage) {
        lastSetStage = active
        setActiveStage(active)
      }

      const t = elapsed*0.001
      group.rotation.y = Math.sin(t*0.32)*0.1+mx*0.38
      group.rotation.x = Math.cos(t*0.27)*0.055-my*0.26
      mx+=(tmx-mx)*0.05; my+=(tmy-my)*0.05

      renderer.render(scene, camera)
    }
    loop()

    const ro = new ResizeObserver(() => {
      const nw=wrap.clientWidth, nh=wrap.clientHeight
      if (!nw||!nh) return
      camera.aspect=nw/nh; camera.updateProjectionMatrix()
      renderer.setSize(nw,nh); mat.uniforms.uScale.value=scaleFor(nh)
    })
    ro.observe(wrap)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      wrap.removeEventListener('click', onClick)
      geo.dispose(); mat.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode===wrap) wrap.removeChild(renderer.domElement)
    }
  }, [])

  const STAGE_NAMES = [t('pdf_stage1'), t('pdf_stage2'), t('pdf_stage3'), t('pdf_stage4')]

  const handleStageClick = (i: number) => {
    pinnedRef.current = i
    pinnedAtRef.current = performance.now()
    burstClickTime.current = performance.now()
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 420, cursor: 'crosshair' }}>
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }} />

      <div ref={stageBarRef} style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'stretch', gap: 2,
        fontFamily: 'JetBrains Mono, monospace',
        pointerEvents: 'all', zIndex: 2,
      }}>
        {STAGE_NAMES.map((name, i) => {
          const stageColors = isDark ? STAGE_COLORS_DARK : STAGE_COLORS_LIGHT
          const inactiveColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,18,0.28)'
          const arrowColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(14,14,18,0.18)'
          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{
                  color: arrowColor, fontSize: 10,
                  margin: '0 3px', alignSelf: 'center',
                }}>→</span>
              )}
              <div
                data-stage={i}
                onClick={e => { e.stopPropagation(); handleStageClick(i) }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '5px 9px', borderRadius: 9,
                  border: `1px solid ${i === activeStage ? `${stageColors[i]}55` : 'transparent'}`,
                  color: i === activeStage ? stageColors[i] : inactiveColor,
                  background: i === activeStage ? `${stageColors[i]}18` : 'transparent',
                  fontWeight: i === activeStage ? 700 : 400,
                  transition: 'all 0.35s',
                  minWidth: 52, cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', lineHeight: 1 }}>
                  {STAGE_ICONS[i]}
                </span>
                <span style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>
                  {name}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
