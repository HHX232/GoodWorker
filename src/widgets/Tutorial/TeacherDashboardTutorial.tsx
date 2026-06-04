'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useTutorial } from './TutorialContext'

const COOKIE_KEY = 'gw_tutorial_teacher_dashboard'

function getCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

export function TeacherDashboardTutorial() {
  const t = useTranslations('tutorial')
  const { startTutorial } = useTutorial()

  useEffect(() => {
    if (getCookie(COOKIE_KEY)) return

    const timer = setTimeout(() => {
      setCookie(COOKIE_KEY, '1')
      startTutorial([
        {
          stepNumber: 1,
          elementId: 'dashboard-video-room',
          title: t('tDash_videoRoom_title'),
          description: t('tDash_videoRoom_desc'),
          position: 'bottom' as const,
        },
        {
          stepNumber: 2,
          elementId: 'dashboard-history-tools',
          title: t('tDash_history_title'),
          description: t('tDash_history_desc'),
          position: 'left' as const,
        },
        {
          stepNumber: 3,
          elementId: 'dashboard-promo',
          title: t('tDash_promo_title'),
          description: t('tDash_promo_desc'),
          position: 'left' as const,
        },
        {
          stepNumber: 4,
          elementId: 'dashboard-telegram',
          title: t('tDash_telegram_title'),
          description: t('tDash_telegram_desc'),
          position: 'left' as const,
        },
        {
          stepNumber: 5,
          elementId: 'dashboard-students',
          title: t('tDash_students_title'),
          description: t('tDash_students_desc'),
          position: 'right' as const,
        },
        {
          stepNumber: 6,
          elementId: 'dashboard-content-tabs',
          title: t('tDash_contentTabs_title'),
          description: t('tDash_contentTabs_desc'),
          position: 'bottom' as const,
        },
        {
          stepNumber: 7,
          elementId: 'dashboard-content-grid',
          title: t('tDash_contentGrid_title'),
          description: t('tDash_contentGrid_desc'),
          position: 'top' as const,
        },
      ])
    }, 800)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
