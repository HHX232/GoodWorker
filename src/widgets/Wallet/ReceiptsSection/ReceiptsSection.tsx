'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import ModalWindowDefault from '@/shared/ui/Modals/ModalWindowDefault/ModalWindowDefault'
import { formatCents } from '../useTopUpForm'
import styles from './ReceiptsSection.module.scss'

type ReceiptId = 'VIP_FEE' | 'PINNED_LISTING' | 'FEATURED_POSTS' | 'STORAGE'
type ReceiptStatus = 'ACTIVE' | 'ENDING_SOON' | 'INACTIVE' | 'FREE'

interface ReceiptLine {
  key: 'feeBase' | 'spentAi' | 'spentPinned' | 'spentStorage' | 'feeCredit' | 'purchase' | 'storageUsed' | 'storageOverage'
  count?: number
  months?: number
  at?: string
  amountCents: number
  credit?: boolean
}

interface Receipt {
  id: ReceiptId
  status: ReceiptStatus
  activeUntil: string | null
  periodStart: string | null
  periodEnd: string | null
  nextChargeAt: string | null
  lines: ReceiptLine[]
  totalCents: number
  totalKind: 'DUE' | 'PAID'
  history: { at: string; amountCents: number }[]
}

const LINES_SHOWN = 4
const TILE_CODE: Record<ReceiptId, string> = { VIP_FEE: 'VIP', PINNED_LISTING: 'TOP', FEATURED_POSTS: 'POST', STORAGE: 'GB' }
// Where the primary button scrolls to on this page (ids set in WalletPage).
const ACTION_TARGET: Partial<Record<ReceiptId, string>> = {
  VIP_FEE: 'wallet-topup',
  PINNED_LISTING: 'wallet-pinned',
  FEATURED_POSTS: 'wallet-featured',
}
// Lines that explain the fee but aren't part of its sum (feature spend).
const INFO_LINES = new Set<ReceiptLine['key']>(['spentAi', 'spentPinned', 'spentStorage', 'storageUsed'])

/**
 * Receipt-style cards for everything on /wallet that charges on a schedule
 * or runs for a paid period (GET /api/wallet/receipts): monthly VIP fee,
 * pinned listing, featured posts, storage overage.
 */
export function ReceiptsSection({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations('wallet.receipts')
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [openId, setOpenId] = useState<ReceiptId | null>(null)

  useEffect(() => {
    fetch('/api/wallet/receipts')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setReceipts(d.receipts) })
      .catch(() => {})
  }, [refreshKey])

  if (!receipts) return null
  const open = receipts.find(r => r.id === openId) ?? null

  return (
    <section className={styles.section}>
      <p className={styles.sectionLabel}>{t('title')}</p>
      <div className={styles.grid}>
        {receipts.map(r => <ReceiptCard key={r.id} receipt={r} onDetails={() => setOpenId(r.id)} />)}
      </div>

      <ModalWindowDefault isOpen={open !== null} onClose={() => setOpenId(null)} additionalTitle={open ? t(`names.${open.id}`) : ''}>
        {open && <ReceiptDetails receipt={open} />}
      </ModalWindowDefault>
    </section>
  )
}

function useFormatters() {
  const t = useTranslations('wallet.receipts')
  const locale = useLocale()
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''
  const lineName = (l: ReceiptLine) => {
    if (l.key === 'purchase') {
      const base = l.months ? t('lines.purchaseMonths', { months: l.months }) : t('lines.purchase')
      return l.at ? `${base} · ${fmtDate(l.at)}` : base
    }
    if (l.key === 'storageUsed') return t('lines.storageUsed', { gb: l.count ?? 0 })
    return t(`lines.${l.key}`)
  }
  const lineQty = (l: ReceiptLine) => {
    if (l.key === 'storageOverage') return t('gb', { count: l.count ?? 0 })
    if (l.key === 'storageUsed' || l.key === 'feeCredit') return '—'
    return String(l.count ?? 1)
  }
  const lineAmount = (l: ReceiptLine) => (l.key === 'storageUsed' ? '—' : `${l.credit ? '−' : ''}${formatCents(l.amountCents)}`)
  return { t, fmtDate, lineName, lineQty, lineAmount }
}

function statusNote(r: Receipt, t: ReturnType<typeof useTranslations>, fmtDate: (iso: string | null) => string): string {
  if (r.status === 'INACTIVE') return t('notes.inactive')
  if (r.status === 'FREE') return t('notes.free')
  if (r.nextChargeAt) return t('notes.chargeOn', { date: fmtDate(r.nextChargeAt) })
  return t('notes.until', { date: fmtDate(r.activeUntil) })
}

function ReceiptCard({ receipt: r, onDetails }: { receipt: Receipt; onDetails: () => void }) {
  const { t, fmtDate, lineName, lineQty, lineAmount } = useFormatters()
  const shown = r.lines.slice(0, LINES_SHOWN)
  const hidden = r.lines.length - shown.length
  const target = ACTION_TARGET[r.id]
  const actionLabel = r.id === 'VIP_FEE'
    ? (r.status === 'INACTIVE' ? t('actions.getVip') : t('actions.topUp'))
    : (r.status === 'INACTIVE' ? t('actions.connect') : t('actions.extend'))

  const dateLine = r.periodStart && r.periodEnd
    ? `${fmtDate(r.periodStart)} — ${fmtDate(r.periodEnd)}`
    : r.activeUntil && r.status !== 'INACTIVE'
      ? t('activeUntil', { date: fmtDate(r.activeUntil) })
      : null

  return (
    <article className={styles.card} data-status={r.status}>
      <header className={styles.head}>
        <div className={styles.tile} data-kind={r.id}>{TILE_CODE[r.id]}</div>
        <div className={styles.headText}>
          <p className={styles.name}>{t(`names.${r.id}`)}</p>
          <p className={styles.sub}>{t(`subtitles.${r.id}`)}</p>
        </div>
        <div className={styles.statusCol}>
          <span className={styles.pill} data-status={r.status}>{t(`status.${r.status}`)}</span>
          <span className={styles.note}>{statusNote(r, t, fmtDate)}</span>
        </div>
      </header>

      {dateLine && <div className={styles.dateRow}>{dateLine}</div>}

      <div className={styles.table}>
        <div className={styles.thead}>
          <span>{t('cols.item')}</span>
          <span>{t('cols.qty')}</span>
          <span>{t('cols.sum')}</span>
        </div>
        {shown.length === 0 ? (
          <p className={styles.empty}>{t('empty')}</p>
        ) : (
          shown.map((l, i) => (
            <div key={i} className={`${styles.row} ${INFO_LINES.has(l.key) ? styles.rowInfo : ''} ${l.credit ? styles.rowCredit : ''}`}>
              <span className={styles.itemName}>{lineName(l)}</span>
              <span>{lineQty(l)}</span>
              <span>{lineAmount(l)}</span>
            </div>
          ))
        )}
        {hidden > 0 && <p className={styles.more}>{t('more', { count: hidden })}</p>}
      </div>

      <div className={styles.totalRow}>
        <span>{r.totalKind === 'DUE' ? t('totalDue') : t('totalPaid')}</span>
        <strong>{formatCents(r.totalCents)}</strong>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={onDetails}>{t('actions.details')}</button>
        {target && (
          r.id === 'VIP_FEE' && r.status === 'INACTIVE' ? (
            <a href="/vip" className={styles.primaryBtn}>{actionLabel}</a>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            >
              {actionLabel}
            </button>
          )
        )}
      </div>
    </article>
  )
}

function ReceiptDetails({ receipt: r }: { receipt: Receipt }) {
  const { t, fmtDate, lineName, lineQty, lineAmount } = useFormatters()
  return (
    <div className={styles.details}>
      <p className={styles.detailsHint}>{t(`hints.${r.id}`)}</p>

      <div className={styles.table}>
        <div className={styles.thead}>
          <span>{t('cols.item')}</span>
          <span>{t('cols.qty')}</span>
          <span>{t('cols.sum')}</span>
        </div>
        {r.lines.length === 0 ? (
          <p className={styles.empty}>{t('empty')}</p>
        ) : (
          r.lines.map((l, i) => (
            <div key={i} className={`${styles.row} ${INFO_LINES.has(l.key) ? styles.rowInfo : ''} ${l.credit ? styles.rowCredit : ''}`}>
              <span className={styles.itemName}>{lineName(l)}</span>
              <span>{lineQty(l)}</span>
              <span>{lineAmount(l)}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles.totalRow}>
        <span>{r.totalKind === 'DUE' ? t('totalDue') : t('totalPaid')}</span>
        <strong>{formatCents(r.totalCents)}</strong>
      </div>

      {r.history.length > 0 && (
        <div className={styles.history}>
          <p className={styles.historyTitle}>{t('historyTitle')}</p>
          {r.history.map((h, i) => (
            <div key={i} className={styles.historyRow}>
              <span>{fmtDate(h.at)}</span>
              <span>−{formatCents(h.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
