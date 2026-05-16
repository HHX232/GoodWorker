'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { RefObject, useEffect, useRef, useState } from 'react'
import styles from './DashboardProfilePanel.module.scss'

const VideoRoom = dynamic(() => import('@/widgets/VideoRoom/VideoRoom'), { ssr: false })

// ─── ExpItem type ─────────────────────────────────────────

interface ExpItem {
  id: string
  title: string
  organization: string | null
  yearFrom: number
  yearTo: number | null
  description: string | null
  documentUrls: string[]
  verifiedAt: string | null
}

// ─── ExperienceSection ────────────────────────────────────

function ExperienceSection() {
  const [items, setItems] = useState<ExpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', organization: '', yearFrom: '', yearTo: '', description: '' })
  const docInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/teacher/experience')
      .then(r => r.json())
      .then(d => { if (d.experiences) setItems(d.experiences) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!form.title || !form.yearFrom) return
    setSaving(true)
    try {
      const res = await fetch('/api/teacher/experience', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, yearFrom: Number(form.yearFrom), yearTo: form.yearTo ? Number(form.yearTo) : null }),
      })
      const d = await res.json()
      if (d.experience) { setItems(p => [d.experience, ...p]); setShowForm(false); setForm({ title: '', organization: '', yearFrom: '', yearTo: '', description: '' }) }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/teacher/experience/${id}`, { method: 'DELETE' })
    setItems(p => p.filter(e => e.id !== id))
  }

  const handleDocUpload = (id: string) => {
    setUploadingId(id)
    docInputRef.current?.click()
  }

  const handleDocFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !uploadingId) return
    const item = items.find(i => i.id === uploadingId)
    if (!item) return
    const newUrls = await Promise.all(files.map(f => new Promise<string>((res) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.readAsDataURL(f)
    })))
    const merged = [...(item.documentUrls ?? []), ...newUrls]
    const resp = await fetch(`/api/teacher/experience/${uploadingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentUrls: merged }),
    })
    const d = await resp.json()
    if (d.experience) setItems(p => p.map(i => i.id === uploadingId ? d.experience : i))
    setUploadingId(null)
    e.target.value = ''
  }

  if (loading) return null
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section}>
        <div className={styles.expHeader}>
          <div className={styles.sectionLabel}>Опыт работы</div>
          <button className={styles.expAddBtn} onClick={() => setShowForm(p => !p)}>{showForm ? 'Отмена' : '+ Добавить'}</button>
        </div>
        {showForm && (
          <div className={styles.expForm}>
            <input className={styles.input} placeholder="Должность / специализация*" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className={styles.input} placeholder="Место работы / организация" value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
            <div className={styles.expYears}>
              <input className={styles.input} type="number" placeholder="Год начала*" value={form.yearFrom} onChange={e => setForm(p => ({ ...p, yearFrom: e.target.value }))} />
              <input className={styles.input} type="number" placeholder="Год конца (пусто = н.в.)" value={form.yearTo} onChange={e => setForm(p => ({ ...p, yearTo: e.target.value }))} />
            </div>
            <textarea className={styles.expTextarea} placeholder="Описание (необязательно)" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <button className={styles.saveBtn} onClick={handleAdd} disabled={saving || !form.title || !form.yearFrom}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        )}
        {items.length === 0 && !showForm && <p className={styles.expEmpty}>Опыт не добавлен</p>}
        <div className={styles.expList}>
          {items.map(item => (
            <div key={item.id} className={styles.expItem}>
              <div className={styles.expItemTop}>
                <div className={styles.expItemInfo}>
                  <span className={styles.expTitle}>{item.title}</span>
                  {item.organization && <span className={styles.expOrg}>{item.organization}</span>}
                  <span className={styles.expYearsLabel}>{item.yearFrom}–{item.yearTo ?? 'н.в.'}</span>
                </div>
                <div className={styles.expItemActions}>
                  {item.verifiedAt && (
                    <span className={styles.expVerifiedBadge} title={`Подтверждено ${new Date(item.verifiedAt).toLocaleDateString('ru')}`}>✓</span>
                  )}
                  <button className={styles.expDocBtn} onClick={() => handleDocUpload(item.id)} title="Прикрепить документы">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                    {item.documentUrls?.length > 0 ? item.documentUrls.length : ''}
                  </button>
                  <button className={styles.expDeleteBtn} onClick={() => handleDelete(item.id)}>×</button>
                </div>
              </div>
              {item.description && <p className={styles.expDesc}>{item.description}</p>}
            </div>
          ))}
        </div>
        <input ref={docInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleDocFiles} />
      </div>
    </>
  )
}

// ─── IdentitySection ──────────────────────────────────────

function IdentitySection() {
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetch('/api/teacher/identity')
      .then(r => r.json())
      .then(d => { setDocUrl(d.passportDocumentUrl ?? null); setConfirmed(d.pasportConfirmed ?? null) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const url = reader.result as string
      await fetch('/api/teacher/identity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportDocumentUrl: url }),
      })
      setDocUrl(url)
      setUploading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (loading) return null
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Подтверждение личности</div>
        <div className={styles.identityRow}>
          <div className={styles.identityStatus}>
            {!docUrl && <span className={styles.identityPending}>Паспорт не загружен</span>}
            {docUrl && !confirmed && <span className={styles.identityUploaded}>Паспорт загружен — на проверке</span>}
            {docUrl && confirmed && <span className={styles.identityConfirmed} title="Личность подтверждена администратором">✓ Личность подтверждена</span>}
          </div>
          <button className={styles.securityBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '…' : docUrl ? 'Заменить' : 'Загрузить'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </>
  )
}

interface Props {
  name: string
  email: string
  phone: string
  avatarUrl: string | null
  statsId: string
  saving: boolean
  saveError: string
  saveSuccess: boolean
  avatarInputRef: RefObject<HTMLInputElement | null>
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onAvatarUploadClick: () => void
  onAvatarRemove: () => void
  onSave: () => void
  onChangeEmail: () => void
  onChangePassword: () => void
  onTranscripts: () => void
  onBookmarks: () => void
}

export function DashboardProfilePanel({
  name, email, phone, avatarUrl, statsId,
  saving, saveError, saveSuccess,
  avatarInputRef,
  onNameChange, onPhoneChange,
  onAvatarUploadClick, onAvatarRemove,
  onSave,
  onChangeEmail, onChangePassword,
  onTranscripts, onBookmarks,
}: Props) {
  const t = useTranslations('dashboard')
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <aside className={styles.panel}>
      <div className={styles.scroll}>

        {/* Avatar hero */}
        <div className={styles.avatarHero}>
          <div className={styles.avatarWrap} onClick={onAvatarUploadClick}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <Image width={72} height={72} src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#ABABAB" strokeWidth="1.5" />
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#ABABAB" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div className={styles.avatarEditBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <div className={styles.heroName}>{name || t('yourName')}</div>
          <div className={styles.heroRole}>{t('teacher')}</div>
        </div>

        <div className={styles.divider} />

        {/* Basic info */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('basicInfo')}</div>
          <div className={styles.field}>
            <label className={styles.label}>{t('fullName')}</label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder={t('yourName')}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t('phone')}</label>
            <input
              className={styles.input}
              type="tel"
              value={phone}
              onChange={e => onPhoneChange(e.target.value)}
              placeholder="+7 999 000 00 00"
            />
          </div>
          <div className={styles.saveRow}>
            <button className={styles.saveBtn} onClick={onSave} disabled={saving}>
              {saving && <span className={styles.spinner} />}
              {saving ? t('saving') : t('saveChanges')}
            </button>
          </div>
          {saveError && <span className={styles.errorMsg}>{saveError}</span>}
          {saveSuccess && <span className={styles.successMsg}>{t('changesSaved')}</span>}
          {avatarUrl && (
            <button
              type="button"
              style={{
                fontSize: '12px', color: '#EF4444', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                padding: '0', textAlign: 'left',
              }}
              onClick={onAvatarRemove}
            >
              {t('removePhoto')}
            </button>
          )}
        </div>

        <ExperienceSection />

        <div className={styles.divider} />

        {/* Security */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('security')}</div>
          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>{t('email')}</span>
              <span className={styles.securityValue}>{email}</span>
            </div>
            <button className={styles.securityBtn} onClick={onChangeEmail}>{t('change')}</button>
          </div>
          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>{t('password')}</span>
              <span className={styles.securityValue}>••••••••</span>
            </div>
            <button className={styles.securityBtn} onClick={onChangePassword}>{t('change')}</button>
          </div>
        </div>

        <IdentitySection />

        <div className={styles.divider} />

        {/* Quick links */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('historyTools')}</div>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={onTranscripts}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </span>
              {t('callTranscripts')}
            </button>

            <button className={styles.actionBtn} onClick={onBookmarks}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </span>
              {t('bookmarks')}
            </button>

            <Link href={`/statistics/${statsId}`} className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              {t('statistics')}
            </Link>

            <Link href={`/calendar/${statsId}`} className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              {t('calendar')}
            </Link>

            <Link href="/complaints" className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              {t('complaintsLink')}
            </Link>

            <Link href="/notifications" className={styles.actionBtn}>
              <span className={styles.actionIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              {t('notificationsLink')}
            </Link>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Video room */}
        <div className={styles.section}>
          <button className={styles.videoToggle} onClick={() => setVideoOpen(v => !v)}>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14" />
                <rect x="1" y="6" width="14" height="12" rx="2" />
              </svg>
              {t('videoRoom')}
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`${styles.videoChevron} ${videoOpen ? styles.videoChevronOpen : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {videoOpen && <VideoRoom defaultName={name} />}
        </div>

      </div>
    </aside>
  )
}
