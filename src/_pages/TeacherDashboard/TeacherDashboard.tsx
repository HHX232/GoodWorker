'use client'

import OtpModal from '@/shared/ui/Modals/OtpModal/OtpModal'
import { TeacherDashboardTutorial } from '@/widgets/Tutorial/TeacherDashboardTutorial'
import ImageCropEditor from '@/widgets/BaseUI/ImageCropEditor/ImageCropEditor'
import { BookmarksModal } from '@/widgets/Forms/ProfileEditForm/BookmarksModal'
import { TranscriptsModal } from '@/widgets/Forms/ProfileEditForm/TranscriptsModal'
import { DashboardCenter } from '@/widgets/Dashboard/DashboardCenter/DashboardCenter'
import { DashboardProfilePanel } from '@/widgets/Dashboard/DashboardProfilePanel/DashboardProfilePanel'
import { DashboardStudentSidebar } from '@/widgets/Dashboard/DashboardStudentSidebar/DashboardStudentSidebar'
import { useTranslations } from 'next-intl'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useUpdateProfile } from '@/features/hooks/User/useUpdateProfile'
import { toast } from 'sonner'
import styles from './TeacherDashboard.module.scss'

const LEFT_DEFAULT = 272
const RIGHT_DEFAULT = 296
const COL_MIN = 180
const COL_MAX = 860
const LS_KEY = 'dashboard-col-widths'

function loadWidths(): [number, number] {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (s) {
      const [l, r] = JSON.parse(s)
      return [Number(l) || LEFT_DEFAULT, Number(r) || RIGHT_DEFAULT]
    }
  } catch {}
  return [LEFT_DEFAULT, RIGHT_DEFAULT]
}

interface ProfileData {
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
  serviceLabels?: string[]
}

interface Props {
  initialData: ProfileData
  statsId: string
  studentCount: number
  callCount: number
}

export const TeacherDashboard: FC<Props> = ({ initialData, statsId, studentCount, callCount }) => {
  const t = useTranslations('dashboard')
  const { mutateAsync: updateProfile } = useUpdateProfile('Teacher')

  // ── Resizable columns ──────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)

  useEffect(() => {
    const [l, r] = loadWidths()
    setLeftWidth(l)
    setRightWidth(r)
  }, [])

  const widthsRef = useRef({ left: leftWidth, right: rightWidth })
  widthsRef.current = { left: leftWidth, right: rightWidth }

  const startResize = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startLeft = widthsRef.current.left
    const startRight = widthsRef.current.right

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      if (side === 'left') {
        setLeftWidth(Math.max(COL_MIN, Math.min(COL_MAX, startLeft + delta)))
      } else {
        setRightWidth(Math.max(COL_MIN, Math.min(COL_MAX, startRight - delta)))
      }
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem(LS_KEY, JSON.stringify([widthsRef.current.left, widthsRef.current.right]))
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const [name, setName] = useState(initialData.name)
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl)
  const [serviceLabels, setServiceLabels] = useState<string[]>(initialData.serviceLabels ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [transcriptsOpen, setTranscriptsOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)

  useEffect(() => {
    const header = document.querySelector('header') as HTMLElement | null
    if (!header) return
    header.style.marginBottom = '0'
    return () => { header.style.marginBottom = '' }
  }, [])

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropSrc(url)
    setCropOpen(true)
    e.target.value = ''
  }

  const handleCropSave = (croppedFile: File) => {
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(reader.result as string)
    reader.readAsDataURL(croppedFile)
    setCropOpen(false)
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    const tid = toast.loading(t('savingShort'))
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null, avatarUrl, serviceLabels })
      setSaveSuccess(true)
      toast.success(t('saveSuccessShort'), { id: tid })
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('saveErrorMsg')
      setSaveError(msg)
      toast.error(t('saveErrorMsg'), { id: tid })
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error(t('invalidEmail'))
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'send', newEmail, userType: 'Teacher' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
  }

  const handleVerifyEmailOtp = async (otp: string) => {
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', newEmail, otp, userType: 'Teacher' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Invalid code')
    toast.success(t('emailUpdated'))
    window.location.href = '/login'
  }

  const handleSendPasswordOtp = async () => {
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'send', userType: 'Teacher' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
  }

  const handleVerifyPasswordOtp = async (otp: string) => {
    if (newPassword.length < 6) throw new Error(t('passwordMinLength'))
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', otp, newPassword, userType: 'Teacher' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Invalid code')
    toast.success(t('passwordUpdated'))
    setNewPassword('')
  }

  return (
    <div
      className={styles.dashboard}
      style={{ gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px` }}
    >
      <TeacherDashboardTutorial />
      {/* Left resize handle */}
      <div className={styles.resizeHandle} style={{ left: leftWidth - 3 }} onMouseDown={startResize('left')} />
      {/* Right resize handle */}
      <div className={styles.resizeHandle} style={{ right: rightWidth - 3 }} onMouseDown={startResize('right')} />
      <div className={styles.colLeft}><DashboardStudentSidebar teacherId={statsId} /></div>

      <div className={styles.colCenter}><DashboardCenter
        statsId={statsId}
        studentCount={studentCount}
        callCount={callCount}
        isOwner={true}
        ownerName={name}
      /></div>

      <div className={styles.colRight}><DashboardProfilePanel
        name={name}
        email={initialData.email}
        phone={phone}
        avatarUrl={avatarUrl}
        statsId={statsId}
        saving={saving}
        saveError={saveError}
        saveSuccess={saveSuccess}
        avatarInputRef={avatarInputRef}
        onNameChange={setName}
        onPhoneChange={setPhone}
        onAvatarUploadClick={() => avatarInputRef.current?.click()}
        onAvatarRemove={() => setAvatarUrl(null)}
        onSave={handleSave}
        onChangeEmail={() => setEmailModalOpen(true)}
        onChangePassword={() => setPasswordModalOpen(true)}
        onTranscripts={() => setTranscriptsOpen(true)}
        onBookmarks={() => setBookmarksOpen(true)}
        serviceLabels={serviceLabels}
        onServiceLabelsChange={setServiceLabels}
      />

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleAvatarFileChange}
      />

      <TranscriptsModal isOpen={transcriptsOpen} onClose={() => setTranscriptsOpen(false)} />
      <BookmarksModal isOpen={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />

      {cropSrc && (
        <ImageCropEditor
          imageUrl={cropSrc}
          isOpen={cropOpen}
          onClose={() => { setCropOpen(false); if (cropSrc) URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
          onSave={handleCropSave}
          cropShape="circle"
          cropSize={300}
          aspectRatio={1}
        />
      )}

      <OtpModal
        isOpen={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setNewEmail('') }}
        title={t('changeEmailTitle')}
        description={t('changeEmailDesc')}
        onSendCode={handleSendEmailOtp}
        onVerify={handleVerifyEmailOtp}
        extraField={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('newEmail')}</label>
            <input
              style={{ border: '1px solid #EBEBEB', borderRadius: '10px', padding: '9px 13px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new@email.com"
            />
          </div>
        }
      />

      <OtpModal
        isOpen={passwordModalOpen}
        onClose={() => { setPasswordModalOpen(false); setNewPassword('') }}
        title={t('changePasswordTitle')}
        description={t('changePasswordDesc')}
        onSendCode={handleSendPasswordOtp}
        onVerify={handleVerifyPasswordOtp}
        extraField={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('newPassword')}</label>
            <input
              style={{ border: '1px solid #EBEBEB', borderRadius: '10px', padding: '9px 13px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
        }
      />
      </div>
    </div>
  )
}
