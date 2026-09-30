'use client'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import * as THREE from 'three'

const SUBJECT_COUNT = 8
const BAND_SIZE     = 44   // topics per subject — matches the original globe's 44-point density
const ROTATE_MS     = 60_000

// Position within the 44-item curriculum sequence (1-indexed) that is each
// subject's headline ("big") topics — the rest are regular topics.
const BAND_BIG_POS = [
  [3, 10, 19, 23, 31, 33, 41, 43], // математика
  [6, 16, 23, 27, 33, 37, 41, 44], // русский
  [2, 6, 13, 18, 27, 33, 40, 44],  // физика
  [4, 9, 14, 22, 27, 34, 38, 44],  // история
  [3, 6, 16, 19, 23, 32, 37, 42],  // биология
  [2, 5, 7, 18, 23, 25, 34, 43],   // химия
  [4, 11, 15, 21, 22, 28, 37, 44], // английский
  [3, 10, 19, 25, 30, 35, 39, 44], // обществознание
]

// Extra prerequisite/relation edges within a subject, on top of the plain
// programme-order chain (below) — branches and convergences between topics
// of the SAME subject, so a topic can connect to more than just its
// immediate neighbour in the sequence. 1-indexed positions.
const BAND_EXTRA_EDGES: [number, number][][] = [
  [[3, 18], [9, 14], [12, 19], [15, 17], [10, 20], [23, 29], [24, 26], [27, 31], [28, 30], [33, 35], [36, 38], [37, 39], [11, 22], [17, 21], [42, 44]], // математика
  [[2, 17], [6, 16], [7, 20], [10, 19], [11, 29], [12, 30], [5, 18], [25, 27], [33, 35], [30, 39], [34, 40], [36, 38], [41, 43], [42, 44]], // русский
  [[2, 4], [5, 8], [6, 9], [10, 12], [11, 14], [13, 15], [16, 18], [19, 22], [24, 26], [25, 28], [28, 30], [31, 33], [34, 36], [35, 37], [38, 40], [40, 42]], // физика
  [[2, 4], [4, 6], [7, 9], [9, 11], [12, 14], [15, 17], [18, 20], [19, 21], [22, 24], [25, 27], [28, 30], [31, 33], [33, 35], [34, 36], [36, 38], [38, 40], [40, 43], [42, 44]], // история
  [[2, 4], [3, 5], [8, 16], [9, 13], [10, 14], [16, 18], [18, 20], [19, 21], [20, 22], [23, 25], [25, 27], [27, 29], [30, 32], [33, 35], [36, 39], [37, 40], [38, 42], [40, 44]], // биология
  [[2, 4], [3, 5], [6, 9], [7, 9], [9, 11], [12, 14], [16, 18], [18, 20], [20, 22], [23, 25], [25, 28], [29, 32], [33, 35], [36, 38], [38, 41], [39, 42], [17, 19]], // химия
  [[3, 7], [4, 9], [11, 13], [12, 16], [13, 17], [15, 18], [18, 20], [21, 23], [22, 24], [25, 27], [28, 30], [29, 31], [32, 35], [37, 44], [39, 41], [40, 42]], // английский
  [[2, 4], [3, 6], [5, 7], [8, 10], [11, 13], [14, 16], [17, 19], [19, 21], [20, 23], [25, 27], [26, 28], [28, 30], [31, 33], [35, 37], [38, 40], [39, 41], [9, 44]], // обществознание
]

export default function KnowledgeGlobe() {
  const t = useTranslations('LandingPage')

  const containerRef    = useRef<HTMLDivElement>(null)
  const tooltipRef      = useRef<HTMLDivElement>(null)
  const hintRef         = useRef<HTMLDivElement>(null)
  const subjectNameRef  = useRef<HTMLDivElement>(null)
  // 8 subjects × 44 topics, in programme order — the whole curriculum content
  // (44 = same point density as the original pre-redesign globe).
  const subjectLabelsRef = useRef<string[][]>([[], [], [], [], [], [], [], []])
  const subjectNamesRef  = useRef<string[]>([])

  // Assigned inside an effect, not during render — mutating a ref's .current
  // directly in the render body is a React anti-pattern (can run twice under
  // StrictMode/concurrent rendering, or read a stale value if render is
  // interrupted). Runs before the Three.js setup effect below (React fires
  // effects in declaration order on mount), so applySubject there always
  // sees the labels already populated.
  useEffect(() => {
    subjectLabelsRef.current = [
    [ // Математика
      t('globe_math_1'), t('globe_math_2'), t('globe_math_3'), t('globe_math_4'),
      t('globe_math_5'), t('globe_math_6'), t('globe_math_7'), t('globe_math_8'),
      t('globe_math_9'), t('globe_math_10'), t('globe_math_11'), t('globe_math_12'),
      t('globe_math_13'), t('globe_math_14'), t('globe_math_15'), t('globe_math_16'),
      t('globe_math_17'), t('globe_math_18'), t('globe_math_19'), t('globe_math_20'),
      t('globe_math_21'), t('globe_math_22'), t('globe_math_23'), t('globe_math_24'),
      t('globe_math_25'), t('globe_math_26'), t('globe_math_27'), t('globe_math_28'),
      t('globe_math_29'), t('globe_math_30'), t('globe_math_31'), t('globe_math_32'),
      t('globe_math_33'), t('globe_math_34'), t('globe_math_35'), t('globe_math_36'),
      t('globe_math_37'), t('globe_math_38'), t('globe_math_39'), t('globe_math_40'),
      t('globe_math_41'), t('globe_math_42'), t('globe_math_43'), t('globe_math_44'),
    ],
    [ // Русский язык
      t('globe_rus_1'), t('globe_rus_2'), t('globe_rus_3'), t('globe_rus_4'),
      t('globe_rus_5'), t('globe_rus_6'), t('globe_rus_7'), t('globe_rus_8'),
      t('globe_rus_9'), t('globe_rus_10'), t('globe_rus_11'), t('globe_rus_12'),
      t('globe_rus_13'), t('globe_rus_14'), t('globe_rus_15'), t('globe_rus_16'),
      t('globe_rus_17'), t('globe_rus_18'), t('globe_rus_19'), t('globe_rus_20'),
      t('globe_rus_21'), t('globe_rus_22'), t('globe_rus_23'), t('globe_rus_24'),
      t('globe_rus_25'), t('globe_rus_26'), t('globe_rus_27'), t('globe_rus_28'),
      t('globe_rus_29'), t('globe_rus_30'), t('globe_rus_31'), t('globe_rus_32'),
      t('globe_rus_33'), t('globe_rus_34'), t('globe_rus_35'), t('globe_rus_36'),
      t('globe_rus_37'), t('globe_rus_38'), t('globe_rus_39'), t('globe_rus_40'),
      t('globe_rus_41'), t('globe_rus_42'), t('globe_rus_43'), t('globe_rus_44'),
    ],
    [ // Физика
      t('globe_phys_1'), t('globe_phys_2'), t('globe_phys_3'), t('globe_phys_4'),
      t('globe_phys_5'), t('globe_phys_6'), t('globe_phys_7'), t('globe_phys_8'),
      t('globe_phys_9'), t('globe_phys_10'), t('globe_phys_11'), t('globe_phys_12'),
      t('globe_phys_13'), t('globe_phys_14'), t('globe_phys_15'), t('globe_phys_16'),
      t('globe_phys_17'), t('globe_phys_18'), t('globe_phys_19'), t('globe_phys_20'),
      t('globe_phys_21'), t('globe_phys_22'), t('globe_phys_23'), t('globe_phys_24'),
      t('globe_phys_25'), t('globe_phys_26'), t('globe_phys_27'), t('globe_phys_28'),
      t('globe_phys_29'), t('globe_phys_30'), t('globe_phys_31'), t('globe_phys_32'),
      t('globe_phys_33'), t('globe_phys_34'), t('globe_phys_35'), t('globe_phys_36'),
      t('globe_phys_37'), t('globe_phys_38'), t('globe_phys_39'), t('globe_phys_40'),
      t('globe_phys_41'), t('globe_phys_42'), t('globe_phys_43'), t('globe_phys_44'),
    ],
    [ // История
      t('globe_hist_1'), t('globe_hist_2'), t('globe_hist_3'), t('globe_hist_4'),
      t('globe_hist_5'), t('globe_hist_6'), t('globe_hist_7'), t('globe_hist_8'),
      t('globe_hist_9'), t('globe_hist_10'), t('globe_hist_11'), t('globe_hist_12'),
      t('globe_hist_13'), t('globe_hist_14'), t('globe_hist_15'), t('globe_hist_16'),
      t('globe_hist_17'), t('globe_hist_18'), t('globe_hist_19'), t('globe_hist_20'),
      t('globe_hist_21'), t('globe_hist_22'), t('globe_hist_23'), t('globe_hist_24'),
      t('globe_hist_25'), t('globe_hist_26'), t('globe_hist_27'), t('globe_hist_28'),
      t('globe_hist_29'), t('globe_hist_30'), t('globe_hist_31'), t('globe_hist_32'),
      t('globe_hist_33'), t('globe_hist_34'), t('globe_hist_35'), t('globe_hist_36'),
      t('globe_hist_37'), t('globe_hist_38'), t('globe_hist_39'), t('globe_hist_40'),
      t('globe_hist_41'), t('globe_hist_42'), t('globe_hist_43'), t('globe_hist_44'),
    ],
    [ // Биология
      t('globe_bio_1'), t('globe_bio_2'), t('globe_bio_3'), t('globe_bio_4'),
      t('globe_bio_5'), t('globe_bio_6'), t('globe_bio_7'), t('globe_bio_8'),
      t('globe_bio_9'), t('globe_bio_10'), t('globe_bio_11'), t('globe_bio_12'),
      t('globe_bio_13'), t('globe_bio_14'), t('globe_bio_15'), t('globe_bio_16'),
      t('globe_bio_17'), t('globe_bio_18'), t('globe_bio_19'), t('globe_bio_20'),
      t('globe_bio_21'), t('globe_bio_22'), t('globe_bio_23'), t('globe_bio_24'),
      t('globe_bio_25'), t('globe_bio_26'), t('globe_bio_27'), t('globe_bio_28'),
      t('globe_bio_29'), t('globe_bio_30'), t('globe_bio_31'), t('globe_bio_32'),
      t('globe_bio_33'), t('globe_bio_34'), t('globe_bio_35'), t('globe_bio_36'),
      t('globe_bio_37'), t('globe_bio_38'), t('globe_bio_39'), t('globe_bio_40'),
      t('globe_bio_41'), t('globe_bio_42'), t('globe_bio_43'), t('globe_bio_44'),
    ],
    [ // Химия
      t('globe_chem_1'), t('globe_chem_2'), t('globe_chem_3'), t('globe_chem_4'),
      t('globe_chem_5'), t('globe_chem_6'), t('globe_chem_7'), t('globe_chem_8'),
      t('globe_chem_9'), t('globe_chem_10'), t('globe_chem_11'), t('globe_chem_12'),
      t('globe_chem_13'), t('globe_chem_14'), t('globe_chem_15'), t('globe_chem_16'),
      t('globe_chem_17'), t('globe_chem_18'), t('globe_chem_19'), t('globe_chem_20'),
      t('globe_chem_21'), t('globe_chem_22'), t('globe_chem_23'), t('globe_chem_24'),
      t('globe_chem_25'), t('globe_chem_26'), t('globe_chem_27'), t('globe_chem_28'),
      t('globe_chem_29'), t('globe_chem_30'), t('globe_chem_31'), t('globe_chem_32'),
      t('globe_chem_33'), t('globe_chem_34'), t('globe_chem_35'), t('globe_chem_36'),
      t('globe_chem_37'), t('globe_chem_38'), t('globe_chem_39'), t('globe_chem_40'),
      t('globe_chem_41'), t('globe_chem_42'), t('globe_chem_43'), t('globe_chem_44'),
    ],
    [ // Английский язык
      t('globe_eng_1'), t('globe_eng_2'), t('globe_eng_3'), t('globe_eng_4'),
      t('globe_eng_5'), t('globe_eng_6'), t('globe_eng_7'), t('globe_eng_8'),
      t('globe_eng_9'), t('globe_eng_10'), t('globe_eng_11'), t('globe_eng_12'),
      t('globe_eng_13'), t('globe_eng_14'), t('globe_eng_15'), t('globe_eng_16'),
      t('globe_eng_17'), t('globe_eng_18'), t('globe_eng_19'), t('globe_eng_20'),
      t('globe_eng_21'), t('globe_eng_22'), t('globe_eng_23'), t('globe_eng_24'),
      t('globe_eng_25'), t('globe_eng_26'), t('globe_eng_27'), t('globe_eng_28'),
      t('globe_eng_29'), t('globe_eng_30'), t('globe_eng_31'), t('globe_eng_32'),
      t('globe_eng_33'), t('globe_eng_34'), t('globe_eng_35'), t('globe_eng_36'),
      t('globe_eng_37'), t('globe_eng_38'), t('globe_eng_39'), t('globe_eng_40'),
      t('globe_eng_41'), t('globe_eng_42'), t('globe_eng_43'), t('globe_eng_44'),
    ],
    [ // Обществознание
      t('globe_soc_1'), t('globe_soc_2'), t('globe_soc_3'), t('globe_soc_4'),
      t('globe_soc_5'), t('globe_soc_6'), t('globe_soc_7'), t('globe_soc_8'),
      t('globe_soc_9'), t('globe_soc_10'), t('globe_soc_11'), t('globe_soc_12'),
      t('globe_soc_13'), t('globe_soc_14'), t('globe_soc_15'), t('globe_soc_16'),
      t('globe_soc_17'), t('globe_soc_18'), t('globe_soc_19'), t('globe_soc_20'),
      t('globe_soc_21'), t('globe_soc_22'), t('globe_soc_23'), t('globe_soc_24'),
      t('globe_soc_25'), t('globe_soc_26'), t('globe_soc_27'), t('globe_soc_28'),
      t('globe_soc_29'), t('globe_soc_30'), t('globe_soc_31'), t('globe_soc_32'),
      t('globe_soc_33'), t('globe_soc_34'), t('globe_soc_35'), t('globe_soc_36'),
      t('globe_soc_37'), t('globe_soc_38'), t('globe_soc_39'), t('globe_soc_40'),
      t('globe_soc_41'), t('globe_soc_42'), t('globe_soc_43'), t('globe_soc_44'),
    ],
    ]
    subjectNamesRef.current = [
      t('globe_subj_math'), t('globe_subj_rus'), t('globe_subj_phys'), t('globe_subj_hist'),
      t('globe_subj_bio'), t('globe_subj_chem'), t('globe_subj_eng'), t('globe_subj_soc'),
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

    // Original whole-sphere layout — every point spread evenly pole to
    // pole (Fibonacci sphere), exactly like the very first version. Only
    // one subject is shown at a time, so all dots get the full sphere
    // to themselves instead of sharing it with the other 7 continents.
    const N = BAND_SIZE, r = 2.7
    const nodePositions: THREE.Vector3[] = []
    for (let i = 0; i < N; i++) {
      const p = Math.acos(-1 + (2 * i) / N)
      const th = Math.sqrt(N * Math.PI) * p
      nodePositions.push(new THREE.Vector3(
        r * Math.cos(th) * Math.sin(p),
        r * Math.sin(th) * Math.sin(p),
        r * Math.cos(p),
      ))
    }

    const group = new THREE.Group()

    const accentMat = new THREE.MeshBasicMaterial({ color: 0x9333ea })
    const inkMat    = new THREE.MeshBasicMaterial({ color: 0x7c3aed })
    const grayMat   = new THREE.MeshBasicMaterial({ color: 0xc4b5fd })
    const geoSmall  = new THREE.IcosahedronGeometry(0.09, 0)
    const geoMed    = new THREE.IcosahedronGeometry(0.13, 1)
    const geoBig    = new THREE.IcosahedronGeometry(0.20, 1)

    const spheres: THREE.Mesh[] = nodePositions.map((p) => {
      const m = new THREE.Mesh(geoSmall, grayMat)
      m.position.copy(p)
      m.userData = { phase: Math.random() * Math.PI * 2, label: null, isBig: false, isMini: true }
      group.add(m)
      return m
    })

    // Edges are rebuilt per subject (below) — start with an empty buffer.
    const lineGeo = new THREE.BufferGeometry()
    const lineMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.5 })
    const lines   = new THREE.LineSegments(lineGeo, lineMat)
    group.add(lines)

    // Кольцо орбиты
    const ringGeo = new THREE.RingGeometry(3.05, 3.08, 96)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
    const ring    = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI * 0.42
    group.add(ring)

    scene.add(group)

    // ── Subject rotation ──────────────────────────────────────────────
    // Whichever subject is on screen fills the whole sphere with its own
    // curriculum — labels, big/mini sizing and every edge come from that
    // one subject only, never mixed with another.
    let currentSubject = Math.floor(Math.random() * SUBJECT_COUNT)

    const applySubject = (idx: number) => {
      const labels  = subjectLabelsRef.current[idx]
      const bigPos  = new Set(BAND_BIG_POS[idx])
      spheres.forEach((m, i) => {
        const pos   = i + 1
        const isBig = bigPos.has(pos)
        const isInk = !isBig && i % 3 === 0
        m.geometry  = isBig ? geoBig : (isInk ? geoMed : geoSmall)
        m.material  = isBig ? accentMat : (isInk ? inkMat : grayMat)
        m.userData  = { phase: m.userData.phase, label: labels[i] ?? null, isBig, isMini: !isBig }
      })

      const edges: number[][] = []
      for (let pos = 0; pos < BAND_SIZE - 1; pos++) edges.push([pos, pos + 1])
      BAND_EXTRA_EDGES[idx].forEach(([a, b]) => edges.push([a - 1, b - 1]))

      const linePos = new Float32Array(edges.length * 6)
      edges.forEach(([a, b], k) => {
        linePos[k*6]   = nodePositions[a].x; linePos[k*6+1] = nodePositions[a].y; linePos[k*6+2] = nodePositions[a].z
        linePos[k*6+3] = nodePositions[b].x; linePos[k*6+4] = nodePositions[b].y; linePos[k*6+5] = nodePositions[b].z
      })
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
      lineGeo.attributes.position.needsUpdate = true
      lineGeo.computeBoundingSphere()

      const nameEl = subjectNameRef.current
      if (nameEl) {
        nameEl.style.opacity = '0'
        window.setTimeout(() => {
          nameEl.textContent = subjectNamesRef.current[idx] ?? ''
          nameEl.style.opacity = '1'
        }, 300)
      }
    }

    applySubject(currentSubject)

    const rotateInterval = window.setInterval(() => {
      currentSubject = (currentSubject + 1) % SUBJECT_COUNT
      applySubject(currentSubject)
    }, ROTATE_MS)

    // Интерактивность
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 0.1 }
    const mouseVec  = new THREE.Vector2()
    const state = {
      dragging: false,
      startX: 0, startY: 0,
      lastX: 0,  lastY: 0,
      hovered: null as THREE.Mesh | null,
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
      window.clearInterval(rotateInterval)
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

      {/* current subject name */}
      <div ref={subjectNameRef} style={{
        position: 'absolute', top: 16, left: 10, pointerEvents: 'none', zIndex: 2,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: '#a78bfa',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        transition: 'opacity 0.3s',
      }} />

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
