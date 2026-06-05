'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { CreateImagesInput } from '@/shared/ui/inputs/CreateImagesInput/CreateImagesInput'
import styles from './DashboardProfilePanel.module.scss'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'

const TG_MODAL_KEY = 'tg_welcome_shown'

// ─── Telegram SVG ─────────────────────────────────────────

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.997 12C21.997 17.5228 17.5198 22 11.997 22C6.47415 22 1.99699 17.5228 1.99699 12C1.99699 6.47715 6.47415 2 11.997 2C17.5198 2 21.997 6.47715 21.997 12ZM12.3553 9.38244C11.3827 9.787 9.43876 10.6243 6.52356 11.8944C6.05018 12.0827 5.8022 12.2669 5.77962 12.4469C5.74147 12.7513 6.12258 12.8711 6.64155 13.0343C6.71214 13.0565 6.78528 13.0795 6.86026 13.1038C7.37085 13.2698 8.05767 13.464 8.41472 13.4717C8.7386 13.4787 9.10009 13.3452 9.49918 13.0711C12.2229 11.2325 13.629 10.3032 13.7172 10.2831C13.7795 10.269 13.8658 10.2512 13.9243 10.3032C13.9828 10.3552 13.977 10.4536 13.9708 10.48C13.9331 10.641 12.4371 12.0318 11.6629 12.7515C11.4216 12.9759 11.2504 13.135 11.2154 13.1714C11.137 13.2528 11.0571 13.3298 10.9803 13.4038C10.506 13.8611 10.1502 14.204 11 14.764C11.4083 15.0331 11.7351 15.2556 12.0611 15.4776C12.4171 15.7201 12.7722 15.9619 13.2317 16.2631C13.3487 16.3398 13.4605 16.4195 13.5694 16.4971C13.9837 16.7925 14.3559 17.0579 14.8158 17.0155C15.083 16.991 15.359 16.7397 15.4992 15.9903C15.8305 14.2193 16.4817 10.382 16.6322 8.80081C16.6454 8.66228 16.6288 8.48498 16.6154 8.40715C16.6021 8.32932 16.5743 8.21842 16.4731 8.13633C16.3533 8.03911 16.1683 8.01861 16.0856 8.02C15.7095 8.0267 15.1324 8.22735 12.3553 9.38244Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── TelegramSection ──────────────────────────────────────

function TelegramSection({ linkTrigger = 0 }: { linkTrigger?: number }) {
  const t = useTranslations('dashboard')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTrigger = useRef(0)

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/telegram/link-token')
      const d = await r.json()
      setConnected(!!d.connected)
      return !!d.connected
    } catch {
      return false
    }
  }, [])

  const startLinkFlow = useCallback(async () => {
    setLinking(true)
    try {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' })
      const data = await res.json()
      if (data.deepLink) {
        window.open(data.deepLink, '_blank')
        pollRef.current = setInterval(async () => {
          const ok = await checkStatus()
          if (ok) { clearInterval(pollRef.current!); toast.success(t('tgLinked')) }
        }, 3000)
        setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current) }, 120_000)
      }
    } catch {
      toast.error(t('tgLinkError'))
    } finally {
      setLinking(false)
    }
  }, [checkStatus, t])

  useEffect(() => {
    checkStatus()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [checkStatus])

  useEffect(() => {
    if (linkTrigger > 0 && linkTrigger !== prevTrigger.current) {
      prevTrigger.current = linkTrigger
      startLinkFlow()
    }
  }, [linkTrigger, startLinkFlow])

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      await fetch('/api/telegram/link-token', { method: 'DELETE' })
      setConnected(false)
      toast.success(t('tgUnlinked'))
    } catch {
      toast.error(t('tgUnlinkError'))
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className={styles.section} id="dashboard-telegram">
      <div className={styles.sectionLabel}>{t('tgSection')}</div>
      <div className={styles.tgRow}>
        <div className={styles.tgLeft}>
          <span className={styles.tgIconWrap}><TelegramIcon size={15} /></span>
          <div className={styles.tgInfo}>
            <span className={styles.tgTitle}>Telegram</span>
            <span className={styles.tgStatus}>
              {connected === null ? t('tgChecking') : connected ? t('tgConnected') : t('tgNotConnected')}
            </span>
          </div>
        </div>
        {connected === false && (
          <button className={styles.tgLinkBtn} onClick={startLinkFlow} disabled={linking}>
            {linking ? t('tgLinking') : t('tgLink')}
          </button>
        )}
        {connected === true && (
          <button className={styles.tgUnlinkBtn} onClick={handleUnlink} disabled={unlinking}>
            {t('tgUnlink')}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── TelegramWelcomeModal ─────────────────────────────────

function TelegramWelcomeModal({ onClose, onLink }: { onClose: () => void; onLink: () => void }) {
  const t = useTranslations('dashboard')

  const handleLink = () => {
    onLink()
    onClose()
  }

  return (
    <div className={styles.tgModalOverlay} onClick={onClose}>
      <div className={styles.tgModal} onClick={e => e.stopPropagation()}>
        <button className={styles.tgModalClose} onClick={onClose} aria-label="close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className={styles.tgModalIcon}>
          <TelegramIcon size={32} />
        </div>
        <h3 className={styles.tgModalTitle}>{t('tgWelcomeTitle')}</h3>
        <p className={styles.tgModalDesc}>{t('tgWelcomeDesc')}</p>
        <button className={styles.tgModalBtn} onClick={handleLink}>
          <TelegramIcon size={15} />
          {t('tgWelcomeAction')}
        </button>
        <button className={styles.tgModalSkip} onClick={onClose}>{t('tgWelcomeSkip')}</button>
      </div>
    </div>
  )
}

// ─── PromoCodeSection ─────────────────────────────────────

function PromoCodeSection() {
  const t = useTranslations('dashboard')
  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setApplying(true)
    try {
      const res = await fetch('/api/activate-promocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgMap: Record<string, string> = {
          INVALID_PROMO: t('promoInvalid'),
          PROMO_EXPIRED: t('promoExpired'),
          PROMO_EXHAUSTED: t('promoExhausted'),
          ALREADY_USED: t('promoAlreadyUsed'),
        }
        toast.error(msgMap[data.error] ?? t('promoNetworkError'))
      } else {
        const until = new Date(data.vipUntil).toLocaleDateString()
        toast.success(t('promoSuccess', { date: until }))
        setCode('')
      }
    } catch {
      toast.error(t('promoNetworkError'))
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section} id="dashboard-promo">
        <div className={styles.sectionLabel}>{t('promoSection')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className={styles.input}
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder={t('promoInputPlaceholder')}
            maxLength={32}
            onKeyDown={e => e.key === 'Enter' && handleApply()}
          />
          <button
            className={styles.saveBtn}
            onClick={handleApply}
            disabled={applying || !code.trim()}
          >
            {applying ? t('promoApplying') : t('promoApplyBtn')}
          </button>
        </div>
      </div>
    </>
  )
}

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
  const t = useTranslations('dashboard')
  const [items, setItems] = useState<ExpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', organization: '', yearFrom: '', yearTo: '', description: '' })

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

  const handleExpFiles = async (id: string, files: File[], existingUrls: string[]) => {
    if (!files.length) return
    const newUrls = await Promise.all(files.map(f => new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(f)
    })))
    const merged = [...existingUrls, ...newUrls]
    const resp = await fetch(`/api/teacher/experience/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentUrls: merged }),
    })
    const d = await resp.json()
    if (d.experience) setItems(p => p.map(i => i.id === id ? d.experience : i))
  }

  const handleExpImagesChange = async (id: string, remainingUrls: string[]) => {
    const resp = await fetch(`/api/teacher/experience/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentUrls: remainingUrls }),
    })
    const d = await resp.json()
    if (d.experience) setItems(p => p.map(i => i.id === id ? d.experience : i))
  }

  if (loading) return null
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section}>
        <div className={styles.expHeader}>
          <div className={styles.sectionLabel}>{t('expSection')}</div>
          <button className={styles.expAddBtn} onClick={() => setShowForm(p => !p)}>{showForm ? t('expCancel') : t('expAdd')}</button>
        </div>
        {showForm && (
          <div className={styles.expForm}>
            <input className={styles.input} placeholder={t('expPositionPlaceholder')} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <input className={styles.input} placeholder={t('expOrgPlaceholder')} value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
            <div className={styles.expYears}>
              <input className={styles.input} type="number" placeholder={t('expYearFromPlaceholder')} value={form.yearFrom} onChange={e => setForm(p => ({ ...p, yearFrom: e.target.value }))} />
              <input className={styles.input} type="number" placeholder={t('expYearToPlaceholder')} value={form.yearTo} onChange={e => setForm(p => ({ ...p, yearTo: e.target.value }))} />
            </div>
            <textarea className={styles.expTextarea} placeholder={t('expDescPlaceholder')} rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <button className={styles.saveBtn} onClick={handleAdd} disabled={saving || !form.title || !form.yearFrom}>{saving ? t('expSaving') : t('expSave')}</button>
          </div>
        )}
        {items.length === 0 && !showForm && <p className={styles.expEmpty}>{t('expEmpty')}</p>}
        <div className={styles.expList}>
          {items.map(item => (
            <div key={item.id} className={styles.expItem}>
              <div className={styles.expItemTop}>
                <div className={styles.expItemInfo}>
                  <span className={styles.expTitle}>{item.title}</span>
                  {item.organization && <span className={styles.expOrg}>{item.organization}</span>}
                  <span className={styles.expYearsLabel}>{item.yearFrom}–{item.yearTo ?? t('expPresent')}</span>
                </div>
                <div className={styles.expItemActions}>
                  {item.verifiedAt && (
                    <span className={styles.expVerifiedBadge} title={`${new Date(item.verifiedAt).toLocaleDateString()}`}>✓</span>
                  )}
                  <button className={styles.expDeleteBtn} onClick={() => handleDelete(item.id)}>×</button>
                </div>
              </div>
              {item.description && <p className={styles.expDesc}>{item.description}</p>}
              <div className={styles.expDocs}>
                <CreateImagesInput
                  key={`${item.id}-${(item.documentUrls ?? []).length}`}
                  activeImages={item.documentUrls ?? []}
                  isOnlyShow={false}
                  onFilesChange={(files) => handleExpFiles(item.id, files, item.documentUrls ?? [])}
                  onActiveImagesChange={(urls) => handleExpImagesChange(item.id, urls)}
                  maxFiles={5}
                  size="xs"
                  showBigFirstItem={false}
                  allowMultipleFiles={true}
                  allowedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── IdentitySection ──────────────────────────────────────

function IdentitySection() {
  const t = useTranslations('dashboard')
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
        <div className={styles.sectionLabel}>{t('identitySection')}</div>
        <div className={styles.identityRow}>
          <div className={styles.identityStatus}>
            {!docUrl && <span className={styles.identityPending}>{t('identityNotUploaded')}</span>}
            {docUrl && !confirmed && <span className={styles.identityUploaded}>{t('identityUploaded')}</span>}
            {docUrl && confirmed && <span className={styles.identityConfirmed} title={t('identityConfirmedTooltip')}>{t('identityConfirmed')}</span>}
          </div>
          <button className={styles.securityBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '…' : docUrl ? t('identityReplace') : t('identityUpload')}
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
  const [tgModalOpen, setTgModalOpen] = useState(false)
  const [tgLinkTrigger, setTgLinkTrigger] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(TG_MODAL_KEY)) {
      const timer = setTimeout(() => setTgModalOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleTgModalClose = () => {
    setTgModalOpen(false)
    if (typeof window !== 'undefined') localStorage.setItem(TG_MODAL_KEY, '1')
  }

  const handleTgLink = () => {
    setTgLinkTrigger(n => n + 1)
    if (typeof window !== 'undefined') localStorage.setItem(TG_MODAL_KEY, '1')
  }

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

        {/* Row 1: Basic info (left) + Security (right) */}
        <div className={styles.contentGrid}>
          <div className={styles.gridCol}>
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
                <button type="button" className={styles.removeAvatarBtn} onClick={onAvatarRemove}>
                  {t('removePhoto')}
                </button>
              )}
            </div>
            <ExperienceSection />
          </div>

          <div className={styles.gridCol}>
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
          </div>
        </div>

        <div className={styles.divider} />

        {/* Row 2: Quick links (left) + Telegram + Promo (right) */}
        <div className={styles.contentGrid}>
          <div className={styles.gridCol}>
            <div className={styles.section} id="dashboard-history-tools">
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
          </div>

          <div className={styles.gridCol}>
            <TelegramSection linkTrigger={tgLinkTrigger} />
            <PromoCodeSection />
          </div>
        </div>

        <div className={styles.divider} />

        <button className={styles.logoutBtn} onClick={() => signOut({ callbackUrl: '/login' })}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('logout')}
        </button>

        {tgModalOpen && <TelegramWelcomeModal onClose={handleTgModalClose} onLink={handleTgLink} />}

      </div>
    </aside>
  )
}
