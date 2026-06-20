'use client'

import styles from '@/shared/scss/not_found.module.scss'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useThemeCtx } from '@/app/providers/ThemeContext'

interface Dot {
  id: string
  originalX: number
  originalY: number
  currentX: number
  currentY: number
  color: string
}

interface MousePosition {
  x: number
  y: number
}

export default function NotFound() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [mousePos, setMousePos] = useState<MousePosition>({x: -1000, y: -1000})
  const [dots, setDots] = useState<Dot[]>([])
  const [isMouseInside, setIsMouseInside] = useState<boolean>(false)
  const [windowWidth, setWindowWidth] = useState<number>(0)
  const animationFrameRef = useRef<number>(1)
  const lastUpdateTime = useRef<number>(0)

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const createDotsFor404 = (): Dot[] => {
      const newDots: Dot[] = []
      const spacing = 2
      const dotDensity = 2

      const createDigit = (digit: '4' | '0', offsetX: number): void => {
        const patterns: Record<'4' | '0', number[][]> = {
          '4': [
            [1, 1, 1, 1, 0, 0],
            [1, 1, 1, 1, 0, 0],
            [1, 1, 0, 1, 0, 0],
            [1, 1, 0, 1, 0, 0],
            [1, 1, 0, 1, 0, 0],
            [1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1],
            [0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0]
          ],
          '0': [
            [0, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 0]
          ]
        }

        const pattern = patterns[digit]
        pattern.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell === 1) {
              for (let dy = 0; dy < dotDensity; dy++) {
                for (let dx = 0; dx < dotDensity; dx++) {
                  const subX = x * dotDensity + dx
                  const subY = y * dotDensity + dy

                  const randomOffset = 0.15
                  const randomX = (Math.random() - 0.5) * randomOffset
                  const randomY = (Math.random() - 0.5) * randomOffset

                  const colorIndex = (subX + subY) % 2
                  const color = colorIndex === 0 ? '#080b13' : '#404040'

                  const posX = offsetX + subX * spacing + randomX
                  const posY = subY * spacing + randomY

                  newDots.push({
                    id: `${offsetX}-${subX}-${subY}`,
                    originalX: posX,
                    originalY: posY,
                    currentX: posX,
                    currentY: posY,
                    color: color
                  })
                }
              }
            }
          })
        })
      }

      createDigit('4', 0)
      createDigit('0', 30)
      createDigit('4', 60)

      return newDots
    }

    setDots(createDotsFor404())
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>): void => {
    if (!svgRef.current) return

    const now = Date.now()
    if (now - lastUpdateTime.current < 16) return
    lastUpdateTime.current = now

    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = 100 / rect.width
    const scaleY = 50 / rect.height

    const newX = (e.clientX - rect.left) * scaleX
    const newY = (e.clientY - rect.top) * scaleY

    setMousePos({x: newX, y: newY})
    setIsMouseInside(true)
  }, [])

  useEffect(() => {
    const animate = () => {
      const repelRadius = 20
      const maxDistance = 10

      setDots((prevDots) =>
        prevDots.map((dot) => {
          if (isMouseInside && mousePos.x !== -1000) {
            const dx = dot.originalX - mousePos.x
            const dy = dot.originalY - mousePos.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < repelRadius && distance > 0) {
              const force = 1 - distance / repelRadius
              const angle = Math.atan2(dy, dx)

              const targetX = dot.originalX + Math.cos(angle) * force * maxDistance
              const targetY = dot.originalY + Math.sin(angle) * force * maxDistance

              return {
                ...dot,
                currentX: dot.currentX + (targetX - dot.currentX) * 0.2,
                currentY: dot.currentY + (targetY - dot.currentY) * 0.2
              }
            } else {
              const returnSpeed = 0.05
              return {
                ...dot,
                currentX: dot.currentX + (dot.originalX - dot.currentX) * returnSpeed,
                currentY: dot.currentY + (dot.originalY - dot.currentY) * returnSpeed
              }
            }
          } else {
            const returnSpeed = 0.15
            const dx = dot.originalX - dot.currentX
            const dy = dot.originalY - dot.currentY
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < 0.01) {
              return {
                ...dot,
                currentX: dot.originalX,
                currentY: dot.originalY
              }
            }

            return {
              ...dot,
              currentX: dot.currentX + dx * returnSpeed,
              currentY: dot.currentY + dy * returnSpeed
            }
          }
        })
      )

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [mousePos, isMouseInside])

  const handleMouseEnter = useCallback(() => {
    setIsMouseInside(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsMouseInside(false)
    setMousePos({x: -1000, y: -1000})
  }, [])

  const { isDark } = useThemeCtx()
  const isMobile = windowWidth < 600
  const svgWidth = isMobile ? 300 : 500
  const svgHeight = isMobile ? 150 : 250
  const paddingStyle = isMobile ? '40px 20px' : ''
  const marginLeft = isMobile ? '40px' : '70px'
  const t = useTranslations('NotFoundPage')

  if (windowWidth === 0) {
    return (
      <div data-testid='not-found-page' className={styles.notFoundContainer}>
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>
            <p data-testid='not-found-description' className={styles.description}>
              {t('mainText')}
            </p>
            <Link data-testid='not-found-home-link' href='/' className={styles.homeButton}>
              {t('goBack')}
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div data-testid='not-found-page' className={styles.notFoundContainer}>
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: paddingStyle,
              overflow: 'visible'
            }}
          >
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              viewBox='0 0 100 50'
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
                overflow: 'visible',
                marginLeft: marginLeft,
                maxHeight: '17.5rem',
                maxWidth: '100%',
                marginTop: '40px',
                filter: isDark ? 'invert(1) brightness(0.85)' : 'none',
              }}
            >
              {dots.map((dot) => (
                <circle
                  key={dot.id}
                  cx={dot.currentX}
                  cy={dot.currentY}
                  r='0.6'
                  fill={dot.color}
                  style={{
                    opacity: 0.95,
                    transition: !isMouseInside ? 'all 0.3s ease-out' : 'none'
                  }}
                />
              ))}
            </svg>
          </div>
          <p data-testid='not-found-description' className={styles.description}>
            {t('mainText')}
          </p>
          <Link data-testid='not-found-home-link' href='/' className={styles.homeButton}>
            {t('goBack')}
          </Link>
        </div>
      </main>
    </div>
  )
}
