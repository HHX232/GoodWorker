'use client'

import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { CalendarStudent } from '@/shared/types/Calendar/calendar.types'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './PaymentReminderModal.module.scss'

interface SummaryItem {
  id: string
  serviceTitle: string
  price: number
  currency: string
  date: string | null
  time: string | null
  paid: boolean
}

interface Summary {
  everyNLessons: number | null
  items: SummaryItem[]
  totals: { currency: string; amount: number }[]
  unpaidCount: number
}

type Tab = 'payment' | 'create'

const NAME_MAX = 30
function truncateName(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX)}…` : name
}

function StudentMiniHeader({ student }: { student: CalendarStudent }) {
  return (
    <div className={styles.studentHeader}>
      <div
        className={styles.studentAvatar}
        style={{ background: student.avatarColor, color: student.avatarTextColor }}
      >
        {student.initials}
      </div>
      <span className={styles.studentHeaderName}>{truncateName(student.name)}</span>
    </div>
  )
}

interface PaymentReminderModalProps {
  student: CalendarStudent | null
  onClose: () => void
  onCreateBooking: (studentId: string) => void
}

export function PaymentReminderModal({ student, onClose, onCreateBooking }: PaymentReminderModalProps) {
  const t = useTranslations('calendar.paymentReminder')
  const [tab, setTab] = useState<Tab>('payment')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [everyN, setEveryN] = useState('')
  const [savingSetting, setSavingSetting] = useState(false)

  const studentId = student?.id ?? null

  const load = useCallback(() => {
    if (!studentId) return
    setLoading(true)
    fetch(`/api/teacher/payment-reminder/summary?studentId=${studentId}`)
      .then(r => r.json())
      .then((d: Summary) => {
        setSummary(d)
        setEveryN(d.everyNLessons != null ? String(d.everyNLessons) : '')
      })
      .catch(() => toast.error(t('loadError')))
      .finally(() => setLoading(false))
  }, [studentId, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (student) setTab('payment') }, [student])

  if (!student) return null

  const saveSetting = async () => {
    setSavingSetting(true)
    try {
      const n = everyN.trim() ? parseInt(everyN, 10) : null
      const res = await fetch('/api/teacher/payment-reminder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, everyNLessons: n }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('settingSaved'))
      load()
    } catch {
      toast.error(t('settingSaveError'))
    } finally {
      setSavingSetting(false)
    }
  }

  const togglePaid = async (item: SummaryItem) => {
    setSummary(prev => prev && {
      ...prev,
      items: prev.items.map(i => i.id === item.id ? { ...i, paid: !i.paid } : i),
    })
    try {
      const res = await fetch('/api/teacher/payment-reminder/summary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: item.id, paid: !item.paid }),
      })
      if (!res.ok) throw new Error()
      load()
    } catch {
      toast.error(t('markPaidError'))
      load()
    }
  }

  return (
    <ModalWindowDefault isOpen={!!student} onClose={onClose} additionalTitle={<StudentMiniHeader student={student} />}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === 'payment' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('payment')}
        >
          {t('tabPayment')}
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'create' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('create')}
        >
          {t('tabCreateBooking')}
        </button>
      </div>

      {tab === 'payment' && (
        <div className={styles.body}>
          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>{t('settingLabel')}</label>
            <div className={styles.settingInputRow}>
              <input
                type="number"
                min={0}
                className={styles.settingInput}
                value={everyN}
                placeholder={t('settingPlaceholder')}
                onChange={(e) => setEveryN(e.target.value)}
              />
              <button className={styles.saveBtn} onClick={saveSetting} disabled={savingSetting}>
                {savingSetting ? t('saving') : t('save')}
              </button>
            </div>
            <p className={styles.settingHint}>{t('settingHint')}</p>
          </div>

          <div className={styles.divider} />

          {loading && <div className={styles.empty}>{t('loading')}</div>}

          {!loading && summary && summary.items.length === 0 && (
            <div className={styles.empty}>{t('noBookings')}</div>
          )}

          {!loading && summary && summary.items.length > 0 && (
            <div className={styles.list}>
              {summary.items.map(item => (
                <div key={item.id} className={`${styles.item} ${item.paid ? styles.itemPaid : ''}`}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemTitle}>{item.serviceTitle}</span>
                    <span className={styles.itemMeta}>
                      {[item.date, item.time].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className={styles.itemPrice}>{item.price.toLocaleString()} {item.currency}</span>
                  <button
                    className={`${styles.statusBtn} ${item.paid ? styles.statusPaid : styles.statusUnpaid}`}
                    onClick={() => togglePaid(item)}
                  >
                    {item.paid ? t('statusPaid') : t('statusUnpaid')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className={styles.body}>
          <p className={styles.createHint}>{t('createBookingHint', { name: truncateName(student.name) })}</p>
          <button className={styles.saveBtn} onClick={() => onCreateBooking(student.id)}>
            {t('createBookingBtn')}
          </button>
        </div>
      )}

      {tab === 'payment' && summary && summary.totals.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.totalLabel}>{t('totalOwed')}</span>
          <span className={styles.totalValue}>
            {summary.totals.map(t => `${t.amount.toLocaleString()} ${t.currency}`).join(' + ')}
          </span>
        </div>
      )}
    </ModalWindowDefault>
  )
}
