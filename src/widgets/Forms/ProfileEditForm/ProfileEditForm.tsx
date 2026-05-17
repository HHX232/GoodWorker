'use client'

import OtpModal from '@/shared/ui/Modals/OtpModal/OtpModal'
import ImageCropEditor from '@/widgets/BaseUI/ImageCropEditor/ImageCropEditor'
import { CreateImagesInput } from '@/shared/ui/inputs/CreateImagesInput/CreateImagesInput'
import LanguageSelect from '@/shared/ui/inputs/LanguageSelect/LanguageSelect'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {FC, useEffect, useRef, useState} from 'react'
import styles from './ProfileEditForm.module.scss'
import {useUpdateProfile} from '@/features/hooks/User/useUpdateProfile'
import {TranscriptsModal} from './TranscriptsModal'
import {BookmarksModal} from './BookmarksModal'

const VideoRoom = dynamic(() => import('@/widgets/VideoRoom/VideoRoom'), {ssr: false})

type UserType = 'Student' | 'Teacher'

interface SocialLinks {
  vk?: string | null
  telegram?: string | null
  instagram?: string | null
  youtube?: string | null
  website?: string | null
}

interface ProfileData {
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
  bio?: string | null
  coverPhotoUrl?: string | null
  socialLinks?: SocialLinks | Record<string, string> | null
  languages?: string[]
}

interface ProfileEditFormProps {
  userType: UserType
  initialData: ProfileData
  statsId?: string
}

const ProfileEditForm: FC<ProfileEditFormProps> = ({userType, initialData, statsId}) => {
  const {mutateAsync: updateProfile} = useUpdateProfile(userType)

  useEffect(() => {
    document.body.style.setProperty('overflow', 'auto', 'important')
    return () => {
      document.body.style.removeProperty('overflow')
    }
  }, [])

  const [name, setName] = useState(initialData.name)
  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Teacher-only fields
  const [bio, setBio] = useState(initialData.bio ?? '')
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(initialData.coverPhotoUrl ?? null)
  const [languages, setLanguages] = useState<string[]>(initialData.languages?.length ? initialData.languages : ['ru'])
  const [socialLinks, setSocialLinks] = useState({
    vk:        (initialData.socialLinks as SocialLinks | null)?.vk        ?? '',
    telegram:  (initialData.socialLinks as SocialLinks | null)?.telegram  ?? '',
    instagram: (initialData.socialLinks as SocialLinks | null)?.instagram ?? '',
    youtube:   (initialData.socialLinks as SocialLinks | null)?.youtube   ?? '',
    website:   (initialData.socialLinks as SocialLinks | null)?.website   ?? '',
  })

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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

  const handleCoverFilesChange = (files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCoverPhotoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCoverActiveChange = (urls: string[]) => {
    setCoverPhotoUrl(urls.length > 0 ? urls[0] : null)
  }

  const cleanSocialLinks = () => {
    const filtered = Object.fromEntries(
      Object.entries(socialLinks).filter(([, v]) => v?.trim())
    )
    return Object.keys(filtered).length ? filtered : null
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        avatarUrl,
        ...(userType === 'Teacher' && {
          bio: bio.trim() || null,
          coverPhotoUrl,
          socialLinks: cleanSocialLinks(),
          languages,
        }),
      })
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

        {/* ── Teacher: Bio + Cover photo ── */}
        {userType === 'Teacher' && (
          <>
            <div className={styles.card}>
              <div className={styles.cardLabel}>О себе</div>

              {/* Cover photo */}
              <div className={styles.field}>
                <label className={styles.label}>Фото для раздела «О преподавателе»</label>
                <CreateImagesInput
                  maxFiles={1}
                  activeImages={coverPhotoUrl ? [coverPhotoUrl] : []}
                  onFilesChange={handleCoverFilesChange}
                  onActiveImagesChange={handleCoverActiveChange}
                  allowedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
                  showBigFirstItem={false}
                  inputIdPrefix="cover-photo"
                />
              </div>

              {/* Bio */}
              <div className={styles.field}>
                <label className={styles.label}>Описание (до 2000 символов)</label>
                <textarea
                  className={styles.textarea}
                  rows={5}
                  placeholder="Расскажите о себе, своём опыте и подходе к обучению..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={2000}
                />
                <span className={styles.charCount}>{bio.length} / 2000</span>
              </div>
            </div>

            <div className={styles.divider} />

            {/* ── Teacher: Languages ── */}
            <div className={styles.card}>
              <div className={styles.cardLabel}>Языки преподавания</div>
              <LanguageSelect value={languages} onChange={setLanguages} label='' />
            </div>

            <div className={styles.divider} />

            {/* ── Teacher: Social links ── */}
            <div className={styles.card}>
              <div className={styles.cardLabel}>Социальные сети</div>
              <div className={styles.fields}>
                {([
                  {key: 'vk',        label: 'ВКонтакте',  placeholder: 'https://vk.com/username'},
                  {key: 'telegram',  label: 'Telegram',    placeholder: 'https://t.me/username'},
                  {key: 'instagram', label: 'Instagram',   placeholder: 'https://instagram.com/username'},
                  {key: 'youtube',   label: 'YouTube',     placeholder: 'https://youtube.com/@channel'},
                  {key: 'website',   label: 'Сайт',        placeholder: 'https://example.com'},
                ] as const).map(({key, label, placeholder}) => (
                  <div key={key} className={styles.field}>
                    <label className={styles.label}>{label}</label>
                    <input
                      className={styles.input}
                      type="url"
                      placeholder={placeholder}
                      value={socialLinks[key]}
                      onChange={e => setSocialLinks(prev => ({...prev, [key]: e.target.value}))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.divider} />
          </>
        )}

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

        {/* ── Quick actions ── */}
        <div className={styles.card}>
          <div className={styles.cardLabel}>История</div>
          <div className={styles.actionBtns}>
            <button type="button" className={styles.actionBtn} onClick={() => setTranscriptsOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Конспекты звонков
            </button>
            <button type="button" className={styles.actionBtn} onClick={() => setBookmarksOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Сохранённые закладки
            </button>
            {userType === 'Teacher' && statsId && (
              <Link href={`/statistics/${statsId}`} className={styles.actionBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Статистика
              </Link>
            )}
            {userType === 'Teacher' && statsId && (
              <Link href={`/calendar/${statsId}`} className={styles.actionBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Календарь
              </Link>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* ── Video room ── */}
        <VideoRoom defaultName={name} />

      </div>

      <TranscriptsModal isOpen={transcriptsOpen} onClose={() => setTranscriptsOpen(false)} />
      <BookmarksModal isOpen={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />

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
