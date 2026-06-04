'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { useTutorial } from './TutorialContext'

const COOKIE_KEY = 'gw_tutorial_create_test'

function getCookie(name: string): string | undefined {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1]
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

// 0-based index of the step that waits for drag
const DRAG_STEP_INDEX = 13

export function CreateTestTutorial() {
  const t = useTranslations('tutorial')
  const { startTutorial, nextStep, currentStep, isPaused, isActive } = useTutorial()
  const listeningRef = useRef(false)

  function buildSteps() {
    return [
      { stepNumber: 1,  elementId: 'test-header',           title: t('ct_header_title'),  description: t('ct_header_desc'),   position: 'bottom' as const },
      { stepNumber: 2,  elementId: 'test-form-fields',      title: t('ct_form_title'),     description: t('ct_form_desc'),     position: 'right' as const  },
      { stepNumber: 3,  elementId: 'test-task-menu',        title: t('ct_menu_title'),     description: t('ct_menu_desc'),     position: 'left' as const   },
      { stepNumber: 4,  elementId: 'test-btn-choose-option',title: t('ct_choose_title'),   description: t('ct_choose_desc'),   position: 'left' as const   },
      { stepNumber: 5,  elementId: 'test-btn-free-answer',  title: t('ct_free_title'),     description: t('ct_free_desc'),     position: 'left' as const   },
      { stepNumber: 6,  elementId: 'test-btn-fill-text',    title: t('ct_fill_title'),     description: t('ct_fill_desc'),     position: 'left' as const   },
      { stepNumber: 7,  elementId: 'test-btn-match-pairs',  title: t('ct_match_title'),    description: t('ct_match_desc'),    position: 'left' as const   },
      { stepNumber: 8,  elementId: 'test-btn-sequence',     title: t('ct_sequence_title'), description: t('ct_sequence_desc'), position: 'left' as const   },
      { stepNumber: 9,  elementId: 'test-btn-highlight',    title: t('ct_highlight_title'),description: t('ct_highlight_desc'),position: 'left' as const   },
      { stepNumber: 10, elementId: 'test-btn-word-scramble',title: t('ct_scramble_title'), description: t('ct_scramble_desc'), position: 'left' as const   },
      { stepNumber: 11, elementId: 'test-btn-dialogue',     title: t('ct_dialogue_title'), description: t('ct_dialogue_desc'), position: 'left' as const   },
      { stepNumber: 12, elementId: 'test-btn-info-text',    title: t('ct_infoText_title'), description: t('ct_infoText_desc'), position: 'left' as const   },
      { stepNumber: 13, elementId: 'test-btn-info-media',   title: t('ct_infoMedia_title'),description: t('ct_infoMedia_desc'),position: 'left' as const   },
      { stepNumber: 14, elementId: 'test-btn-info-audio',   title: t('ct_infoAudio_title'),description: t('ct_infoAudio_desc'),position: 'left' as const   },
      { stepNumber: 15, elementId: 'test-canvas',           title: t('ct_drag_title'),     description: t('ct_drag_desc'),     position: 'right' as const, waitForAction: true },
      { stepNumber: 16, elementId: 'test-save-btn',         title: t('ct_save_title'),     description: t('ct_save_desc'),     position: 'top' as const    },
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

  // Advance past the drag step when a block is dropped
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

    window.addEventListener('test-block-dropped', handler, { once: true })
    return () => window.removeEventListener('test-block-dropped', handler)
  }, [isActive, isPaused, currentStep, nextStep])

  return null
}
