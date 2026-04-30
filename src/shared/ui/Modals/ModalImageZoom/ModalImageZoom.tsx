'use client'

import {useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import styles from './ModalImageZoom.module.scss'

interface ModalImageZoomProps {
  isOpen: boolean
  src: string | null
  onClose: () => void
}

export function ModalImageZoom({isOpen, src, onClose}: ModalImageZoomProps) {
  const [zoom, setZoom] = useState(1)
  const [mounted, setMounted] = useState(false)

  // Wait for DOM to be available (Next.js SSR safety)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset zoom whenever a new image opens
  useEffect(() => {
    if (isOpen) setZoom(1)
  }, [isOpen, src])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!mounted || !isOpen || !src) return null

  const portal = document.getElementById('modal_portal')
  if (!portal) return null

  const zoomIn = () => setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 3))
  const zoomOut = () => setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.5))
  const zoomReset = () => setZoom(1)

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role='dialog' aria-modal='true'>
      {/* Image area — clicks don't bubble to overlay */}
      <div className={styles.image_wrap} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt='zoomed' className={styles.image} style={{transform: `scale(${zoom})`}} draggable={false} />
      </div>

      {/* Controls — stop propagation so clicks don't close modal */}
      <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
        <button className={styles.ctrl_btn} onClick={zoomOut} title='Zoom out' disabled={zoom <= 0.5}>
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='11' cy='11' r='8' />
            <line x1='21' y1='21' x2='16.65' y2='16.65' />
            <line x1='8' y1='11' x2='14' y2='11' />
          </svg>
        </button>

        <button className={styles.ctrl_btn} onClick={zoomReset} title='Reset zoom'>
          <span className={styles.zoom_pct}>{Math.round(zoom * 100)}%</span>
        </button>

        <button className={styles.ctrl_btn} onClick={zoomIn} title='Zoom in' disabled={zoom >= 3}>
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <circle cx='11' cy='11' r='8' />
            <line x1='21' y1='21' x2='16.65' y2='16.65' />
            <line x1='11' y1='8' x2='11' y2='14' />
            <line x1='8' y1='11' x2='14' y2='11' />
          </svg>
        </button>

        <div className={styles.ctrl_divider} />

        <button className={styles.ctrl_btn} onClick={onClose} title='Close'>
          <svg
            width='18'
            height='18'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <line x1='18' y1='6' x2='6' y2='18' />
            <line x1='6' y1='6' x2='18' y2='18' />
          </svg>
        </button>
      </div>
    </div>,
    portal
  )
}
