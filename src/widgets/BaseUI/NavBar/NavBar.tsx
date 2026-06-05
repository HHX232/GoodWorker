'use client'

import {useSession, signOut} from 'next-auth/react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import styles from './NavBar.module.scss'

// ─── Inline SVG icons ─────────────────────────────────────

const Icon = {
  Home: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />
      <polyline points='9 22 9 12 15 12 15 22' />
    </svg>
  ),
  CreatePost: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='12' y1='18' x2='12' y2='12' />
      <line x1='9' y1='15' x2='15' y2='15' />
    </svg>
  ),
  CreateRoadmap: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <polygon points='1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6' />
      <line x1='8' y1='2' x2='8' y2='18' />
      <line x1='16' y1='6' x2='16' y2='22' />
    </svg>
  ),
  CreateTest: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M9 11l3 3L22 4' />
      <path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' />
    </svg>
  ),
  Roadmaps: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='3' width='7' height='7' /><rect x='14' y='3' width='7' height='7' />
      <rect x='14' y='14' width='7' height='7' /><rect x='3' y='14' width='7' height='7' />
    </svg>
  ),
  Bookmark: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' />
    </svg>
  ),
  Messages: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
    </svg>
  ),
  Support: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='10' />
      <path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' />
      <line x1='12' y1='17' x2='12.01' y2='17' />
    </svg>
  ),
  Profile: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  ),
  Login: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' />
      <polyline points='10 17 15 12 10 7' />
      <line x1='15' y1='12' x2='3' y2='12' />
    </svg>
  ),
  Globe: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='10' />
      <line x1='2' y1='12' x2='22' y2='12' />
      <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' />
    </svg>
  ),
  Teachers: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  ),
  Calendar: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
      <line x1='16' y1='2' x2='16' y2='6' />
      <line x1='8' y1='2' x2='8' y2='6' />
      <line x1='3' y1='10' x2='21' y2='10' />
    </svg>
  ),
  Games: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='2' y='6' width='20' height='12' rx='3' ry='3' />
      <line x1='6' y1='12' x2='10' y2='12' />
      <line x1='8' y1='10' x2='8' y2='14' />
      <circle cx='16' cy='11' r='1' fill='currentColor' stroke='none' />
      <circle cx='18' cy='13' r='1' fill='currentColor' stroke='none' />
    </svg>
  ),
  Pomodoro: () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  ),
}

// ─── Nav item definition ──────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  id?: string
  items: NavItem[]
}

// ─── NavLink ─────────────────────────────────────────────

function NavLink({item, active}: {item: NavItem; active: boolean}) {
  return (
    <Link
      href={item.href}
      className={`${styles.item} ${active ? styles.active : ''}`}
      title={item.label}
    >
      <span className={styles.icon}>{item.icon}</span>
      <span className={styles.label}>{item.label}</span>
    </Link>
  )
}

function NavGroupSection({group, isActive}: {group: NavGroup; isActive: (href: string) => boolean}) {
  return (
    <div className={styles.groupSection} id={group.id}>
      {group.items.map(item => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
    </div>
  )
}

// ─── NavBar ───────────────────────────────────────────────

export function NavBar({extraClass}: {extraClass?: string}) {
  const {data: session, status} = useSession()
  const pathname = usePathname()
  const t = useTranslations('NavBar')
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragStartExp = useRef<boolean>(false)

  useEffect(() => setMounted(true), [])

  const role = session?.user?.role
  const userId = session?.user?.id

  let topGroups: NavGroup[]
  let bottomGroups: NavGroup[]

  if (status === 'loading') {
    topGroups = [
      {items: [{href: '/', label: t('home'), icon: <Icon.Home />}]},
      {items: [{href: '/workflows-list', label: t('roadmaps'), icon: <Icon.Roadmaps />}]},
    ]
    bottomGroups = []
  } else if (role === 'TEACHER' || role === 'ADMIN') {
    topGroups = [
      {items: [{href: '/', label: t('home'), icon: <Icon.Home />}]},
      {id: 'navbar-catalog', items: [
        {href: '/workflows-list', label: t('courses'),  icon: <Icon.Roadmaps />},
        {href: '/teachers',       label: t('teachers'), icon: <Icon.Teachers />},
      ]},
    ]
    bottomGroups = [
      {items: [{href: '/create-post',     label: t('createPost'),   icon: <Icon.CreatePost />}]},
      {items: [{href: '/create-road-map', label: t('createCourse'), icon: <Icon.CreateRoadmap />}]},
      {items: [{href: '/create-test',     label: t('createTest'),   icon: <Icon.CreateTest />}]},
      ...(userId ? [{items: [{href: `/calendar/${userId}`, label: t('calendar'), icon: <Icon.Calendar />}]}] : []),
      {items: [{href: '/game',            label: t('games'),   icon: <Icon.Games />}]},
      {items: [{href: '/teacher-profile', label: t('profile'), icon: <Icon.Profile />}]},
      {items: [{href: '/feedback',        label: t('support'), icon: <Icon.Support />}]},
    ]
  } else if (role === 'STUDENT') {
    topGroups = [
      {items: [{href: '/', label: t('home'), icon: <Icon.Home />}]},
      {id: 'navbar-catalog', items: [
        {href: '/workflows-list', label: t('courseCatalog'), icon: <Icon.Roadmaps />},
        {href: '/teachers',       label: t('teachers'),      icon: <Icon.Teachers />},
      ]},
    ]
    bottomGroups = [
      {items: [{href: '/messages',        label: t('messages'), icon: <Icon.Messages />}]},
      {items: [{href: '/game',            label: t('games'),    icon: <Icon.Games />}]},
      {items: [{href: '/pomodoro',        label: t('pomodoro'), icon: <Icon.Pomodoro />}]},
      {items: [{href: '/student-profile', label: t('profile'),  icon: <Icon.Profile />}]},
      {items: [{href: '/feedback',        label: t('support'),  icon: <Icon.Support />}]},
    ]
  } else {
    topGroups = [
      {items: [{href: '/', label: t('home'), icon: <Icon.Home />}]},
      {items: [{href: '/workflows-list', label: t('roadmaps'), icon: <Icon.Roadmaps />}]},
    ]
    bottomGroups = [
      {items: [{href: '/game', label: t('games'), icon: <Icon.Games />}]},
      {id: 'navbar-login', items: [{href: '/login', label: t('login'), icon: <Icon.Login />}]},
      {items: [{href: '/feedback', label: t('support'), icon: <Icon.Support />}]},
    ]
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const handleDragStart = useCallback((clientY: number) => {
    dragStartY.current = clientY
    dragStartExp.current = isExpanded
  }, [isExpanded])

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
      id="main-navbar"
      ref={sheetRef}
      className={`${styles.navbar} ${mounted && isExpanded ? styles.expanded : ''} ${extraClass ?? ''}`}
    >
      {/* Drag handle (mobile only) */}
      <div
        className={styles.drag_handle_wrapper}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onClick={() => setIsExpanded((p) => !p)}
        role='button'
        tabIndex={0}
        aria-label={isExpanded ? t('collapse') : t('expand')}
      >
        <div className={styles.drag_handle} />
      </div>

      <div className={styles.nav_content}>
        {/* Top groups */}
        <div className={styles.group} id="navbar-nav">
          {topGroups.map((group, i) => (
            <NavGroupSection key={group.id ?? `g${i}`} group={group} isActive={isActive} />
          ))}
        </div>

        {/* Bottom group (expandable on mobile) */}
        {bottomGroups.length > 0 && bottomGroups.some(g => g.items.length > 0) && (
          <div className={styles.expandable}>
            <div className={styles.expandable_inner}>
              <div className={styles.divider} />
              <div className={`${styles.group} ${styles.bottom_group}`}>
                {bottomGroups.map((group, i) => (
                  <NavGroupSection key={group.id ?? `bg${i}`} group={group} isActive={isActive} />
                ))}
                {role && (
                  <div className={styles.groupSection}>
                    <button
                      className={styles.logout_btn}
                      onClick={() => signOut({callbackUrl: '/login'})}
                      title={t('logout')}
                    >
                      <span className={styles.icon}>
                        <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
                          <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                          <polyline points='16 17 21 12 16 7' />
                          <line x1='21' y1='12' x2='9' y2='12' />
                        </svg>
                      </span>
                      <span className={styles.label}>{t('logout')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
