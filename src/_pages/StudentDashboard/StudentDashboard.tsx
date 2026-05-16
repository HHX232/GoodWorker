'use client'

import OtpModal from '@/shared/ui/Modals/OtpModal/OtpModal'
import ImageCropEditor from '@/widgets/BaseUI/ImageCropEditor/ImageCropEditor'
import { BookmarksModal } from '@/widgets/Forms/ProfileEditForm/BookmarksModal'
import { TranscriptsModal } from '@/widgets/Forms/ProfileEditForm/TranscriptsModal'
import { StudentCenter } from '@/widgets/Dashboard/StudentCenter/StudentCenter'
import { StudentProfilePanel } from '@/widgets/Dashboard/StudentProfilePanel/StudentProfilePanel'
import { StudentStatsModal } from '@/widgets/Dashboard/StudentStatsModal/StudentStatsModal'
import { StudentTeachersSidebar } from '@/widgets/Dashboard/StudentTeachersSidebar/StudentTeachersSidebar'
import { useTranslations } from 'next-intl'
import { FC, useEffect, useRef, useState } from 'react'
import { useUpdateProfile } from '@/features/hooks/User/useUpdateProfile'
import styles from './StudentDashboard.module.scss'

interface ProfileData {
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

interface Teacher {
  id: string
  name: string
  avatarUrl: string | null
  initials: string
  avatarColor: string
  avatarTextColor: string
  subject: string
  linkedAt: string
}

interface RoadmapAccess {
  roadmapId: string
  roadmap: {
    id: string
    title: string
    previewImageUrl: string | null
    price: number
    teacher: { id: string; name: string; avatarUrl: string | null }
    _count: { comments: number; ratings: number }
  }
}

interface ServiceBooking {
  id: string
  status: string
  finalPrice: number
  createdAt: string
  service: {
    id: string
    title: string
    duration: number
    timeFrom: string
    timeTo: string
    price: number
    photoUrl: string | null
    category: { translations: { langCode: string; name: string }[] } | null
    teacher: { id: string; name: string; avatarUrl: string | null }
  }
}

interface PersonalService {
  id: string
  title: string
  description: string | null
  duration: number
  timeFrom: string
  timeTo: string
  price: number
  photoUrl: string | null
  teacher: { id: string; name: string; avatarUrl: string | null }
  category: { translations: { langCode: string; name: string }[] } | null
}

interface ProfileApiResponse {
  memberSince: string
  teacherCount: number
  callCount: number
  errorCount: number
  correctedCount: number
  teachers: Teacher[]
  roadmapAccess: RoadmapAccess[]
  serviceBookings: ServiceBooking[]
  personalServices: PersonalService[]
}

interface Props {
  initialData: ProfileData
}

export const StudentDashboard: FC<Props> = ({ initialData }) => {
  const t = useTranslations('dashboard')
  const { mutateAsync: updateProfile } = useUpdateProfile('Student')

  const [name, setName] = useState(initialData.name)
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl)
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
  const [statsOpen, setStatsOpen] = useState(false)

  const [profileData, setProfileData] = useState<ProfileApiResponse | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    fetch('/api/student/profile')
      .then(r => r.json())
      .then(d => { if (!d.error) setProfileData(d) })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
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
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || null, avatarUrl })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('saveErrorDefault'))
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error(t('invalidEmail'))
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'send', newEmail, userType: 'Student' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Ошибка отправки')
  }

  const handleVerifyEmailOtp = async (otp: string) => {
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', newEmail, otp, userType: 'Student' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Неверный код')
    alert(t('emailUpdated'))
    window.location.href = '/login'
  }

  const handleSendPasswordOtp = async () => {
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'send', userType: 'Student' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Ошибка отправки')
  }

  const handleVerifyPasswordOtp = async (otp: string) => {
    if (newPassword.length < 6) throw new Error(t('passwordMinLength'))
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', otp, newPassword, userType: 'Student' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Неверный код')
    setNewPassword('')
  }

  return (
    <div className={styles.dashboard}>
      <StudentTeachersSidebar
        teachers={profileData?.teachers ?? []}
        loading={profileLoading}
      />

      <StudentCenter
        teacherCount={profileData?.teacherCount ?? 0}
        callCount={profileData?.callCount ?? 0}
        errorCount={profileData?.errorCount ?? 0}
        roadmapAccess={profileData?.roadmapAccess ?? []}
        serviceBookings={profileData?.serviceBookings ?? []}
        personalServices={profileData?.personalServices ?? []}
        loading={profileLoading}
      />

      <StudentProfilePanel
        name={name}
        email={initialData.email}
        phone={phone}
        avatarUrl={avatarUrl}
        memberSince={profileData?.memberSince ?? new Date().toISOString()}
        errorCount={profileData?.errorCount ?? 0}
        correctedCount={profileData?.correctedCount ?? 0}
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
        onStats={() => setStatsOpen(true)}
      />

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleAvatarFileChange}
      />

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

      <TranscriptsModal isOpen={transcriptsOpen} onClose={() => setTranscriptsOpen(false)} />
      <BookmarksModal isOpen={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />
      <StudentStatsModal isOpen={statsOpen} onClose={() => setStatsOpen(false)} />

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
  )
}
