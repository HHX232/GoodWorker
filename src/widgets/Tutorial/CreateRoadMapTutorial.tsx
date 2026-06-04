'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { useTutorial } from './TutorialContext'

const COOKIE_KEY = 'gw_tutorial_create_roadmap'

function getCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

// Step index (0-based) that waits for the user to drag a block
const DRAG_STEP_INDEX = 10

export function CreateRoadMapTutorial() {
  const t = useTranslations('tutorial')
  const { startTutorial, nextStep, currentStep, isPaused, isActive } = useTutorial()
  const listeningRef = useRef(false)

  function buildSteps() {
    return [
      // 1 — whole navbar
      { stepNumber: 1, elementId: 'roadmap-navbar', title: t('crm_navbar_title'), description: t('crm_navbar_desc'), position: 'right' as const },
      // 2-9 — individual block buttons
      { stepNumber: 2, elementId: 'roadmap-btn-info-text', title: t('crm_infoText_title'), description: t('crm_infoText_desc'), position: 'right' as const },
      { stepNumber: 3, elementId: 'roadmap-btn-media', title: t('crm_media_title'), description: t('crm_media_desc'), position: 'right' as const },
      { stepNumber: 4, elementId: 'roadmap-btn-audio', title: t('crm_audio_title'), description: t('crm_audio_desc'), position: 'right' as const },
      { stepNumber: 5, elementId: 'roadmap-btn-active-test', title: t('crm_activeTest_title'), description: t('crm_activeTest_desc'), position: 'right' as const },
      { stepNumber: 6, elementId: 'roadmap-btn-test-link', title: t('crm_testLink_title'), description: t('crm_testLink_desc'), position: 'right' as const },
      { stepNumber: 7, elementId: 'roadmap-btn-posts', title: t('crm_posts_title'), description: t('crm_posts_desc'), position: 'right' as const },
      { stepNumber: 8, elementId: 'roadmap-btn-files', title: t('crm_files_title'), description: t('crm_files_desc'), position: 'right' as const },
      { stepNumber: 9, elementId: 'roadmap-btn-comment', title: t('crm_comment_title'), description: t('crm_comment_desc'), position: 'right' as const },
      { stepNumber: 10, elementId: 'roadmap-btn-divider', title: t('crm_divider_title'), description: t('crm_divider_desc'), position: 'right' as const },
      // 11 — wait for drag
      { stepNumber: 11, elementId: 'roadmap-canvas', title: t('crm_drag_title'), description: t('crm_drag_desc'), position: 'right' as const, waitForAction: true },
      // 12 — panel
      { stepNumber: 12, elementId: 'roadmap-panel', title: t('crm_panel_title'), description: t('crm_panel_desc'), position: 'bottom' as const },
      // 13 — canvas
      { stepNumber: 13, elementId: 'roadmap-canvas', title: t('crm_canvas_title'), description: t('crm_canvas_desc'), position: 'right' as const },
    ]
  }

  // Auto-start once
  useEffect(() => {
    if (getCookie(COOKIE_KEY)) return

    const timer = setTimeout(() => {
      setCookie(COOKIE_KEY, '1')
      startTutorial(buildSteps())
    }, 800)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for block drop — advance past the drag step automatically
  useEffect(() => {
    if (!isActive || !isPaused) {
      listeningRef.current = false
      return
    }
    if (currentStep !== DRAG_STEP_INDEX) return
    if (listeningRef.current) return

    listeningRef.current = true

    const handler = () => {
      listeningRef.current = false
      nextStep()
    }

    window.addEventListener('roadmap-block-dropped', handler, { once: true })
    return () => window.removeEventListener('roadmap-block-dropped', handler)
  }, [isActive, isPaused, currentStep, nextStep])

  return null
}
