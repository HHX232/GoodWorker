'use client'

import { NavBar } from '@/widgets/BaseUI'
import { CreateImagesInput } from '@/shared/ui/inputs/CreateImagesInput/CreateImagesInput'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import styles from './FeedbackPage.module.scss'

interface FeedbackItem {
  id: string
  text: string
  status: string
  reply: string | null
  repliedAt: string | null
  createdAt: string
  photoUrl?: string | null
}

function parsePhotoUrls(raw?: string | null): string[] {
  if (!raw) return []
  if (raw.startsWith('[')) {
    try { return JSON.parse(raw) as string[] } catch { return [] }
  }
  return [raw]
}

function fmt(iso: string, locale: string) {
  const loc = locale === 'ru' ? 'ru' : locale === 'hi' ? 'hi' : locale === 'zh' ? 'zh' : 'en'
  return new Date(iso).toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const t = useTranslations('feedback')
  const locale = useLocale()
  const statusColors: Record<string, { color: string; bg: string }> = {
    pending:  { color: '#f59e0b', bg: '#fffbeb' },
    answered: { color: '#6366f1', bg: '#eef2ff' },
    resolved: { color: '#22c55e', bg: '#f0fdf4' },
    closed:   { color: '#868897', bg: '#f7f7f7' },
  }
  const statusLabels: Record<string, string> = {
    pending:  t('statusPending'),
    answered: t('statusAnswered'),
    resolved: t('statusResolved'),
    closed:   t('statusClosed'),
  }
  const cfg = statusColors[item.status] ?? statusColors.pending
  const label = statusLabels[item.status] ?? t('statusPending')

  const lines = item.text.split('\n')
  const subject = lines[0].startsWith('[') ? lines[0].slice(1, lines[0].indexOf(']')) : null
  const body = subject ? lines.slice(1).join('\n').trim() : item.text

  return (
    <div className={styles.card}>
      <div className={styles.card_top}>
        <div className={styles.card_meta}>
          {subject && <span className={styles.subject}>{subject}</span>}
          <span className={styles.date}>{fmt(item.createdAt, locale)}</span>
        </div>
        <span className={styles.status_badge} style={{ color: cfg.color, background: cfg.bg }}>{label}</span>
      </div>
      <p className={styles.card_text}>{body}</p>
      {parsePhotoUrls(item.photoUrl).map((url, i) => (
        <div key={i} className={styles.card_photo}>
          <Image src={url} alt={t('screenshotAlt')} width={320} height={200} className={styles.card_photo_img} />
        </div>
      ))}
      {item.reply && (
        <div className={styles.reply}>
          <span className={styles.reply_label}>{t('replyLabel')}</span>
          <p className={styles.reply_text}>{item.reply}</p>
          {item.repliedAt && <span className={styles.reply_date}>{fmt(item.repliedAt, locale)}</span>}
        </div>
      )}
    </div>
  )
}

export function FeedbackPage() {
  const t = useTranslations('feedback')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/feedback')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      let uploadedPhotoUrl: string | undefined
      if (photoFiles.length > 0) {
        const toBase64 = (file: File) => new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        const urls = await Promise.all(photoFiles.map(toBase64))
        uploadedPhotoUrl = urls.length === 1 ? urls[0] : JSON.stringify(urls)
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, text, photoUrl: uploadedPhotoUrl }),
      })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setItems(prev => [item, ...prev])
      setSubject('')
      setText('')
      setPhotoFiles([])
      setPhotoUrls([])
      setSent(true)
      setTimeout(() => setSent(false), 4000)
      toast.success(t('toastSuccess'))
    } catch {
      toast.error(t('toastError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`container default_content ${styles.page_wrap}`}>
      <NavBar />
      <div className={styles.content}>
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>{t('pageTitle')}</h1>
        </div>

        <div className={styles.form_card}>
          <p className={styles.form_desc}>{t('formDesc')}</p>

          <div className={styles.field}>
            <label className={styles.field_label}>
              {t('subjectLabel')} <span className={styles.optional}>{t('optional')}</span>
            </label>
            <input
              className={styles.input}
              type="text"
              placeholder={t('subjectPlaceholder')}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.field_label}>{t('messageLabel')}</label>
            <textarea
              className={styles.textarea}
              rows={5}
              placeholder={t('messagePlaceholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.field_label}>
              {t('screenshotLabel')} <span className={styles.optional}>{t('optional')}</span>
            </label>
            <CreateImagesInput
              maxFiles={10}
              activeImages={photoUrls}
              onFilesChange={setPhotoFiles}
              onActiveImagesChange={setPhotoUrls}
              allowedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
              showBigFirstItem={false}
              size="xs"
            />
          </div>

          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={sending || !text.trim()}
          >
            {sending ? t('sending') : t('submit')}
          </button>

          {sent && (
            <p className={styles.success_msg}>{t('successMsg')}</p>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className={styles.history}>
            <h2 className={styles.history_title}>{t('historyTitle')}</h2>
            <div className={styles.list}>
              {items.map(item => <FeedbackCard key={item.id} item={item} />)}
            </div>
          </div>
        )}

        {loading && (
          <div className={styles.list}>
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        )}
      </div>
    </div>
  )
}
