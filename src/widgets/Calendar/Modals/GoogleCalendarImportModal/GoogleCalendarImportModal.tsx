'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { CalendarEvent } from '@/shared/types/Calendar/calendar.types'
import styles from './GoogleCalendarImportModal.module.scss'

interface Props {
  isOpen: boolean
  onClose: () => void
  teacherId: string
  students: { id: string; name: string }[]
  onImported: (events: CalendarEvent[]) => void
}

type Step = 'idle' | 'connecting' | 'fetching' | 'classifying' | 'saving' | 'done' | 'error'

function Spinner({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 40 40' className={styles.spinner}>
      <circle cx='20' cy='20' r='16' fill='none' stroke='#E5E7EB' strokeWidth='3.5' />
      <circle cx='20' cy='20' r='16' fill='none' stroke='#534AB7' strokeWidth='3.5'
        strokeDasharray='60 40' strokeLinecap='round' />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='3' y='4' width='18' height='18' rx='2' />
      <path d='M16 2v4M8 2v4M3 10h18' />
    </svg>
  )
}

function IconAI() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z' />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='7' r='4' />
      <path d='M4 21c0-4 3.6-7 8-7s8 3 8 7' />
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M10.3 3.3L2 20h20L13.7 3.3a2 2 0 00-3.4 0z' />
      <path d='M12 10v4M12 17h.01' />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 16v-4M12 8h.01' />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='9' />
      <path d='M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20' />
    </svg>
  )
}

export function GoogleCalendarImportModal({ isOpen, onClose, teacherId, students, onImported }: Props) {
  const t = useTranslations('calendar.googleImport')
  const [step, setStep] = useState<Step>('idle')
  const [summary, setSummary] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState('')
  const popupRef = useRef<Window | null>(null)
  const tokenRef = useRef<string | null>(null)

  const STEP_LABELS: Record<Step, string> = {
    idle: '',
    connecting: t('labelConnect'),
    fetching: t('labelFetch'),
    classifying: t('labelClassify'),
    saving: t('labelSave'),
    done: '',
    error: '',
  }

  useEffect(() => {
    if (!isOpen) {
      setStep('idle')
      setSummary('')
      setError('')
      setImportedCount(0)
      tokenRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'GOOGLE_CAL_TOKEN' && e.data.token) {
        tokenRef.current = e.data.token
        popupRef.current?.close()
        runImport(e.data.token)
      }
      if (e.data?.type === 'GOOGLE_CAL_ERROR') {
        setStep('error')
        setError(e.data.message ?? 'Ошибка авторизации Google')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, teacherId])

  const handleConnect = async () => {
    setStep('connecting')
    setError('')
    try {
      const res = await fetch('/api/calendar/google/auth-url')
      const { url, error: err } = await res.json()
      if (err || !url) {
        setStep('error')
        setError(err ?? 'Не удалось получить ссылку авторизации. Проверьте GOOGLE_CALENDAR_CLIENT_ID.')
        return
      }
      const popup = window.open(url, 'google-cal-auth', 'width=520,height=640,left=200,top=100')
      popupRef.current = popup
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll)
          if (!tokenRef.current) setStep('idle')
        }
      }, 500)
    } catch {
      setStep('error')
      setError('Сетевая ошибка')
    }
  }

  const runImport = async (token: string) => {
    try {
      setStep('fetching')
      await sleep(400)

      setStep('classifying')
      const res = await fetch('/api/calendar/google/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          teacherId,
          students: students.map(s => s.name),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка классификации')

      setStep('saving')
      await sleep(300)

      const events: CalendarEvent[] = data.events ?? []
      onImported(events)
      setImportedCount(events.length)
      setSummary(data.summary ?? '')
      setStep('done')
    } catch (e: unknown) {
      setStep('error')
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    }
  }

  const isLoading = step === 'connecting' || step === 'fetching' || step === 'classifying' || step === 'saving'

  const modalTitle = (
    <div className={styles.modalTitle}>
      <span className={styles.eyebrow}>{t('eyebrow')}</span>
      <span className={styles.titleText}>{t('title')}</span>
    </div>
  )

  return (
    <ModalWindowDefault isOpen={isOpen} onClose={() => onClose()} additionalTitle={modalTitle}>
      <div className={styles.body}>
        {step === 'idle' && (
          <>
            <div className={styles.gcalLogoWrap}>
              <svg width='52' height='52' viewBox='0 0 52 52' fill='none'>
                <rect width='52' height='52' rx='12' fill='#fff' stroke='#E5E7EB' strokeWidth='1.5'/>
                <rect x='10' y='12' width='32' height='30' rx='3' fill='#fff' stroke='#D1D5DB' strokeWidth='1.5'/>
                <path d='M22 10v6M30 10v6M10 22h32' stroke='#9CA3AF' strokeWidth='1.5' strokeLinecap='round'/>
                <text x='26' y='38' textAnchor='middle' fontSize='14' fontWeight='800' fill='#4285F4' fontFamily='Arial, sans-serif'>G</text>
              </svg>
            </div>
            <p className={styles.desc}>{t('desc')}</p>
            <div className={styles.featureList}>
              <div className={styles.feature}><span className={styles.featureIconWrap}><IconCalendar /></span>{t('feat1')}</div>
              <div className={styles.feature}><span className={styles.featureIconWrap}><IconAI /></span>{t('feat2')}</div>
              <div className={styles.feature}><span className={styles.featureIconWrap}><IconUser /></span>{t('feat3')}</div>
              <div className={styles.feature}><span className={styles.featureIconWrap}><IconWarning /></span>{t('feat4')}</div>
            </div>
            <button className={styles.connectBtn} onClick={handleConnect}>
              <IconGlobe />
              {t('connectBtn')}
            </button>
          </>
        )}

        {isLoading && (
          <div className={styles.loadingWrap}>
            <Spinner size={52} />
            <p className={styles.loadingLabel}>{STEP_LABELS[step]}</p>
            <div className={styles.stepsList}>
              {(['fetching', 'classifying', 'saving'] as const).map(s => {
                const ORDER = ['fetching', 'classifying', 'saving'] as const
                const currentIdx = ORDER.indexOf(step as typeof ORDER[number])
                const thisIdx = ORDER.indexOf(s)
                const isActive = step === s
                const isDone = currentIdx > thisIdx
                return (
                  <div key={s} className={`${styles.stepItem} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}>
                    <span className={styles.stepDot} />
                    <span>{s === 'fetching' ? t('stepFetch') : s === 'classifying' ? t('stepAI') : t('stepSave')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className={styles.doneWrap}>
            <div className={styles.doneCheck}>
              <svg width='28' height='28' viewBox='0 0 24 24' fill='none'>
                <circle cx='12' cy='12' r='10' fill='#10B981'/>
                <path d='M7 12l3.5 3.5L17 8' stroke='#fff' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'/>
              </svg>
            </div>
            <p className={styles.doneTitle}>{t('doneTitle', { count: importedCount })}</p>
            {summary && (
              <div className={styles.summaryBox}>
                <div className={styles.summaryLabel}>
                  <IconInfo />
                  {t('summaryLabel')}
                </div>
                <p className={styles.summaryText}>{summary}</p>
              </div>
            )}
            <button className={styles.connectBtn} onClick={onClose}>{t('closeBtn')}</button>
          </div>
        )}

        {step === 'error' && (
          <div className={styles.errorWrap}>
            <div className={styles.errorIcon}>
              <svg width='28' height='28' viewBox='0 0 24 24' fill='none'>
                <circle cx='12' cy='12' r='10' fill='#EF4444'/>
                <path d='M12 8v4M12 16h.01' stroke='#fff' strokeWidth='2.2' strokeLinecap='round'/>
              </svg>
            </div>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.connectBtn} onClick={() => setStep('idle')}>{t('retryBtn')}</button>
          </div>
        )}
      </div>
    </ModalWindowDefault>
  )
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
