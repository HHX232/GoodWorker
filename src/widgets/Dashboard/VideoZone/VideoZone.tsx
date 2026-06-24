'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { VideoCallModal } from '@/widgets/Dashboard/VideoCallModal/VideoCallModal'
import styles from './VideoZone.module.scss'

interface Room {
  id: string
  name: string
  topic: string | null
  createdAt: string
  endedAt: string | null
  hasTranscript: boolean
}

type BgMode = 'gradient' | '3d'
type CameraStatus = 'checking' | 'ready' | 'denied'

interface Props {
  ownerName?: string
  isStudent?: boolean
}

function formatDate(dateStr: string, locale: string, today: string, yesterday: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (days === 0) return today
  if (days === 1) return yesterday
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function VideoZone({ ownerName = '', isStudent = false }: Props) {
  const t = useTranslations('videoZone')
  const locale = useLocale()
  const router = useRouter()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefault, setModalDefault] = useState(ownerName)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active')
  const [rooms, setRooms] = useState<Room[]>([])
  const [bgMode, setBgMode] = useState<BgMode>('gradient')
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('checking')

  const canvasRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const threeRef = useRef<{ renderer: any; scene: any; cam: any } | null>(null)

  // Load rooms
  useEffect(() => {
    fetch('/api/call/my-rooms')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRooms(d) })
      .catch(() => {})
  }, [])

  // Check camera/mic permissions
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'microphone' as PermissionName }),
        ])
        if (cancelled) return
        if (camPerm.state === 'denied' || micPerm.state === 'denied') {
          setCameraStatus('denied')
        } else if (camPerm.state === 'granted' && micPerm.state === 'granted') {
          setCameraStatus('ready')
        } else {
          // 'prompt' state — try to get actual stream to verify
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            stream.getTracks().forEach(t => t.stop())
            if (!cancelled) setCameraStatus('ready')
          } catch {
            if (!cancelled) setCameraStatus('denied')
          }
        }
      } catch {
        // Permissions API not supported — try getUserMedia directly
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          stream.getTracks().forEach(t => t.stop())
          if (!cancelled) setCameraStatus('ready')
        } catch {
          if (!cancelled) setCameraStatus('denied')
        }
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // 3D Three.js effect
  useEffect(() => {
    if (bgMode !== '3d' || !canvasRef.current) return
    let disposed = false

    import('three').then(THREE => {
      if (disposed || !canvasRef.current) return

      const container = canvasRef.current
      const w = container.clientWidth || 290
      const h = container.clientHeight || 300

      const scene = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
      cam.position.z = 4.4

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      container.appendChild(renderer.domElement)

      const group = new THREE.Group()
      group.position.set(0.6, 0.3, 0)
      scene.add(group)

      group.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.28 })
      ))
      group.add(new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
      ))

      const pts: number[] = []
      for (let i = 0; i < 70; i++) {
        pts.push((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.45 })))

      threeRef.current = { renderer, scene, cam }

      const onResize = () => {
        if (!container) return
        const ww = container.clientWidth || 290
        const hh = container.clientHeight || 300
        renderer.setSize(ww, hh)
        cam.aspect = ww / hh
        cam.updateProjectionMatrix()
      }
      window.addEventListener('resize', onResize)

      function loop() {
        if (disposed) return
        animRef.current = requestAnimationFrame(loop)
        group.rotation.x += 0.0022
        group.rotation.y += 0.0042
        renderer.render(scene, cam)
      }
      loop()

      return () => {
        window.removeEventListener('resize', onResize)
      }
    })

    return () => {
      disposed = true
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (threeRef.current) {
        threeRef.current.renderer.dispose()
        if (canvasRef.current) canvasRef.current.innerHTML = ''
      }
      threeRef.current = null
    }
  }, [bgMode])

  const activeRooms = rooms.filter(r => !r.endedAt)
  const recentRooms = rooms.filter(r => r.endedAt)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim()
    if (!code) return
    setJoining(true)
    setJoinError('')
    try {
      const res = await fetch(`/api/call/rooms?name=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (data.status === 'active' && data.hasAccess) {
        router.push(`/call/${data.id}`)
      } else if (data.status === 'active' && !data.hasAccess) {
        setJoinError(t('errorNoAccess'))
      } else {
        setJoinError(t('errorNotFound'))
      }
    } catch {
      setJoinError(t('errorConnection'))
    } finally {
      setJoining(false)
    }
  }

  const handleRepeat = (room: Room) => {
    setModalDefault(room.topic ?? room.name)
    setModalOpen(true)
  }

  return (
    <>
      <section className={`${styles.vz} ${bgMode === '3d' ? styles.vzThreed : ''}`}>

        {/* ── Left: purple CTA ── */}
        <div className={styles.vzCta}>
          {/* 3D canvas overlay */}
          <div ref={canvasRef} className={styles.vzCanvas} />

          {/* Gradient / 3D toggle */}
          <div className={styles.vzBgToggle}>
            <button
              className={bgMode === 'gradient' ? styles.vzBgBtnOn : ''}
              onClick={() => setBgMode('gradient')}
            >
              {t('gradientBg')}
            </button>
            <button
              className={bgMode === '3d' ? styles.vzBgBtnOn : ''}
              onClick={() => setBgMode('3d')}
            >
              {t('threeDBg')}
            </button>
          </div>

          <span className={styles.vzIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="14" height="12" rx="2.5"/>
              <path d="m16 10 6-3v10l-6-3z"/>
            </svg>
          </span>

          <h3 className={styles.vzTitle}>{t('title')}</h3>
          <p className={styles.vzDesc}>{t('desc')}</p>

          <button className={styles.vzCreate} onClick={() => { setModalDefault(ownerName); setModalOpen(true) }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="14" height="12" rx="2.5"/>
              <path d="m16 10 6-3v10l-6-3z"/>
            </svg>
            {t('createBtn')}
          </button>

          <form className={styles.vzJoin} onSubmit={handleJoin}>
            <input
              type="text"
              className={styles.vzJoinInput}
              placeholder={t('joinPlaceholder')}
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value); setJoinError('') }}
              disabled={joining}
            />
            <button
              type="submit"
              className={styles.vzJoinBtn}
              disabled={joining || !joinCode.trim()}
              aria-label="Join"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
              </svg>
            </button>
          </form>
          {joinError && <p className={styles.vzJoinError}>{joinError}</p>}

          <div className={`${styles.vzReady} ${cameraStatus === 'denied' ? styles.vzReadyDenied : ''}`}>
            {cameraStatus === 'checking' && (
              <span className={styles.vzSpinner} />
            )}
            {cameraStatus === 'ready' && (
              <span className={styles.vzWave}>
                <i/><i/><i/><i/><i/>
              </span>
            )}
            {cameraStatus === 'denied' && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>
              </svg>
            )}
            {cameraStatus === 'checking' && t('cameraChecking')}
            {cameraStatus === 'ready' && t('cameraReady')}
            {cameraStatus === 'denied' && t('cameraNoAccess')}
          </div>
        </div>

        {/* ── Right: call list ── */}
        <div className={styles.vzPanel}>
          <div className={styles.vzTabs}>
            <button
              className={`${styles.vzTab} ${activeTab === 'active' ? styles.vzTabOn : ''}`}
              onClick={() => setActiveTab('active')}
            >
              {t('tabActive')}
              <span className={styles.vzPill}>{activeRooms.length}</span>
            </button>
            <button
              className={`${styles.vzTab} ${activeTab === 'recent' ? styles.vzTabOn : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              {t('tabRecent')}
              <span className={styles.vzPill}>{recentRooms.length}</span>
            </button>
          </div>

          <div className={styles.vzList}>
            {activeTab === 'active' ? (
              activeRooms.length === 0 ? (
                <div className={styles.vzEmpty}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="m16 10 6-3v10l-6-3z"/>
                  </svg>
                  {t('noActive')}
                </div>
              ) : activeRooms.map(room => (
                <div key={room.id} className={`${styles.vzCall} ${styles.vzCallNext}`}>
                  <span className={styles.vzCallIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>
                    </svg>
                  </span>
                  <div className={styles.vzCallInfo}>
                    <div className={styles.vzCallTitle}>{room.topic ?? room.name}</div>
                    <div className={styles.vzCallSub}>
                      <span className={styles.vzCallBadge}>{t('badgeActive')}</span>
                    </div>
                  </div>
                  <button className={styles.vzBtnJoin} onClick={() => router.push(`/call/${room.id}`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
                    </svg>
                    {t('joinBtn')}
                  </button>
                </div>
              ))
            ) : (
              recentRooms.length === 0 ? (
                <div className={styles.vzEmpty}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="m16 10 6-3v10l-6-3z"/>
                  </svg>
                  {t('noRecent')}
                </div>
              ) : recentRooms.slice(0, 5).map(room => (
                <div key={room.id} className={styles.vzCall}>
                  <div className={styles.vzCallWhen}>
                    <div className={styles.vzCallDate}>{formatDate(room.createdAt, locale, t('today'), t('yesterday'))}</div>
                  </div>
                  <span className={styles.vzCallIconGhost}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>
                    </svg>
                  </span>
                  <div className={styles.vzCallInfo}>
                    <div className={styles.vzCallTitle}>{room.topic ?? room.name}</div>
                  </div>
                  <div className={styles.vzCallActions}>
                    {room.hasTranscript && (
                      <a
                        href={`/call/${room.id}/transcript`}
                        className={styles.vzBtnTranscript}
                        title={t('transcriptBtn')}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M4 6h16M4 10h16M4 14h10"/>
                        </svg>
                        {t('transcriptBtn')}
                      </a>
                    )}
                    <button className={styles.vzBtnGhost} onClick={() => handleRepeat(room)}>
                      {t('repeatBtn')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {modalOpen && (
        <VideoCallModal
          defaultName={modalDefault}
          isStudent={isStudent}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
