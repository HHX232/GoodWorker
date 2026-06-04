'use client'
import Link from 'next/link'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useLocale, useTranslations} from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {NotificationItem, TYPE_CONFIG, FALLBACK_CONFIG, relativeTime} from './RowNotification'
import styles from './NotificationDetailModal.module.scss'

// ─── Promo code card ──────────────────────────────────────

function PromoCodeCard({code, days}: {code: string; days?: number}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.promo_card}>
      <div className={styles.promo_header}>
        <span className={styles.promo_crown}>
          <svg width='12' height='12' viewBox='0 0 24 24' fill='currentColor'>
            <path d='M2 19h20l-2-10-5 5-3-8-3 8-5-5z' />
          </svg>
        </span>
        <span className={styles.promo_label}>Промокод VIP</span>
        {days && <span className={styles.promo_days}>{days} дней бесплатно</span>}
      </div>

      <div className={styles.promo_code_row}>
        <span className={styles.promo_code_text}>{code}</span>
        <button className={styles.promo_copy_btn} onClick={copy}>
          {copied ? (
            <>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
                <polyline points='20 6 9 17 4 12' />
              </svg>
              Скопировано
            </>
          ) : (
            <>
              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round'>
                <rect x='9' y='9' width='13' height='13' rx='2' /><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
              </svg>
              Копировать
            </>
          )}
        </button>
      </div>

      <Link href='/vip' className={styles.promo_activate_btn}>
        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
        </svg>
        Активировать VIP
      </Link>
    </div>
  )
}

// ─── Actor chip ───────────────────────────────────────────

function ActorChip({actorId, actorName, actorRole, color}: {
  actorId: string
  actorName: string
  actorRole?: string
  color: string
}) {
  const t = useTranslations('notifications')
  const initials = actorName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <Link href={`/user/${actorId}`} className={styles.actor_chip}>
      <span className={styles.actor_avatar} style={{background: color + '22', color}}>
        {initials}
      </span>
      <span className={styles.actor_name}>{actorName}</span>
      {actorRole === 'STUDENT' && <span className={styles.actor_role}>{t('roleStudent')}</span>}
      {actorRole === 'TEACHER' && <span className={styles.actor_role}>{t('roleTeacher')}</span>}
      <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' style={{marginLeft: 'auto', flexShrink: 0}}>
        <path d='M5 12h14M12 5l7 7-7 7' />
      </svg>
    </Link>
  )
}

// ─── Single notification detail row ──────────────────────

export function DetailRow({item, onClick}: {item: NotificationItem; onClick?: () => void}) {
  const router = useRouter()
  const locale = useLocale()
  const cfg = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG
  const payload = item.payload ?? {}
  const actorId = payload.actorId as string | undefined
  const actorName = payload.actorName as string | undefined
  const actorRole = payload.actorRole as string | undefined
  const href = cfg.getHref?.(payload) ?? null

  return (
    <div
      className={`${styles.detail_row} ${!item.isRead ? styles.unread : ''}`}
      style={{'--accent': cfg.color} as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.accent_bar} />

      <div className={styles.icon_wrap} style={{background: cfg.bg, color: cfg.color}}>
        {cfg.icon}
      </div>

      <div className={styles.content}>
        <div className={styles.top_row}>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.time}>{relativeTime(item.createdAt, locale)}</span>
        </div>

        {item.type === 'SYSTEM' && payload.promoCode
          ? (
            <>
              {item.body && <p className={styles.body}>{item.body}</p>}
              <PromoCodeCard
                code={payload.promoCode as string}
                days={payload.promoDays as number | undefined}
              />
            </>
          )
          : item.body && <p className={styles.body}>{item.body}</p>
        }

        {!cfg.hideActor && actorId && actorName && (
          <ActorChip actorId={actorId} actorName={actorName} actorRole={actorRole} color={cfg.color} />
        )}

        {cfg.actionLabel && href && (
          <button
            className={styles.action_btn}
            style={{color: cfg.color}}
            onClick={() => router.push(href)}
          >
            {cfg.actionLabel}
            <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M5 12h14M12 5l7 7-7 7' />
            </svg>
          </button>
        )}
      </div>

      {!item.isRead && (
        <div className={styles.unread_dot} style={{background: cfg.color}} />
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────

interface Props {
  notifications: NotificationItem[]
  isOpen: boolean
  onClose: () => void
  onMarkRead: (ids: string[]) => void
}

export function NotificationDetailModal({notifications, isOpen, onClose, onMarkRead}: Props) {
  const t = useTranslations('notifications')
  const cfg = TYPE_CONFIG[notifications[0]?.type] ?? FALLBACK_CONFIG
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Auto-mark all as read when modal opens
  useEffect(() => {
    if (!isOpen) return
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id)
    if (unreadIds.length > 0) onMarkRead(unreadIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const title = notifications[0]?.title ?? t('title')

  const header = (
    <div className={styles.modal_header}>
      <span className={styles.type_icon} style={{background: cfg.bg, color: cfg.color}}>
        {cfg.icon}
      </span>
      <span className={styles.header_title}>{title}</span>
      {notifications.length > 1 && (
        <span className={styles.total_badge}>{notifications.length}</span>
      )}
      {unreadCount > 0 && (
        <span className={styles.unread_badge}>{t('newBadge', {count: unreadCount})}</span>
      )}
    </div>
  )

  return (
    <ModalWindowDefault
      isOpen={isOpen}
      onClose={onClose}
      additionalTitle={header}
    >
      <div className={styles.list}>
        {notifications.map((item) => (
          <DetailRow key={item.id} item={item} />
        ))}
      </div>
    </ModalWindowDefault>
  )
}
