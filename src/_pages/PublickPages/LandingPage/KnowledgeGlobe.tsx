'use client'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import * as THREE from 'three'

export default function KnowledgeGlobe() {
  const t = useTranslations('LandingPage')
  const containerRef  = useRef<HTMLDivElement>(null)
  const tooltipRef    = useRef<HTMLDivElement>(null)
  const hintRef       = useRef<HTMLDivElement>(null)
  const labelsRef     = useRef<string[]>([])
  const miniLabelsRef = useRef<string[]>([])

  // Populate translated labels in render phase so they're ready when useEffect reads them
  labelsRef.current = [
    t('globe_l1'), t('globe_l2'), t('globe_l3'), t('globe_l4'),
    t('globe_l5'), t('globe_l6'), t('globe_l7'), t('globe_l8'),
    t('globe_l9'), t('globe_l10'), t('globe_l11'), t('globe_l12'),
  ]
  miniLabelsRef.current = [
    t('globe_m1'), t('globe_m2'), t('globe_m3'), t('globe_m4'),
    t('globe_m5'), t('globe_m6'), t('globe_m7'), t('globe_m8'),
    t('globe_m9'), t('globe_m10'), t('globe_m11'), t('globe_m12'),
    t('globe_m13'), t('globe_m14'), t('globe_m15'), t('globe_m16'),
    t('globe_m17'), t('globe_m18'), t('globe_m19'), t('globe_m20'),
    t('globe_m21'), t('globe_m22'), t('globe_m23'), t('globe_m24'),
    t('globe_m25'), t('globe_m26'), t('globe_m27'), t('globe_m28'),
    t('globe_m29'), t('globe_m30'), t('globe_m31'), t('globe_m32'),
  ]

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let w = container.clientWidth
    let h = container.clientHeight
    if (w === 0 || h === 0) return

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100)
    camera.position.z = 9.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const N = 44, r = 2.7
    const nodePositions: THREE.Vector3[] = []
    for (let i = 0; i < N; i++) {
      const p = Math.acos(-1 + (2 * i) / N)
      const t = Math.sqrt(N * Math.PI) * p
      nodePositions.push(new THREE.Vector3(
        r * Math.cos(t) * Math.sin(p),
        r * Math.sin(t) * Math.sin(p),
        r * Math.cos(p),
      ))
    }

    const labels     = labelsRef.current
    const miniLabels = miniLabelsRef.current
    const stride   = Math.floor(N / labels.length)
    const labelMap = new Map<number, string>()
    labels.forEach((lbl, k) => labelMap.set(k * stride + 1, lbl))

    // Assign mini-labels to ALL non-big-labeled nodes
    const miniLabelMap = new Map<number, string>()
    let miniIdx = 0
    for (let i = 0; i < N; i++) {
      if (!labelMap.has(i) && miniIdx < miniLabels.length) {
        miniLabelMap.set(i, miniLabels[miniIdx++])
      }
    }

    const group = new THREE.Group()

    const accentMat = new THREE.MeshBasicMaterial({ color: 0x9333ea })
    const inkMat    = new THREE.MeshBasicMaterial({ color: 0x7c3aed })
    const grayMat   = new THREE.MeshBasicMaterial({ color: 0xc4b5fd })
    const geoSmall  = new THREE.IcosahedronGeometry(0.07, 0)
    const geoMed    = new THREE.IcosahedronGeometry(0.10, 1)
    const geoBig    = new THREE.IcosahedronGeometry(0.16, 1)

    const spheres: THREE.Mesh[] = []
    nodePositions.forEach((p, i) => {
      const isLabeled  = labelMap.has(i)
      const isMini     = !isLabeled && miniLabelMap.has(i)
      const isInk      = !isLabeled && i % 3 === 0
      const mat = isLabeled ? accentMat : (isInk ? inkMat : grayMat)
      const geo = isLabeled ? geoBig   : (isInk ? geoMed  : geoSmall)
      const m   = new THREE.Mesh(geo, mat)
      m.position.copy(p)
      m.userData = {
        phase: Math.random() * Math.PI * 2,
        label: labelMap.get(i) ?? miniLabelMap.get(i) ?? null,
        isLabeled,
        isMini,
      }
      group.add(m)
      spheres.push(m)
    })

    // Рёбра — 3 ближайших соседа
    const edgeSet = new Set<string>()
    nodePositions.forEach((p, i) => {
      nodePositions
        .map((q, j) => ({ j, d: p.distanceTo(q) }))
        .filter(x => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .forEach(({ j }) => edgeSet.add(i < j ? `${i}-${j}` : `${j}-${i}`))
    })
    const edges = [...edgeSet].map(k => k.split('-').map(Number))
    const linePos = new Float32Array(edges.length * 6)
    edges.forEach(([a, b], k) => {
      linePos[k*6]   = nodePositions[a].x; linePos[k*6+1] = nodePositions[a].y; linePos[k*6+2] = nodePositions[a].z
      linePos[k*6+3] = nodePositions[b].x; linePos[k*6+4] = nodePositions[b].y; linePos[k*6+5] = nodePositions[b].z
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
    const lineMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.42 })
    group.add(new THREE.LineSegments(lineGeo, lineMat))

    // Кольцо орбиты
    const ringGeo = new THREE.RingGeometry(3.05, 3.08, 96)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    const ring    = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI * 0.42
    group.add(ring)

    scene.add(group)

    // Интерактивность — hover на всех нодах
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 0.1 }
    const mouseVec  = new THREE.Vector2()
    const state = { dragging: false, lastX: 0, lastY: 0, hovered: null as THREE.Mesh | null, hintHidden: false }

    const showTooltip = () => {
      const tt = tooltipRef.current
      if (!state.hovered || !tt) return
      const v = state.hovered.position.clone().applyMatrix4(group.matrixWorld)
      v.project(camera)
      if (v.z > 1) { tt.style.display = 'none'; return }
      const x = (v.x * 0.5 + 0.5) * container.clientWidth
      const y = (-v.y * 0.5 + 0.5) * container.clientHeight
      tt.textContent    = state.hovered.userData.label
      tt.style.left     = x + 'px'
      tt.style.top      = y + 'px'
      tt.style.display  = 'block'
      tt.style.transform = x > container.clientWidth * 0.6 ? 'translate(-100%, -50%)' : 'translate(8px, -50%)'
    }
    const hideTooltip = () => { if (tooltipRef.current) tooltipRef.current.style.display = 'none' }
    const hideHint    = () => {
      if (!state.hintHidden && hintRef.current) { hintRef.current.style.opacity = '0'; state.hintHidden = true }
    }

    const onDown = (e: PointerEvent) => {
      e.stopPropagation(); state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY
      container.style.cursor = 'grabbing'; state.hovered = null; hideTooltip(); hideHint()
      container.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (state.dragging) {
        e.stopPropagation()
        group.rotation.y += (e.clientX - state.lastX) * 0.008
        group.rotation.x  = Math.max(-1.4, Math.min(1.4, group.rotation.x + (e.clientY - state.lastY) * 0.008))
        state.lastX = e.clientX; state.lastY = e.clientY; return
      }
      mouseVec.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1
      mouseVec.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1
      raycaster.setFromCamera(mouseVec, camera)
      const hits = raycaster.intersectObjects(spheres, false)
      if (hits.length > 0) {
        const obj = hits[0].object as THREE.Mesh
        const v   = obj.position.clone().applyMatrix4(group.matrixWorld); v.project(camera)
        if (v.z < 1) {
          state.hovered = obj
          container.style.cursor = 'pointer'
          if (obj.userData.label) {
            const el = tooltipRef.current
            if (el) {
              el.style.fontSize = obj.userData.isMini ? '10px' : '12px'
              el.style.opacity  = obj.userData.isMini ? '0.8' : '1'
            }
            showTooltip()
          } else hideTooltip()
          hideHint()
          return
        }
      }
      state.hovered = null; container.style.cursor = 'grab'; hideTooltip()
    }
    const onUp = (e: PointerEvent) => {
      if (state.dragging) {
        state.dragging = false; container.style.cursor = state.hovered ? 'pointer' : 'grab'
        try { container.releasePointerCapture(e.pointerId) } catch {}
      }
    }
    const onLeave = () => { state.dragging = false; state.hovered = null; container.style.cursor = 'grab'; hideTooltip() }

    container.addEventListener('pointerdown',   onDown)
    container.addEventListener('pointermove',   onMove)
    container.addEventListener('pointerup',     onUp)
    container.addEventListener('pointerleave',  onLeave)
    container.addEventListener('pointercancel', onLeave)
    container.style.cursor      = 'grab'
    container.style.touchAction = 'none'

    let raf = 0, tt = 0, last = performance.now()
    const animate = () => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1)
      last = now; tt += dt
      if (!state.dragging && !state.hovered) {
        group.rotation.y += 0.35 * dt
        const tx = Math.sin(tt * 0.32) * 0.18
        group.rotation.x += (tx - group.rotation.x) * 0.5 * dt
      }
      spheres.forEach(c => {
        const base   = state.hovered === c ? 1.7 : 1
        const target = base + Math.sin(tt * 2 + c.userData.phase) * 0.06
        c.scale.setScalar(c.scale.x + (target - c.scale.x) * 0.25)
      })
      if (state.hovered) showTooltip()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      w = container.clientWidth; h = container.clientHeight
      if (!w || !h) return
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      container.removeEventListener('pointerdown',   onDown)
      container.removeEventListener('pointermove',   onMove)
      container.removeEventListener('pointerup',     onUp)
      container.removeEventListener('pointerleave',  onLeave)
      container.removeEventListener('pointercancel', onLeave)
      geoSmall.dispose(); geoMed.dispose(); geoBig.dispose()
      lineGeo.dispose(); ringGeo.dispose()
      ;[accentMat, inkMat, grayMat, lineMat, ringMat].forEach(m => m.dispose())
      renderer.dispose()
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 540 }}>
      {/* фиолетовое свечение */}
      <div style={{
        position: 'absolute', inset: '8% 4%', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 45%, rgba(168,85,247,0.26), rgba(124,58,237,0.09) 45%, transparent 70%)',
        filter: 'blur(6px)',
      }} />

      {/* Three.js canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* live-dot */}
      <div style={{
        position: 'absolute', top: 16, left: 10, pointerEvents: 'none', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: '#a78bfa',
        letterSpacing: '0.06em',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          animation: 'rd_pulse 1.6s infinite', flexShrink: 0,
        }} />
        live
      </div>

      {/* tooltip */}
      <div ref={tooltipRef} style={{
        position: 'absolute', display: 'none', pointerEvents: 'none', zIndex: 10,
        background: 'rgba(14,14,18,0.82)', backdropFilter: 'blur(6px)',
        color: '#fff', fontSize: 12, fontWeight: 500, letterSpacing: '0.01em',
        padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
      }} />

      {/* drag hint */}
      <div ref={hintRef} style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 2,
        fontSize: 11, color: '#a78bfa', opacity: 1, transition: 'opacity 0.5s',
        pointerEvents: 'none',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" />
        </svg>
        {t('globe_hint')}
      </div>
    </div>
  )
}
