'use client'

import {useTranslations} from 'next-intl'
import Image from 'next/image'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './NavBar.module.scss'

interface NavItem {
  id: string
  labelKey: string
  icon: string
}

const topItems: NavItem[] = [
  {id: 'home', labelKey: 'home', icon: '/navbar/home.svg'},
  {id: 'add', labelKey: 'add', icon: '/navbar/add.svg'},
  {id: 'bookmark', labelKey: 'bookmark', icon: '/navbar/bookmark.svg'},
  {id: 'bubble', labelKey: 'messages', icon: '/navbar/bubble.svg'}
]

const bottomItems: NavItem[] = [
  {id: 'support', labelKey: 'support', icon: '/navbar/support.svg'},
  {id: 'settings', labelKey: 'settings', icon: '/navbar/settings.svg'}
]

export function NavBar({extraClass}: {extraClass?: string}) {
  const t = useTranslations('NavBar')

  const [activeId, setActiveId] = useState<string>('home')
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const sheetRef = useRef<HTMLElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragStartExp = useRef<boolean>(false)

  const handleDragStart = useCallback(
    (clientY: number) => {
      dragStartY.current = clientY
      dragStartExp.current = isExpanded
    },
    [isExpanded]
  )

  const handleDragEnd = useCallback((clientY: number) => {
    if (dragStartY.current === null) return
    const delta = clientY - dragStartY.current
    if (dragStartExp.current) {
      if (delta > 10) setIsExpanded(false)
    } else {
      if (delta < -10) setIsExpanded(true)
    }
    dragStartY.current = null
  }, [])

  const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY)
  const onTouchEnd = (e: React.TouchEvent) => handleDragEnd(e.changedTouches[0].clientY)
  const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientY)

  useEffect(() => {
    if (dragStartY.current === null) return
    const onMouseUp = (e: MouseEvent) => handleDragEnd(e.clientY)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [handleDragEnd])

  return (
    <nav
      ref={sheetRef}
      className={`
        ${styles.navbar}
        ${mounted && isExpanded ? styles.expanded : ''}
        ${extraClass ?? ''}
      `}
    >
      {/* ── drag handle ── */}
      <div
        className={styles.drag_handle_wrapper}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-label={isExpanded ? t('collapse') : t('expand')}
        role='button'
        tabIndex={0}
      >
        <div className={styles.drag_handle} />
      </div>

      {/* ── nav items ── */}
      <div className={styles.nav_content}>
        <div className={styles.group}>
          {topItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.item} ${activeId === item.id ? styles.active : ''}`}
              onClick={() => setActiveId(item.id)}
              title={t(item.labelKey)}
            >
              <Image src={item.icon} alt={t(item.labelKey)} width={20} height={20} className={styles.icon} />
              <span className={styles.label}>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className={styles.expandable}>
          <div className={styles.expandable_inner}>
            <div className={styles.divider} />
            <div className={`${styles.group} ${styles.bottom_group}`}>
              {bottomItems.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.item} ${activeId === item.id ? styles.active : ''}`}
                  onClick={() => setActiveId(item.id)}
                  title={t(item.labelKey)}
                >
                  <Image src={item.icon} alt={t(item.labelKey)} width={20} height={20} className={styles.icon} />
                  <span className={styles.label}>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
