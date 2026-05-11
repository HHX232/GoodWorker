'use client'

import OtpModal from '@/shared/ui/Modals/OtpModal/OtpModal'
import ImageCropEditor from '@/widgets/BaseUI/ImageCropEditor/ImageCropEditor'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {FC, useRef, useState} from 'react'
import styles from './ProfileEditForm.module.scss'
import {useUpdateProfile} from '@/features/hooks/User/useUpdateProfile'

const VideoRoom = dynamic(() => import('@/widgets/VideoRoom/VideoRoom'), {ssr: false})

type UserType = 'Student' | 'Teacher'

interface ProfileData {
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

interface ProfileEditFormProps {
  userType: UserType
  initialData: ProfileData
}

const ProfileEditForm: FC<ProfileEditFormProps> = ({userType, initialData}) => {
  const {mutateAsync: updateProfile} = useUpdateProfile(userType)

  const [name, setName] = useState(initialData.name)
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

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
      await updateProfile({name: name.trim(), phone: phone.trim() || null, avatarUrl})
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSendEmailOtp = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error('Enter a valid email')
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({step: 'send', newEmail, userType}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
  }

  const handleVerifyEmailOtp = async (otp: string) => {
    const res = await fetch('/api/profile/edit/change-email', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({step: 'verify', newEmail, otp, userType}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Invalid code')
    alert('Email updated. Please sign in again.')
    window.location.href = '/login'
  }

  const handleSendPasswordOtp = async () => {
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({step: 'send', userType}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to send code')
  }

  const handleVerifyPasswordOtp = async (otp: string) => {
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({step: 'verify', otp, newPassword, userType}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Invalid code')
    setNewPassword('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Profile info ── */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>Edit profile</div>

          <div className={styles.avatarRow}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <Image width={88} height={88} src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="#999" strokeWidth="1.5"/>
                    <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>

            <div className={styles.avatarInfo}>
              <p className={styles.avatarName}>{name || 'Your name'}</p>
              <p className={styles.avatarRole}>{userType === 'Teacher' ? 'Teacher' : 'Student'}</p>
              <div className={styles.avatarBtns}>
                <button type="button" className={styles.avatarBtn} onClick={() => avatarInputRef.current?.click()}>
                  {avatarUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {avatarUrl && (
                  <button type="button" className={styles.avatarBtnDanger} onClick={() => setAvatarUrl(null)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            style={{display: 'none'}}
            onChange={handleAvatarFileChange}
          />

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone</label>
              <input
                className={styles.input}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 000 00 00"
              />
            </div>
          </div>

          <div className={styles.saveRow}>
            <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <span className={styles.spinner} /> : null}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {saveError && <span className={styles.errorMsg}>{saveError}</span>}
            {saveSuccess && <span className={styles.successMsg}>Changes saved!</span>}
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Security ── */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>Security</div>

          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>Email</span>
              <span className={styles.securityValue}>{initialData.email}</span>
            </div>
            <button type="button" className={styles.securityBtn} onClick={() => setEmailModalOpen(true)}>
              Change
            </button>
          </div>

          <div className={styles.securityRow}>
            <div className={styles.securityInfo}>
              <span className={styles.securityLabel}>Password</span>
              <span className={styles.securityValue}>••••••••</span>
            </div>
            <button type="button" className={styles.securityBtn} onClick={() => setPasswordModalOpen(true)}>
              Change
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Video room ── */}
        <VideoRoom defaultName={name} />

      </div>

      {cropSrc && (
        <ImageCropEditor
          imageUrl={cropSrc}
          isOpen={cropOpen}
          onClose={() => {
            setCropOpen(false)
            if (cropSrc) URL.revokeObjectURL(cropSrc)
            setCropSrc(null)
          }}
          onSave={handleCropSave}
          cropShape="circle"
          cropSize={300}
          aspectRatio={1}
        />
      )}

      <OtpModal
        isOpen={emailModalOpen}
        onClose={() => {setEmailModalOpen(false); setNewEmail('')}}
        title="Change email"
        description="Enter your new email address. We'll send a confirmation code to it."
        onSendCode={handleSendEmailOtp}
        onVerify={handleVerifyEmailOtp}
        extraField={
          <div className={styles.field}>
            <label className={styles.label}>New email</label>
            <input
              className={styles.input}
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@email.com"
            />
          </div>
        }
      />

      <OtpModal
        isOpen={passwordModalOpen}
        onClose={() => {setPasswordModalOpen(false); setNewPassword('')}}
        title="Change password"
        description="We'll send a confirmation code to your current email."
        onSendCode={handleSendPasswordOtp}
        onVerify={handleVerifyPasswordOtp}
        extraField={
          <div className={styles.field}>
            <label className={styles.label}>New password</label>
            <input
              className={styles.input}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
            />
          </div>
        }
      />
    </div>
  )
}

export default ProfileEditForm
