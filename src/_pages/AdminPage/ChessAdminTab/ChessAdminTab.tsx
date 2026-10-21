'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { badgeText } from '@/widgets/Chess/Progress'
import styles from '../StorageAdminTab/StorageAdminTab.module.scss'

type Settings = { vipRewards: Record<string, number>; allowed: string[]; maxDays: number }
const QUERY_KEY = ['admin', 'chess-settings']

/** Admin → Шахматы: days of VIP per chess badge (G25). Only points/streak badges are listed — the server refuses others. */
export function ChessAdminTab() {
  const t = useTranslations('chess.progress')
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/admin/chess/settings')
      if (!res.ok) throw new Error(String(res.status))
      return res.json() as Promise<Settings>
    },
  })
  const [days, setDays] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (data) setDays(Object.fromEntries(Object.entries(data.vipRewards).map(([c, d]) => [c, String(d)])))
  }, [data])

  if (!data) return <div className={styles.loading}>{t('admin_loading')}</div>

  const valid = (v: string) => /^\d+$/.test(v) && Number(v) <= data.maxDays
  const allValid = data.allowed.every((c) => valid(days[c] ?? ''))

  const save = async () => {
    setSaving(true)
    try {
      const vipRewards = Object.fromEntries(data.allowed.map((c) => [c, Number(days[c])]))
      const res = await fetch('/api/admin/chess/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vipRewards }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? String(res.status))
      toast.success(t('admin_saved'))
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    } catch {
      toast.error(t('admin_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.tab}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>{t('admin_vip_title')}</h2>
        </div>
        <p className={styles.fieldHint} style={{ margin: '0 0 16px', maxWidth: '72ch' }}>{t('admin_vip_hint')}</p>
        <div className={styles.fields}>
          {data.allowed.map((code) => {
            const b = badgeText(code)
            const v = days[code] ?? ''
            return (
              <label key={code} className={styles.field}>
                <span className={styles.fieldLabel}>{t(b.nameKey, b.values)}</span>
                <span className={styles.inputWrap}>
                  <input type="number" min={0} max={data.maxDays} step={1} value={v} aria-invalid={!valid(v)} onChange={(e) => setDays((d) => ({ ...d, [code]: e.target.value }))} />
                  <span className={styles.unit}>{t('admin_days')}</span>
                </span>
                <span className={styles.fieldHint}>{valid(v) ? t(b.hintKey, b.values) : t('admin_range', { max: data.maxDays })}</span>
              </label>
            )
          })}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.save} onClick={save} disabled={saving || !allValid}>{t('admin_save')}</button>
        </div>
      </section>
    </div>
  )
}
