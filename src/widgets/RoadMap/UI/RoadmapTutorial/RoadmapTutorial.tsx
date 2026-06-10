'use client'

import { Panel } from '@xyflow/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import styles from './RoadmapTutorial.module.scss'

const STORAGE_KEY = 'roadmap_tutorial_seen'

interface RoadmapTutorialProps {
  canComplete: boolean
}

export default function RoadmapTutorial({ canComplete }: RoadmapTutorialProps) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('roadmapTutorial')

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      setOpen(true)
      localStorage.setItem(STORAGE_KEY, '1')
    }
  }, [])

  return (
    <Panel position='bottom-right' style={{ margin: '0 12px 12px 0' }}>
      <div className={styles.wrapper}>
        {open && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t('title')}</span>
              <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label='close'>
                <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                  <path d='M1 1l10 10M11 1L1 11' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
                </svg>
              </button>
            </div>

            <div className={styles.hints}>
              {/* Navigation — always visible */}
              <div className={styles.hint}>
                <div className={styles.hintIcon} style={{ justifyContent: 'center' }}>
                  <svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='#868897' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3' />
                    <circle cx='12' cy='12' r='3' />
                  </svg>
                </div>
                <div className={styles.hintText}>
                  <span className={styles.hintTitle}>{t('hint3Title')}</span>
                  <span className={styles.hintDesc}>{t('hint3Desc')}</span>
                </div>
              </div>

              {/* Completion hints — only for students */}
              {canComplete && (
                <>
                  <div className={styles.divider} />

                  <div className={styles.hint}>
                    <div className={styles.hintIcon}>
                      <NodePreview completed={false} />
                      <svg className={styles.arrow} width='14' height='14' viewBox='0 0 14 14' fill='none'>
                        <path d='M2 7h10M8 3l4 4-4 4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
                      </svg>
                      <NodePreview completed />
                    </div>
                    <div className={styles.hintText}>
                      <span className={styles.hintTitle}>{t('hint1Title')}</span>
                      <span className={styles.hintDesc}>{t('hint1Desc')}</span>
                    </div>
                  </div>

                  <div className={styles.hint}>
                    <div className={styles.hintIcon}>
                      <NodePreview completed />
                      <svg className={styles.arrow} width='14' height='14' viewBox='0 0 14 14' fill='none'>
                        <path d='M2 7h10M8 3l4 4-4 4' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
                      </svg>
                      <NodePreview completed={false} />
                    </div>
                    <div className={styles.hintText}>
                      <span className={styles.hintTitle}>{t('hint2Title')}</span>
                      <span className={styles.hintDesc}>{t('hint2Desc')}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button className={styles.dismissBtn} onClick={() => setOpen(false)}>
              {t('dismiss')}
            </button>
          </div>
        )}

        <button
          className={`${styles.helpBtn} ${open ? styles.helpBtnActive : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label='tutorial'
        >
          ?
        </button>
      </div>
    </Panel>
  )
}

function NodePreview({ completed }: { completed: boolean }) {
  return (
    <div className={`${styles.nodePreview} ${completed ? styles.nodePreviewDone : ''}`}>
      {completed && (
        <svg width='10' height='10' viewBox='0 0 12 12' fill='none'>
          <path d='M2 6l3 3 5-5' stroke='#16a34a' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      )}
    </div>
  )
}
