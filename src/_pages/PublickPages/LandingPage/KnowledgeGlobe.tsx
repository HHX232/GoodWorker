'use client'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import * as THREE from 'three'

export default function KnowledgeGlobe() {
  const t       = useTranslations('LandingPage')

  const containerRef  = useRef<HTMLDivElement>(null)
  const tooltipRef    = useRef<HTMLDivElement>(null)
  const hintRef       = useRef<HTMLDivElement>(null)
  // One 16-topic curriculum sequence per subject/continent, in programme order.
  const subjectLabelsRef = useRef<string[][]>([[], [], [], [], [], [], [], []])

  // Assigned inside an effect, not during render — mutating a ref's .current
  // directly in the render body is a React anti-pattern (can run twice under
  // StrictMode/concurrent rendering, or read a stale value if render is
  // interrupted). Runs before the Three.js setup effect below (React fires
  // effects in declaration order on mount), so bandLabels there always sees
  // the labels already populated.
  useEffect(() => {
    subjectLabelsRef.current = [
    [ // Математика
      t('globe_math_1'), t('globe_math_2'), t('globe_math_3'), t('globe_math_4'),
      t('globe_math_5'), t('globe_math_6'), t('globe_math_7'), t('globe_math_8'),
      t('globe_math_9'), t('globe_math_10'), t('globe_math_11'), t('globe_math_12'),
      t('globe_math_13'), t('globe_math_14'), t('globe_math_15'), t('globe_math_16'),
    ],
    [ // Русский язык
      t('globe_rus_1'), t('globe_rus_2'), t('globe_rus_3'), t('globe_rus_4'),
      t('globe_rus_5'), t('globe_rus_6'), t('globe_rus_7'), t('globe_rus_8'),
      t('globe_rus_9'), t('globe_rus_10'), t('globe_rus_11'), t('globe_rus_12'),
      t('globe_rus_13'), t('globe_rus_14'), t('globe_rus_15'), t('globe_rus_16'),
    ],
    [ // Физика
      t('globe_phys_1'), t('globe_phys_2'), t('globe_phys_3'), t('globe_phys_4'),
      t('globe_phys_5'), t('globe_phys_6'), t('globe_phys_7'), t('globe_phys_8'),
      t('globe_phys_9'), t('globe_phys_10'), t('globe_phys_11'), t('globe_phys_12'),
      t('globe_phys_13'), t('globe_phys_14'), t('globe_phys_15'), t('globe_phys_16'),
    ],
    [ // История
      t('globe_hist_1'), t('globe_hist_2'), t('globe_hist_3'), t('globe_hist_4'),
      t('globe_hist_5'), t('globe_hist_6'), t('globe_hist_7'), t('globe_hist_8'),
      t('globe_hist_9'), t('globe_hist_10'), t('globe_hist_11'), t('globe_hist_12'),
      t('globe_hist_13'), t('globe_hist_14'), t('globe_hist_15'), t('globe_hist_16'),
    ],
    [ // Биология
      t('globe_bio_1'), t('globe_bio_2'), t('globe_bio_3'), t('globe_bio_4'),
      t('globe_bio_5'), t('globe_bio_6'), t('globe_bio_7'), t('globe_bio_8'),
      t('globe_bio_9'), t('globe_bio_10'), t('globe_bio_11'), t('globe_bio_12'),
      t('globe_bio_13'), t('globe_bio_14'), t('globe_bio_15'), t('globe_bio_16'),
    ],
    [ // Химия
      t('globe_chem_1'), t('globe_chem_2'), t('globe_chem_3'), t('globe_chem_4'),
      t('globe_chem_5'), t('globe_chem_6'), t('globe_chem_7'), t('globe_chem_8'),
      t('globe_chem_9'), t('globe_chem_10'), t('globe_chem_11'), t('globe_chem_12'),
      t('globe_chem_13'), t('globe_chem_14'), t('globe_chem_15'), t('globe_chem_16'),
    ],
    [ // Английский язык
      t('globe_eng_1'), t('globe_eng_2'), t('globe_eng_3'), t('globe_eng_4'),
      t('globe_eng_5'), t('globe_eng_6'), t('globe_eng_7'), t('globe_eng_8'),
      t('globe_eng_9'), t('globe_eng_10'), t('globe_eng_11'), t('globe_eng_12'),
      t('globe_eng_13'), t('globe_eng_14'), t('globe_eng_15'), t('globe_eng_16'),
    ],
    [ // Обществознание
      t('globe_soc_1'), t('globe_soc_2'), t('globe_soc_3'), t('globe_soc_4'),
      t('globe_soc_5'), t('globe_soc_6'), t('globe_soc_7'), t('globe_soc_8'),
      t('globe_soc_9'), t('globe_soc_10'), t('globe_soc_11'), t('globe_soc_12'),
      t('globe_soc_13'), t('globe_soc_14'), t('globe_soc_15'), t('globe_soc_16'),
    ],
    ]
  }, [t])

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

    const r = 2.7
    const BAND_SIZE = 16 // topics per subject

    // 8 subjects = 8 "continents" — compact, well-separated clusters so one
    // subject's dots never sit geometrically next to another subject's.
    // Centres are a cube's vertices — mutually ≥70.5° apart, the simplest
    // clean 8-point spread on a sphere. Each continent's own 14 dots are
    // laid out in curriculum order along a small spiral within its cap
    // (pushed out from the centre by CAP_R_MIN so even the earliest-in-
    // sequence dots keep real breathing room from each other), and every
    // edge (below) stays inside its own continent — subjects never connect.
    const CONTINENT_CENTERS = ([1, -1] as const).flatMap(x => ([1, -1] as const).flatMap(y => ([1, -1] as const).map(z =>
      new THREE.Vector3(x, y, z).normalize(),
    )))
    const NUM_SUBJECTS = CONTINENT_CENTERS.length
    const CAP_R_MIN = 0.24, CAP_R_MAX = 0.5 // geodesic radius (rad) of a continent's cap
    const CAP_TURN  = 1.14                  // spiral turn (rad) per point

    const nodePositions: THREE.Vector3[] = []
    CONTINENT_CENTERS.forEach(center => {
      const seed = Math.abs(center.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      const u = new THREE.Vector3().crossVectors(center, seed).normalize()
      const v = new THREE.Vector3().crossVectors(center, u)

      for (let pos = 0; pos < BAND_SIZE; pos++) {
        const geoR   = CAP_R_MIN + (CAP_R_MAX - CAP_R_MIN) * (pos / (BAND_SIZE - 1))
        const theta  = pos * CAP_TURN
        const dir    = u.clone().multiplyScalar(Math.cos(theta)).addScaledVector(v, Math.sin(theta))
        const onUnit = center.clone().multiplyScalar(Math.cos(geoR)).addScaledVector(dir, Math.sin(geoR))
        nodePositions.push(onUnit.multiplyScalar(r))
      }
    })

    const bandLabels = subjectLabelsRef.current // [8][16]

    // Position within the 16-slot band (1-indexed) that lands on each
    // subject's 3 headline ("big") topics — the rest are regular topics.
    const BAND_BIG_POS = [
      [3, 10, 15], // математика
      [7, 10, 13], // русский
      [4, 9, 14],  // физика
      [4, 10, 16], // история
      [8, 10, 16], // биология
      [2, 5, 12],  // химия
      [4, 9, 16],  // английский
      [6, 9, 16],  // обществознание
    ]

    // Extra prerequisite/relation edges within a subject, on top of the
    // plain programme-order chain below — branches and convergences between
    // topics of the SAME subject only (1-indexed positions), so a topic can
    // connect to more than just its immediate neighbour in the sequence.
    const BAND_EXTRA_EDGES: [number, number][][] = [
      [[2, 5], [6, 8], [3, 10], [8, 15], [9, 11], [12, 15], [11, 13]], // математика
      [[1, 4], [3, 14], [8, 10], [9, 11], [10, 13], [11, 13], [14, 16]], // русский
      [[1, 3], [5, 7], [8, 10], [9, 11], [11, 13], [4, 14], [13, 16]], // физика
      [[1, 3], [2, 6], [3, 8], [9, 11], [12, 14], [13, 15], [7, 9]], // история
      [[1, 6], [1, 5], [7, 10], [9, 11], [13, 15], [14, 16], [2, 13]], // биология
      [[1, 3], [2, 5], [4, 7], [5, 10], [8, 10], [12, 15], [13, 16]], // химия
      [[2, 4], [3, 10], [6, 9], [4, 11], [9, 12], [5, 14], [7, 10]], // английский
      [[1, 3], [4, 10], [6, 8], [10, 12], [11, 13], [9, 15], [14, 16]], // обществознание
    ]

    const nodeLabel  = new Map<number, string>()
    const bigIndices = new Set<number>()
    for (let band = 0; band < NUM_SUBJECTS; band++) {
      const bigPos = new Set(BAND_BIG_POS[band])
      for (let pos = 1; pos <= BAND_SIZE; pos++) {
        const i = band * BAND_SIZE + (pos - 1)
        nodeLabel.set(i, bandLabels[band][pos - 1])
        if (bigPos.has(pos)) bigIndices.add(i)
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
      const isBig  = bigIndices.has(i)
      const isMini = !isBig && nodeLabel.has(i)
      const isInk  = !isBig && i % 3 === 0
      const mat = isBig ? accentMat : (isInk ? inkMat : grayMat)
      const geo = isBig ? geoBig   : (isInk ? geoMed  : geoSmall)
      const m   = new THREE.Mesh(geo, mat)
      m.position.copy(p)

      m.userData = {
        phase: Math.random() * Math.PI * 2,
        label: nodeLabel.get(i) ?? null,
        isBig,
        isMini,
      }
      group.add(m)
      spheres.push(m)
    })

    // Рёбра — программная цепочка внутри своего материка плюс несколько
    // содержательных ветвлений/схождений (курс не строго линеен — темы
    // пересекаются и опираются друг на друга не только по соседству).
    // Между материками рёбер нет вообще — индексы всегда внутри одного band.
    const edges: number[][] = []
    for (let band = 0; band < NUM_SUBJECTS; band++) {
      const base = band * BAND_SIZE
      for (let pos = 0; pos < BAND_SIZE - 1; pos++) {
        edges.push([base + pos, base + pos + 1])
      }
      BAND_EXTRA_EDGES[band].forEach(([a, b]) => {
        edges.push([base + (a - 1), base + (b - 1)])
      })
    }
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

    // Интерактивность
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 0.1 }
    const mouseVec  = new THREE.Vector2()
    const state = {
      dragging: false,
      startX: 0, startY: 0,
      lastX: 0,  lastY: 0,
      hovered: null as THREE.Mesh | null,
      clickTarget: null as THREE.Mesh | null,  // saved at pointerdown
      hintHidden: false
    }

    const showTooltip = () => {
      const tt = tooltipRef.current
      if (!state.hovered || !tt) return
      const v = state.hovered.position.clone().applyMatrix4(group.matrixWorld)
      v.project(camera)
      if (v.z > 1) { tt.style.display = 'none'; return }
      const x = (v.x * 0.5 + 0.5) * container.clientWidth
      const y = (-v.y * 0.5 + 0.5) * container.clientHeight

      const label = state.hovered.userData.label as string | null

      tt.textContent    = label ?? ''
      tt.style.left     = x + 'px'
      tt.style.top      = y + 'px'
      tt.style.display  = 'block'
      tt.style.color    = '#fff'
      tt.style.transform = x > container.clientWidth * 0.6 ? 'translate(-100%, -50%)' : 'translate(8px, -50%)'
    }
    const hideTooltip = () => { if (tooltipRef.current) tooltipRef.current.style.display = 'none' }
    const hideHint    = () => {
      if (!state.hintHidden && hintRef.current) { hintRef.current.style.opacity = '0'; state.hintHidden = true }
    }

    const onDown = (e: PointerEvent) => {
      e.stopPropagation()
      state.clickTarget = state.hovered   // save before clearing
      state.dragging = true
      state.startX = e.clientX; state.startY = e.clientY
      state.lastX  = e.clientX; state.lastY  = e.clientY
      container.style.cursor = 'grabbing'
      state.hovered = null; hideTooltip(); hideHint()
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
          container.style.cursor = obj.userData.label ? 'default' : 'grab'
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
        state.dragging = false
        state.clickTarget = null
        container.style.cursor = 'grab'
        try { container.releasePointerCapture(e.pointerId) } catch {}
      }
    }
    const onLeave = () => {
      state.dragging = false; state.hovered = null
      container.style.cursor = 'grab'; hideTooltip()
    }

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
      {/* свечение */}
      <div style={{
        position: 'absolute', inset: '8% 4%', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 45%, rgba(168,85,247,0.26), rgba(124,58,237,0.09) 45%, transparent 70%)',
        filter: 'blur(6px)',
      }} />

      {/* Three.js canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* tooltip */}
      <div ref={tooltipRef} style={{
        position: 'absolute', display: 'none', pointerEvents: 'none', zIndex: 10,
        background: 'rgba(14,14,18,0.85)', backdropFilter: 'blur(6px)',
        color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
        padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
        transition: 'color 0.15s',
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
