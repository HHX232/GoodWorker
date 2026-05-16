'use client'

import { NavBar } from '@/widgets/BaseUI'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './FeedbackPage.module.scss'

interface FeedbackItem {
  id: string
  text: string
  status: string
  reply: string | null
  repliedAt: string | null
  createdAt: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Ожидает',  color: '#f59e0b', bg: '#fffbeb' },
  answered: { label: 'Отвечено', color: '#6366f1', bg: '#eef2ff' },
  resolved: { label: 'Решено',   color: '#22c55e', bg: '#f0fdf4' },
  closed:   { label: 'Закрыто',  color: '#868897', bg: '#f7f7f7' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' })
}

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.pending
  const lines = item.text.split('\n')
  const subject = lines[0].startsWith('[') ? lines[0].slice(1, lines[0].indexOf(']')) : null
  const body = subject ? lines.slice(1).join('\n').trim() : item.text

  return (
    <div className={styles.card}>
      <div className={styles.card_top}>
        <div className={styles.card_meta}>
          {subject && <span className={styles.subject}>{subject}</span>}
          <span className={styles.date}>{fmt(item.createdAt)}</span>
        </div>
        <span className={styles.status_badge} style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      </div>
      <p className={styles.card_text}>{body}</p>
      {item.reply && (
        <div className={styles.reply}>
          <span className={styles.reply_label}>Ответ</span>
          <p className={styles.reply_text}>{item.reply}</p>
          {item.repliedAt && <span className={styles.reply_date}>{fmt(item.repliedAt)}</span>}
        </div>
      )}
    </div>
  )
}

export function FeedbackPage() {
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
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
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, text }),
      })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setItems(prev => [item, ...prev])
      setSubject('')
      setText('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
      toast.success('Отзыв отправлен!')
    } catch {
      toast.error('Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`container default_content ${styles.page_wrap}`}>
      <NavBar />
      <div className={styles.content}>
        <div className={styles.page_header}>
          <h1 className={styles.page_title}>Обратная связь</h1>
        </div>

        <div className={styles.form_card}>
          <p className={styles.form_desc}>
            Расскажите о вашем опыте, предложите улучшение или сообщите о проблеме.
            Мы рассматриваем каждое обращение.
          </p>

          <div className={styles.field}>
            <label className={styles.field_label}>Тема <span className={styles.optional}>(необязательно)</span></label>
            <input
              className={styles.input}
              type="text"
              placeholder="Например: проблема с видеозвонком"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.field_label}>Сообщение</label>
            <textarea
              className={styles.textarea}
              rows={5}
              placeholder="Опишите вашу проблему или предложение..."
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={sending}
            />
          </div>

          <button
            className={styles.submit_btn}
            onClick={handleSubmit}
            disabled={sending || !text.trim()}
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>

          {sent && (
            <p className={styles.success_msg}>
              Отзыв получен — мы рассмотрим его в ближайшее время.
            </p>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className={styles.history}>
            <h2 className={styles.history_title}>Ваши обращения</h2>
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
