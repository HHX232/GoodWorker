'use client'

import { useQuery } from '@tanstack/react-query'
import { CrownIcon, FileCheck2Icon, MicIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatClock } from '../LectureWorkspace/format'
import { lectureRecorder } from '../recorder/lectureRecorder'
import { AiOrb } from '../ui/AiOrb'
import styles from './LectureHome.module.scss'

interface LectureListItem {
  id: string
  title: string
  status: 'RECORDING' | 'FINALIZING' | 'READY'
  recordedMs: number
  costKopecks: number
  fileId: string | null
  createdAt: string
  updatedAt: string
}

interface ListResponse {
  lectures: LectureListItem[]
  access: boolean
  sttConfigured: boolean
  isAdmin: boolean
}

/**
 * /lecture — one big button. The click creates the lecture AND starts the
 * microphone in the same user gesture (Safari needs that for the audio
 * context), then moves to /lecture/[id] while the recorder keeps running.
 */
export function LectureHome() {
  const t = useTranslations('lecture')
  const locale = useLocale()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [keepAudio, setKeepAudio] = useState(false)
  const [starting, setStarting] = useState(false)
  const list = useQuery({ queryKey: ['lectures'], queryFn: async () => (await fetch('/api/lecture')).json() as Promise<ListResponse> })
  const data = list.data

  const start = async () => {
    if (starting) return
    setStarting(true)
    try {
      const fallback = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date())
      const res = await fetch('/api/lecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() || t('defaultTitle', { date: fallback }), keepAudio }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'FAILED')
      const ok = await lectureRecorder.start(body.lecture.id, 0, 0)
      if (!ok) {
        const err = lectureRecorder.getState().error
        toast.error(err === 'MIC_DENIED' ? t('micDenied') : err === 'UNSUPPORTED' ? t('micUnsupported') : t('micFailed'))
      }
      router.push(`/lecture/${body.lecture.id}`)
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'VIP_REQUIRED' ? t('vipOnly') : t('createFailed'))
      setStarting(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/lecture/${id}`, { method: 'DELETE' })
    if (res.ok) list.refetch()
    else toast.error(t('deleteFailed'))
  }

  const blocked = !!data && (!data.access || !data.sttConfigured)

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <button type="button" className={styles.orbButton} onClick={start} disabled={starting || blocked || !data} aria-label={t('start')}>
          <AiOrb mode={starting ? 'listening' : 'idle'} size={260} label={t('start')} />
          <span className={styles.orbMic}><MicIcon size={30} /></span>
        </button>
        <h1 className={styles.title}>{t('homeTitle')}</h1>
        <p className={styles.subtitle}>{t('homeSubtitle')}</p>

        <div className={styles.form}>
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} maxLength={200} />
          <label className={styles.toggle}>
            <input type="checkbox" checked={keepAudio} onChange={e => setKeepAudio(e.target.checked)} />
            <span>{t('keepAudio')}<small>{t('keepAudioHint')}</small></span>
          </label>
          <button type="button" className={styles.start} onClick={start} disabled={starting || blocked || !data}>
            <MicIcon size={18} /> {starting ? t('starting') : t('start')}
          </button>
          {data && !data.access && (
            <Link href="/vip" className={styles.vip}><CrownIcon size={15} /> {t('vipRequiredLong')}</Link>
          )}
          {data?.access && !data.sttConfigured && <p className={styles.warn}>{t('sttNotConfigured')}</p>}
        </div>

        <ul className={styles.tips}>
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </section>

      <section className={styles.listSection}>
        <h2 className={styles.listTitle}>{t('myLectures')}</h2>
        {!data ? (
          <div className={styles.skeleton} />
        ) : data.lectures.length === 0 ? (
          <p className={styles.empty}>{t('noLectures')}</p>
        ) : (
          <ul className={styles.list}>
            {data.lectures.map(l => (
              <li key={l.id} className={styles.card}>
                <Link href={`/lecture/${l.id}`} className={styles.cardLink}>
                  <span className={styles.cardTitle}>{l.title || t('untitled')}</span>
                  <span className={styles.cardMeta}>
                    {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(l.createdAt))}
                    {' · '}{formatClock(l.recordedMs)}
                  </span>
                  <span className={styles.cardFoot}>
                    <span className={`${styles.chip} ${l.status === 'READY' ? styles.chipReady : l.status === 'FINALIZING' ? styles.chipBusy : ''}`}>
                      {l.status === 'READY' ? t('statusReady') : l.status === 'FINALIZING' ? t('statusFinalizing') : t('statusDraft')}
                    </span>
                    {l.fileId && <span className={styles.saved}><FileCheck2Icon size={13} /> {t('inFiles')}</span>}
                  </span>
                </Link>
                <button type="button" className={styles.del} onClick={() => remove(l.id)} aria-label={t('delete')}><Trash2Icon size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
