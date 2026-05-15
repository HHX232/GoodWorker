'use client'

import OtpModal from '@/shared/ui/Modals/OtpModal/OtpModal'
import ImageCropEditor from '@/widgets/BaseUI/ImageCropEditor/ImageCropEditor'
import { BookmarksModal } from '@/widgets/Forms/ProfileEditForm/BookmarksModal'
import { TranscriptsModal } from '@/widgets/Forms/ProfileEditForm/TranscriptsModal'
import { DashboardCenter } from '@/widgets/Dashboard/DashboardCenter/DashboardCenter'
import { DashboardProfilePanel } from '@/widgets/Dashboard/DashboardProfilePanel/DashboardProfilePanel'
import { DashboardStudentSidebar } from '@/widgets/Dashboard/DashboardStudentSidebar/DashboardStudentSidebar'
import { FC, useRef, useState } from 'react'
import { useUpdateProfile } from '@/features/hooks/User/useUpdateProfile'
import styles from './TeacherDashboard.module.scss'

interface ProfileData {
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

interface Props {
  initialData: ProfileData
  statsId: string
  studentCount: number
  callCount: number
}

export const TeacherDashboard: FC<Props> = ({ initialData, statsId, studentCount, callCount }) => {
  const { mutateAsync: updateProfile } = useUpdateProfile('Teacher')

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
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error('Enter a valid email')
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
    alert('Email updated. Please sign in again.')
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
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'verify', otp, newPassword, userType: 'Teacher' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Invalid code')
    setNewPassword('')
  }

  return (
    <div className={styles.dashboard}>
      <DashboardStudentSidebar teacherId={statsId} />

      <DashboardCenter
        statsId={statsId}
        studentCount={studentCount}
        callCount={callCount}
      />

      <DashboardProfilePanel
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
        title="Change email"
        description="Enter your new email address. We'll send a confirmation code to it."
        onSendCode={handleSendEmailOtp}
        onVerify={handleVerifyEmailOtp}
        extraField={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New email</label>
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
        title="Change password"
        description="We'll send a confirmation code to your current email."
        onSendCode={handleSendPasswordOtp}
        onVerify={handleVerifyPasswordOtp}
        extraField={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A8A9A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New password</label>
            <input
              style={{ border: '1px solid #EBEBEB', borderRadius: '10px', padding: '9px 13px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }}
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
            />
          </div>
        }
      />
    </div>
  )
}
