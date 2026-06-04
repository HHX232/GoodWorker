'use client'

import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useTutorial } from './TutorialContext'

const COOKIE_KEY = 'gw_tutorial_home'

function getCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

export function HomeTutorial() {
  const t = useTranslations('tutorial')
  const { data: session, status } = useSession()
  const { startTutorial } = useTutorial()

  const role = (session?.user as { role?: string })?.role

  function buildSteps() {
    if (role === 'TEACHER' || role === 'ADMIN') {
      return [
        {
          stepNumber: 1,
          elementId: 'navbar-create-group',
          title: t('teacher_create_title'),
          description: t('teacher_create_desc'),
          position: 'right' as const,
        },
        {
          stepNumber: 2,
          elementId: 'notifications-panel',
          title: t('teacher_notif_title'),
          description: t('teacher_notif_desc'),
          position: 'left' as const,
        },
      ]
    }

    if (role === 'STUDENT') {
      return [
        {
          stepNumber: 1,
          elementId: 'navbar-nav',
          title: t('student_nav_title'),
          description: t('student_nav_desc'),
          position: 'right' as const,
        },
        {
          stepNumber: 2,
          elementId: 'navbar-catalog',
          title: t('student_catalog_title'),
          description: t('student_catalog_desc'),
          position: 'right' as const,
        },
        {
          stepNumber: 3,
          elementId: 'navbar-tools',
          title: t('student_tools_title'),
          description: t('student_tools_desc'),
          position: 'right' as const,
        },
        {
          stepNumber: 4,
          elementId: 'notifications-panel',
          title: t('student_notif_title'),
          description: t('student_notif_desc'),
          position: 'left' as const,
        },
        {
          stepNumber: 5,
          elementId: 'posts-catalog',
          title: t('student_posts_title'),
          description: t('student_posts_desc'),
          position: 'right' as const,
        },
      ]
    }

    return [
      {
        stepNumber: 1,
        elementId: 'posts-catalog',
        title: t('guest_posts_title'),
        description: t('guest_posts_desc'),
        position: 'right' as const,
      },
      {
        stepNumber: 2,
        elementId: 'navbar-login',
        title: t('guest_login_title'),
        description: t('guest_login_desc'),
        position: 'right' as const,
      },
    ]
  }

  useEffect(() => {
    if (status === 'loading') return
    if (getCookie(COOKIE_KEY)) return

    const timer = setTimeout(() => {
      setCookie(COOKIE_KEY, '1')
      startTutorial(buildSteps())
    }, 600)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role])

  return null
}
