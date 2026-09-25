'use client'

import { MAX_FILE_MB_RANGE, QUOTA_GB_RANGE } from '@/shared/lib/tutorFiles/constants'
import { formatBytes, initials } from '@/widgets/Files/lib'
import { FilesShell } from '@/widgets/Files/FilesShell/FilesShell'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import styles from './StorageAdminTab.module.scss'

interface AdminTutorRow {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  isVip: boolean
  isAdmin: boolean
  /** This owner's quota — admins have their own fixed one. */
  quotaBytes: number
  usedBytes: number
  files: number
  folders: number
}

interface AdminStorageResponse {
  settings: { quotaGb: number; maxFileMb: number }
  adminQuotaGb: number
  billingEnabled: boolean
  priceCentsPerGbMonth: number | null
  totals: { usedBytes: number; files: number; folders: number; tutors: number; overQuota: number; unindexed: number }
  tutors: AdminTutorRow[]
}

const QUERY_KEY = ['admin', 'storage']

/** Full-screen read-only library of one tutor — silent: reads via /api/admin/*, records nothing. */
function TutorLibraryOverlay({ tutor, onClose }: { tutor: AdminTutorRow; onClose: () => void }) {
  const t = useTranslations('admin')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted) return null
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={tutor.name}>
      <div className={styles.overlayBar}>
        <Eye size={16} />
        <span className={styles.overlayTitle}>{t('storageSilentView', { name: tutor.name })}</span>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label={t('storageClose')}><X size={18} /></button>
      </div>
      <div className={styles.overlayBody}>
        <FilesShell role="teacher" folderId={folderId} onNavigate={setFolderId} admin={{ teacherId: tutor.id, teacherName: tutor.name }} />
      </div>
    </div>,
    document.getElementById('modal_portal') ?? document.body,
  )
}

/**
 * Admin → Хранилище: the limits every VIP tutor gets (quota, per-file cap,
 * and the overage price in the Wallet build), platform totals, and every
 * tutor's usage with a silent read-only look into their library.
 */
export function StorageAdminTab() {
  const t = useTranslations('admin')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/admin/storage')
      if (!res.ok) throw new Error(String(res.status))
      return res.json() as Promise<AdminStorageResponse>
    },
  })
  const [quotaGb, setQuotaGb] = useState('')
  const [maxFileMb, setMaxFileMb] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing] = useState<AdminTutorRow | null>(null)
  const [filter, setFilter] = useState('')
  const [reindexing, setReindexing] = useState<number | null>(null)

  // Search inside files (idea 8): files uploaded before indexing existed get
  // their text extracted in batches of 20 until none are left.
  const reindex = async () => {
    setReindexing(data?.totals.unindexed ?? 0)
    try {
      for (let guard = 0; guard < 500; guard++) {
        const res = await fetch('/api/admin/storage/reindex', { method: 'POST' })
        if (!res.ok) throw new Error(String(res.status))
        const { processed, remaining } = await res.json() as { processed: number; remaining: number }
        setReindexing(remaining)
        if (remaining === 0 || processed === 0) break
      }
      toast.success(t('storageReindexDone'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('storageSaveError'))
    } finally {
      setReindexing(null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    }
  }

  useEffect(() => {
    if (!data) return
    setQuotaGb(String(data.settings.quotaGb))
    setMaxFileMb(String(data.settings.maxFileMb))
    setPrice(data.priceCentsPerGbMonth === null ? '' : (data.priceCentsPerGbMonth / 100).toFixed(2))
  }, [data])

  const save = async () => {
    const body: Record<string, number> = { quotaGb: Number(quotaGb), maxFileMb: Number(maxFileMb) }
    if (data?.billingEnabled) body.priceCentsPerGbMonth = Math.round(Number(price.replace(',', '.')) * 100)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/storage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? String(res.status))
      toast.success(t('storageSaved'))
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('storageSaveError'))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !data) return <div className={styles.loading}>{t('loading')}</div>

  const size = (b: number) => formatBytes(b, locale)
  const rows = data.tutors.filter(r => `${r.name} ${r.email}`.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div className={styles.tab}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('storageSettings')}</h2>
          <span className={styles.mode}>{data.billingEnabled ? t('storageModeBilling') : t('storageModeHard')}</span>
        </div>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('storageQuota')}</span>
            <span className={styles.inputWrap}>
              <input type="number" min={QUOTA_GB_RANGE.min} max={QUOTA_GB_RANGE.max} value={quotaGb} onChange={e => setQuotaGb(e.target.value)} />
              <span className={styles.unit}>GB</span>
            </span>
            <span className={styles.fieldHint}>{data.billingEnabled ? t('storageQuotaHintBilling') : t('storageQuotaHintHard')}</span>
            <span className={styles.fieldHint}>{t('storageAdminQuotaHint', { gb: data.adminQuotaGb })}</span>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('storageMaxFile')}</span>
            <span className={styles.inputWrap}>
              <input type="number" min={MAX_FILE_MB_RANGE.min} max={MAX_FILE_MB_RANGE.max} value={maxFileMb} onChange={e => setMaxFileMb(e.target.value)} />
              <span className={styles.unit}>MB</span>
            </span>
            <span className={styles.fieldHint}>{t('storageMaxFileHint', { max: MAX_FILE_MB_RANGE.max })}</span>
          </label>
          {data.billingEnabled && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('storagePrice')}</span>
              <span className={styles.inputWrap}>
                <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
                <span className={styles.unit}>$ / GB</span>
              </span>
              <span className={styles.fieldHint}>{t('storagePriceHint')}</span>
            </label>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.save} onClick={save} disabled={saving}>{t('storageSave')}</button>
        </div>
      </section>

      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statLabel}>{t('storageTotalUsed')}</span><span className={styles.statValue}>{size(data.totals.usedBytes)}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>{t('storageTutors')}</span><span className={styles.statValue}>{data.totals.tutors}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>{t('storageFiles')}</span><span className={styles.statValue}>{data.totals.files}</span><span className={styles.statSub}>{t('storageFoldersSub', { n: data.totals.folders })}</span></div>
        <div className={styles.stat}><span className={styles.statLabel}>{t('storageOverQuota')}</span><span className={`${styles.statValue} ${data.totals.overQuota ? styles.warn : ''}`}>{data.totals.overQuota}</span></div>
      </div>

      {(data.totals.unindexed > 0 || reindexing !== null) && (
        <section className={`${styles.card} ${styles.reindex}`}>
          <div>
            <h2 className={styles.cardTitle}>{t('storageReindexTitle')}</h2>
            <p className={styles.fieldHint}>{t('storageReindexHint')}</p>
          </div>
          <button type="button" className={styles.save} onClick={reindex} disabled={reindexing !== null}>
            {reindexing !== null ? t('storageReindexRunning', { n: reindexing }) : t('storageReindex', { n: data.totals.unindexed })}
          </button>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('storageTutorsTitle')}</h2>
          <input className={styles.filter} value={filter} onChange={e => setFilter(e.target.value)} placeholder={t('storageFilter')} />
        </div>
        {rows.length === 0 ? <p className={styles.empty}>{t('storageNoTutors')}</p> : (
          <div className={styles.table}>
            {rows.map(r => {
              const pct = Math.min(100, (r.usedBytes / r.quotaBytes) * 100)
              const over = r.usedBytes > r.quotaBytes
              return (
                <div key={r.id} className={styles.row}>
                  {r.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.avatarUrl} alt="" className={styles.avatar} />
                    : <span className={styles.avatar}>{initials(r.name)}</span>}
                  <span className={styles.who}>
                    <span className={styles.name}>{r.name} {r.isVip && <span className={styles.vip}>VIP</span>}{r.isAdmin && <span className={styles.adminBadge}>{t('storageAdminBadge')}</span>}</span>
                    <span className={styles.email}>{r.email}</span>
                  </span>
                  <span className={styles.usage}>
                    <span className={styles.usageText}>{size(r.usedBytes)} <span className={styles.muted}>/ {size(r.quotaBytes)}</span></span>
                    <span className={styles.bar}><span className={over ? styles.barOver : ''} style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className={styles.counts}>{t('storageCounts', { files: r.files, folders: r.folders })}</span>
                  <button type="button" className={styles.view} onClick={() => setViewing(r)}><Eye size={15} /> {t('storageView')}</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {viewing && <TutorLibraryOverlay tutor={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
