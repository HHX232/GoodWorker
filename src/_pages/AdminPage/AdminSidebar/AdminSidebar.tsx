'use client'

import {
  ArrowLeft, BadgeCheck, BarChart3, Bell, FileText, HardDrive, MessageSquareWarning, ShieldCheck, Users, Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ComponentType } from 'react'
import styles from './AdminSidebar.module.scss'

export type AdminTab = 'stats' | 'users' | 'content' | 'complaints' | 'promo' | 'storage' | 'notifications' | 'verifications' | 'admin-emails'

type Item = { key: AdminTab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }

/**
 * The admin's own navigation, in place of the site's left NavBar: sections
 * grouped by what they're about, the active one highlighted, and a way back to
 * the site. Collapses into a horizontal strip on narrow screens.
 */
export function AdminSidebar({ active, onSelect, badges = {} }: {
  active: AdminTab
  onSelect: (tab: AdminTab) => void
  /** Small counters next to an item (e.g. pending complaints). */
  badges?: Partial<Record<AdminTab, number>>
}) {
  const t = useTranslations('admin')
  const groups: { label: string; items: Item[] }[] = [
    { label: t('groupOverview'), items: [{ key: 'stats', label: t('tabStats'), icon: BarChart3 }] },
    {
      label: t('groupPeople'),
      items: [
        { key: 'users', label: t('tabUsers'), icon: Users },
        { key: 'verifications', label: t('tabVerifications'), icon: BadgeCheck },
        { key: 'admin-emails', label: t('tabAdminEmails'), icon: ShieldCheck },
      ],
    },
    {
      label: t('groupContent'),
      items: [
        { key: 'content', label: t('tabContent'), icon: FileText },
        { key: 'complaints', label: t('tabComplaints'), icon: MessageSquareWarning },
        { key: 'notifications', label: t('tabNotifications'), icon: Bell },
      ],
    },
    {
      label: t('groupPlatform'),
      items: [
        { key: 'promo', label: t('tabPromo'), icon: Wallet },
        { key: 'storage', label: t('tabStorage'), icon: HardDrive },
      ],
    },
  ]

  return (
    <nav className={styles.sidebar} aria-label={t('pageTitle')}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}><ShieldCheck size={16} /></span>
        <span className={styles.brandText}>{t('pageTitle')}</span>
      </div>
      {groups.map(g => (
        <div key={g.label} className={styles.group}>
          <div className={styles.groupLabel}>{g.label}</div>
          {g.items.map(item => (
            <button
              key={item.key}
              type="button"
              className={`${styles.item} ${active === item.key ? styles.itemActive : ''}`}
              onClick={() => onSelect(item.key)}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <item.icon size={17} strokeWidth={1.9} />
              <span className={styles.itemLabel}>{item.label}</span>
              {!!badges[item.key] && <span className={styles.badge}>{badges[item.key]}</span>}
            </button>
          ))}
        </div>
      ))}
      <Link href="/" className={styles.back}>
        <ArrowLeft size={16} /> {t('backToSite')}
      </Link>
    </nav>
  )
}
