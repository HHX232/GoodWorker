'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './StorageAdminTab.module.scss'

interface Tariff {
  baseMinutes: number
  basePer5MinKopecks: number
  extraPer5MinKopecks: number
  aiMarkup: number
  aiInputPer1MKopecks: number
  aiOutputPer1MKopecks: number
  maxMinutesPerDay: number
}

type Labels = Record<'lectureTariff' | 'lectureTariffHint' | 'lectureModeNoWallet' | 'lectureBaseMinutes' | 'lectureBasePrice' | 'lectureExtraPrice' | 'lectureAiMarkup' | 'lectureAiMarkupHint' | 'lectureAiInput' | 'lectureAiOutput' | 'lectureDailyCap' | 'lectureDailyCapHint' | 'lectureUnitMin' | 'lectureMonth' | 'lectureUnitPer5Min', string>

interface Response {
  /** Card copy comes from the admin API, not messages/*.json (those reach every visitor). */
  labels: Labels
  settings: Tariff
  billingEnabled: boolean
  month: { lectures: number; minutes: number; costKopecks: number; promptTokens: number; completionTokens: number }
}

const QUERY_KEY = ['admin', 'lecture-settings']
const rub = (kopecks: number) => (kopecks / 100).toFixed(2)

type Field = { key: keyof Tariff; label: string; unit: string; money?: boolean; step?: string; hint?: string }

/** /lecture tariff (admin → Хранилище). The pricing mechanism is internal — its copy is served by the admin API only. */
export function LectureTariffCard() {
  const t = useTranslations('admin')
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: QUERY_KEY, queryFn: async () => (await fetch('/api/admin/lecture-settings')).json() as Promise<Response> })
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data?.settings) return
    const s = data.settings
    setForm({
      baseMinutes: String(s.baseMinutes),
      basePer5MinKopecks: rub(s.basePer5MinKopecks),
      extraPer5MinKopecks: rub(s.extraPer5MinKopecks),
      aiMarkup: String(s.aiMarkup),
      aiInputPer1MKopecks: rub(s.aiInputPer1MKopecks),
      aiOutputPer1MKopecks: rub(s.aiOutputPer1MKopecks),
      maxMinutesPerDay: String(s.maxMinutesPerDay),
    })
  }, [data])

  const L = data?.labels
  const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
  const fields: Field[] = !L ? [] : [
    { key: 'baseMinutes', label: L.lectureBaseMinutes, unit: L.lectureUnitMin },
    { key: 'basePer5MinKopecks', label: L.lectureBasePrice, unit: L.lectureUnitPer5Min, money: true, step: '0.01' },
    { key: 'extraPer5MinKopecks', label: L.lectureExtraPrice, unit: L.lectureUnitPer5Min, money: true, step: '0.01' },
    { key: 'aiMarkup', label: L.lectureAiMarkup, unit: '×', step: '0.1', hint: L.lectureAiMarkupHint },
    { key: 'aiInputPer1MKopecks', label: L.lectureAiInput, unit: '₽ / 1M', money: true, step: '0.01' },
    { key: 'aiOutputPer1MKopecks', label: L.lectureAiOutput, unit: '₽ / 1M', money: true, step: '0.01' },
    { key: 'maxMinutesPerDay', label: L.lectureDailyCap, unit: L.lectureUnitMin, hint: L.lectureDailyCapHint },
  ]

  const save = async () => {
    const body: Record<string, number> = {}
    for (const f of fields) {
      const n = Number((form[f.key] ?? '').replace(',', '.'))
      body[f.key] = f.money ? Math.round(n * 100) : f.key === 'aiMarkup' ? n : Math.round(n)
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/lecture-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? String(res.status))
      toast.success(t('storageSaved'))
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('storageSaveError'))
    } finally {
      setSaving(false)
    }
  }

  if (!data?.settings || !L) return null
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{L.lectureTariff}</h2>
        <span className={styles.mode}>{data.billingEnabled ? t('storageModeBilling') : L.lectureModeNoWallet}</span>
      </div>
      <p className={styles.fieldHint}>{L.lectureTariffHint}</p>
      <div className={styles.fields}>
        {fields.map(f => (
          <label key={f.key} className={styles.field}>
            <span className={styles.fieldLabel}>{f.label}</span>
            <span className={styles.inputWrap}>
              <input type="number" min={0} step={f.step ?? '1'} value={form[f.key] ?? ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
              <span className={styles.unit}>{f.unit}</span>
            </span>
            {f.hint && <span className={styles.fieldHint}>{f.hint}</span>}
          </label>
        ))}
      </div>
      <p className={styles.fieldHint}>
        {fill(L.lectureMonth, { lectures: data.month.lectures, minutes: data.month.minutes, cost: rub(data.month.costKopecks), tokens: data.month.promptTokens + data.month.completionTokens })}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.save} onClick={save} disabled={saving}>{t('storageSave')}</button>
      </div>
    </section>
  )
}
