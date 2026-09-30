'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRef } from 'react'
import * as THREE from 'three'
import { animateFloatingShapes, buildFloatingShapes, type FloatingShapeState } from './floatingShapes'
import styles from './Footer.module.scss'
import { useThreeLifecycle, type ThreeLifecycleContext } from './useThreeLifecycle'

const GRAY = 0x9aa0a6

/** Фигуры разбросаны по всей высоте футера, не только под шапкой. */
const SHAPE_CONFIG = [
  { geometry: () => new THREE.IcosahedronGeometry(1, 0), base: [-3.2, 1.6, -1] as [number, number, number], scale: 1, opacity: 0.5 },
  { geometry: () => new THREE.OctahedronGeometry(0.9, 0), base: [3, 0.4, 0.5] as [number, number, number], scale: 1.05, opacity: 0.4 },
  { geometry: () => new THREE.TorusGeometry(0.65, 0.22, 8, 24), base: [-0.4, -1.4, -2] as [number, number, number], scale: 0.9, opacity: 0.35 },
  { geometry: () => new THREE.TetrahedronGeometry(0.95, 0), base: [1.6, -2, 1] as [number, number, number], scale: 0.85, opacity: 0.4 },
  { geometry: () => new THREE.DodecahedronGeometry(0.7, 0), base: [3.6, -2.4, -1.6] as [number, number, number], scale: 0.8, opacity: 0.3 },
  { geometry: () => new THREE.IcosahedronGeometry(0.55, 0), base: [-3.4, -2.2, 0.2] as [number, number, number], scale: 1, opacity: 0.35 }
]

const PRODUCT_LINKS = [
  { key: 'pdfToTest', href: '/info-pdf-to-test' },
  { key: 'videoCalls', href: '/call' },
  { key: 'courses', href: '/workflows-list' },
  { key: 'posts', href: '/posts' },
  { key: 'pricing', href: '/vip' }
] as const

const ACCOUNT_LINKS = [
  { key: 'findTutor', href: '/teachers' },
  { key: 'forStudents', href: '/student-calendar' },
  { key: 'forTeachers', href: '/calendar' }
] as const

const SUPPORT_LINKS = [
  { key: 'feedback', href: '/feedback' },
  { key: 'complaints', href: '/complaints' }
] as const

const LEGAL_LINKS = [
  { key: 'terms', href: '/terms' },
  { key: 'privacy', href: '/privacy' }
] as const

/**
 * Футер главной страницы: серые дрейфующие wireframe-фигуры фоном на всю
 * высоту, текст на панелях с backdrop-filter: blur. Выбран по итогам
 * дизайн-витрины в `src/experiments/footer-variants/` (вариант «И1»).
 * `forStudents`/`forTeachers`/`videoCalls` ведут на страницы личного
 * кабинета — незалогиненного посетителя они уводят на `/login`, это
 * ожидаемое поведение, не заглушка.
 */
export default function Footer() {
  const t = useTranslations('Footer')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const shapesRef = useRef<FloatingShapeState[]>([])

  useThreeLifecycle(containerRef, {
    cameraFov: 55,
    cameraZ: 7,
    alpha: true,
    init: (ctx: ThreeLifecycleContext) => {
      const group = new THREE.Group()
      shapesRef.current = buildFloatingShapes(group, SHAPE_CONFIG, GRAY)
      ctx.scene.add(group)
      return () => {
        shapesRef.current = []
      }
    },
    animate: (_ctx, elapsed) => animateFloatingShapes(shapesRef.current, elapsed)
  })

  return (
    <footer className={styles.footer}>
      <div className={styles.stage} ref={containerRef} />

      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={`${styles.panel} ${styles.col}`}>
            <p className={styles.colTitle}>{t('productHeading')}</p>
            {PRODUCT_LINKS.map((link) => (
              <Link key={link.key} href={link.href}>
                {t(link.key)}
              </Link>
            ))}
          </div>

          <div className={`${styles.panel} ${styles.col}`}>
            <p className={styles.colTitle}>{t('accountHeading')}</p>
            {ACCOUNT_LINKS.map((link) => (
              <Link key={link.key} href={link.href}>
                {t(link.key)}
              </Link>
            ))}
          </div>

          <div className={`${styles.panel} ${styles.col}`}>
            <p className={styles.colTitle}>{t('supportHeading')}</p>
            {SUPPORT_LINKS.map((link) => (
              <Link key={link.key} href={link.href}>
                {t(link.key)}
              </Link>
            ))}
          </div>

          <div className={`${styles.panel} ${styles.col}`}>
            <p className={styles.colTitle}>{t('legalHeading')}</p>
            {LEGAL_LINKS.map((link) => (
              <Link key={link.key} href={link.href}>
                {t(link.key)}
              </Link>
            ))}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.bottomBar}`}>
          <p>{t('copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  )
}
