'use client'

import { VideoCallModal } from '@/widgets/Dashboard/VideoCallModal/VideoCallModal'
import { TranscriptsModal } from '@/widgets/Forms/ProfileEditForm/TranscriptsModal'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import styles from './VideoZone.module.scss'

interface Room {
  id: string
  name: string
  topic: string | null
  createdAt: string
  endedAt: string | null
  hasTranscript: boolean
}

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
  return date.toLocaleDateString(locale, {day: 'numeric', month: 'short'})
}

async function requestMediaPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true})
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function VideoZone({isStudent = false}: Props) {
  const t = useTranslations('videoZone')
  const locale = useLocale()
  const router = useRouter()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDefault, setModalDefault] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [createPermError, setCreatePermError] = useState('')
  const [mediaStatus, setMediaStatus] = useState<'idle' | 'checking' | 'ready' | 'denied'>('idle')
  const [activeTab, setActiveTab] = useState<'active' | 'recent'>('active')
  const [rooms, setRooms] = useState<Room[]>([])
  const [transcriptRoom, setTranscriptRoom] = useState<Room | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threeRef = useRef<{renderer: any; scene: any; cam: any} | null>(null)

  // Load rooms
  useEffect(() => {
    fetch('/api/call/my-rooms')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRooms(d)
      })
      .catch(() => {})
  }, [])

  // 3D Three.js effect — always active
  useEffect(() => {
    if (!canvasRef.current) return
    const container = canvasRef.current
    let disposed = false

    import('three').then((THREE) => {
      if (disposed || !container) return

      const w = container.clientWidth || 290
      const h = container.clientHeight || 300

      const scene = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
      cam.position.z = 4.4

      const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true})
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h)
      container.appendChild(renderer.domElement)

      const group = new THREE.Group()
      group.position.set(0.6, 0.3, 0)
      scene.add(group)

      group.add(
        new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.6, 1),
          new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, transparent: true, opacity: 0.28})
        )
      )
      group.add(
        new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.05, 0),
          new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.06})
        )
      )

      const pts: number[] = []
      for (let i = 0; i < 70; i++) {
        pts.push((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      scene.add(
        new THREE.Points(geo, new THREE.PointsMaterial({color: 0xffffff, size: 0.04, transparent: true, opacity: 0.45}))
      )

      threeRef.current = {renderer, scene, cam}

      const onResize = () => {
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
        container.innerHTML = ''
      }
      threeRef.current = null
    }
  }, [])

  const activeRooms = rooms.filter((r) => !r.endedAt)
  const recentRooms = rooms.filter((r) => r.endedAt)

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim()
    if (!code) return
    setJoining(true)
    setJoinError('')

    const granted = await requestMediaPermission()
    if (!granted) {
      setJoinError(t('errorPermission'))
      setJoining(false)
      return
    }

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

  const handleCheckMedia = async () => {
    setMediaStatus('checking')
    const granted = await requestMediaPermission()
    setMediaStatus(granted ? 'ready' : 'denied')
  }

  const handleCreateClick = async () => {
    setCreatePermError('')
    if (mediaStatus !== 'ready') {
      const granted = await requestMediaPermission()
      setMediaStatus(granted ? 'ready' : 'denied')
      if (!granted) {
        setCreatePermError(t('errorPermission'))
        return
      }
    }
    setModalDefault('')
    setModalOpen(true)
  }

  const handleRepeat = (room: Room) => {
    setModalDefault(room.topic ?? room.name)
    setModalOpen(true)
  }

  return (
    <>
      <section className={`${styles.vz} ${styles.vzThreed}`}>
        {/* ── Left: purple CTA ── */}
        <div className={styles.vzCta}>
          {/* 3D canvas overlay */}
          <div ref={canvasRef} className={styles.vzCanvas} />

          <span className={styles.vzIcon}>
            <svg
              width='22'
              height='22'
              viewBox='0 0 24 24'
              fill='none'
              stroke='#fff'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='2' y='6' width='14' height='12' rx='2.5' />
              <path d='m16 10 6-3v10l-6-3z' />
            </svg>
          </span>

          <h3 className={styles.vzTitle}>{t('title')}</h3>
          <p className={styles.vzDesc}>{t('desc')}</p>

          <button className={styles.vzCreate} onClick={handleCreateClick}>
            <svg
              width='17'
              height='17'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <rect x='2' y='6' width='14' height='12' rx='2.5' />
              <path d='m16 10 6-3v10l-6-3z' />
            </svg>
            {t('createBtn')}
          </button>
          {createPermError && <p className={styles.vzJoinError}>{createPermError}</p>}

          <button
            type='button'
            className={`${styles.vzReady} ${mediaStatus === 'denied' ? styles.vzReadyDenied : ''}`}
            onClick={handleCheckMedia}
            disabled={mediaStatus === 'checking'}
          >
            {mediaStatus === 'checking' && <span className={styles.vzSpinner} />}
            {mediaStatus === 'ready' && (
              <span className={styles.vzWave}><i /><i /><i /><i /><i /></span>
            )}
            {mediaStatus === 'denied' && (
              <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'>
                <circle cx='12' cy='12' r='10' /><path d='m15 9-6 6M9 9l6 6' />
              </svg>
            )}
            {mediaStatus === 'idle' && (
              <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14' /><rect x='1' y='6' width='14' height='12' rx='2' />
              </svg>
            )}
            {mediaStatus === 'idle' && t('cameraCheck')}
            {mediaStatus === 'checking' && t('cameraChecking')}
            {mediaStatus === 'ready' && t('cameraReady')}
            {mediaStatus === 'denied' && t('cameraNoAccess')}
          </button>

          <form className={styles.vzJoin} onSubmit={handleJoin}>
            <input
              type='text'
              className={styles.vzJoinInput}
              placeholder={t('joinPlaceholder')}
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value)
                setJoinError('')
              }}
              disabled={joining}
            />
            <button type='submit' className={styles.vzJoinBtn} disabled={joining || !joinCode.trim()} aria-label='Join'>
              <svg
                width='15'
                height='15'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.3'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M5 12h14' />
                <path d='m13 5 7 7-7 7' />
              </svg>
            </button>
          </form>
          {joinError && <p className={styles.vzJoinError}>{joinError}</p>}
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
                  <svg
                    width='26'
                    height='26'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                  >
                    <rect x='2' y='6' width='14' height='12' rx='2.5' />
                    <path d='m16 10 6-3v10l-6-3z' />
                  </svg>
                  {t('noActive')}
                </div>
              ) : (
                activeRooms.map((room) => (
                  <div key={room.id} className={`${styles.vzCall} ${styles.vzCallNext}`}>
                    <span className={styles.vzCallIcon}>
                      <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <rect x='2' y='6' width='14' height='12' rx='2' />
                        <path d='m16 10 6-3v10l-6-3z' />
                      </svg>
                    </span>
                    <div className={styles.vzCallInfo}>
                      <div className={styles.vzCallTitle}>{room.topic ?? room.name}</div>
                      <div className={styles.vzCallSub}>
                        <span className={styles.vzCallBadge}>{t('badgeActive')}</span>
                      </div>
                    </div>
                    <button className={styles.vzBtnJoin} onClick={() => router.push(`/call/${room.id}`)}>
                      <svg
                        width='13'
                        height='13'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2.5'
                        strokeLinecap='round'
                      >
                        <path d='M5 12h14' />
                        <path d='m13 5 7 7-7 7' />
                      </svg>
                      {t('joinBtn')}
                    </button>
                  </div>
                ))
              )
            ) : recentRooms.length === 0 ? (
              <div className={styles.vzEmpty}>
                <svg
                  width='26'
                  height='26'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                >
                  <rect x='2' y='6' width='14' height='12' rx='2.5' />
                  <path d='m16 10 6-3v10l-6-3z' />
                </svg>
                {t('noRecent')}
              </div>
            ) : (
              recentRooms.map((room) => (
                <div key={room.id} className={styles.vzCall}>
                  <div className={styles.vzCallWhen}>
                    <div className={styles.vzCallDate}>
                      {formatDate(room.createdAt, locale, t('today'), t('yesterday'))}
                    </div>
                  </div>
                  <span className={styles.vzCallIconGhost}>
                    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                      <rect x='2' y='6' width='14' height='12' rx='2' />
                      <path d='m16 10 6-3v10l-6-3z' />
                    </svg>
                  </span>
                  <div className={styles.vzCallInfo}>
                    <div className={styles.vzCallTitle}>{room.topic ?? room.name}</div>
                  </div>
                  <div className={styles.vzCallActions}>
                    {room.hasTranscript && (
                      <button
                        className={styles.vzBtnTranscript}
                        title={t('transcriptBtn')}
                        onClick={() => setTranscriptRoom(room)}
                      >
                        <svg
                          width='13'
                          height='13'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='2'
                          strokeLinecap='round'
                        >
                          <path d='M4 6h16M4 10h16M4 14h10' />
                        </svg>
                        {t('transcriptBtn')}
                      </button>
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

      {transcriptRoom && (
        <TranscriptsModal
          isOpen={true}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialRoom={transcriptRoom as any}
          onClose={() => setTranscriptRoom(null)}
        />
      )}
      {modalOpen && (
        <VideoCallModal defaultName={modalDefault} isStudent={isStudent} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
