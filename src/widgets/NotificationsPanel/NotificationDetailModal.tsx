'use client'
import Link from 'next/link'
import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import {NotificationItem, TYPE_CONFIG, FALLBACK_CONFIG, relativeTime} from './RowNotification'
import styles from './NotificationDetailModal.module.scss'

// ─── Actor chip ───────────────────────────────────────────

function ActorChip({actorId, actorName, actorRole, color}: {
  actorId: string
  actorName: string
  actorRole?: string
  color: string
}) {
  const initials = actorName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <Link href={`/user/${actorId}`} className={styles.actor_chip}>
      <span className={styles.actor_avatar} style={{background: color + '22', color}}>
        {initials}
      </span>
      <span className={styles.actor_name}>{actorName}</span>
      {actorRole === 'STUDENT' && <span className={styles.actor_role}>ученик</span>}
      {actorRole === 'TEACHER' && <span className={styles.actor_role}>учитель</span>}
      <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke={color} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' style={{marginLeft: 'auto', flexShrink: 0}}>
        <path d='M5 12h14M12 5l7 7-7 7' />
      </svg>
    </Link>
  )
}

// ─── Single notification detail row ──────────────────────

export function DetailRow({item, onClick}: {item: NotificationItem; onClick?: () => void}) {
  const router = useRouter()
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
          <span className={styles.time}>{relativeTime(item.createdAt)}</span>
        </div>

        {item.type === 'SYSTEM' && payload.html
          ? <div className={styles.body} dangerouslySetInnerHTML={{__html: payload.html as string}} />
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
  const cfg = TYPE_CONFIG[notifications[0]?.type] ?? FALLBACK_CONFIG
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Auto-mark all as read when modal opens
  useEffect(() => {
    if (!isOpen) return
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id)
    if (unreadIds.length > 0) onMarkRead(unreadIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const title = notifications[0]?.title ?? 'Уведомления'

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
        <span className={styles.unread_badge}>{unreadCount} новых</span>
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
