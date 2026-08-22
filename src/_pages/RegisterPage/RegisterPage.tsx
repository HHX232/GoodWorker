'use client'

import { InputOtp, TextInputUI } from '@/shared/ui/inputs'
import { CategorySelect } from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import LanguageSelect from '@/shared/ui/inputs/LanguageSelect/LanguageSelect'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './RegisterPage.module.scss'

const BackArrowIcon = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' className={styles.backIcon}>
    <path d='M9.5 3.5L4.5 8L9.5 12.5' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)

type Role = 'User' | 'Teacher'
type Step = 'send' | 'verify'

export default function RegisterPage() {
  const t = useTranslations('auth2.register')
  const router = useRouter()

  const [step, setStep] = useState<Step>('send')
  const [role, setRole] = useState<Role>('User')
  const [teacherSubStep, setTeacherSubStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)

  // send step fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['ru'])
  const [agreeConsent, setAgreeConsent] = useState(false)
  const [promoCode, setPromoCode] = useState('')

  function validateBasicFields() {
    let ok = true
    if (!name.trim()) {
      setNameError(t('nameRequired'))
      ok = false
    }
    if (!email || !email.includes('@')) {
      setEmailError(t('emailInvalid'))
      ok = false
    }
    if (password.length < 6) {
      setPasswordError(t('passwordMin'))
      ok = false
    }
    if (!agreeConsent) {
      toast.error(t('consentRequired'))
      ok = false
    }
    return ok
  }

  function handleContinueToTeacherProfile() {
    if (!validateBasicFields()) return
    setTeacherSubStep(2)
  }

  async function handleSend() {
    if (!validateBasicFields()) return
    if (role === 'Teacher' && selectedCategories.length === 0) {
      toast.error(t('categoriesRequired'))
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        step: 'send',
        userType: role,
        name,
        email,
        phone,
        password,
        langCode: 'ru'
      }
      if (role === 'Teacher') {
        body.categoryIds = selectedCategories
        body.languages = selectedLanguages
      } 
      console.log('send OTP ifelse')
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? t('unexpectedError'))
        return
      }

      toast.success(t('codeSent'))
      setStep('verify')
    } catch {
      toast.error(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(otp: string) {
    setLoading(true)
    console.log('send OTP ifelse2')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          step: 'verify',
          userType: role,
          otp,
          name,
          email,
          phone,
          password,
          langCode: 'ru',
          ...(role === 'Teacher' ? {categoryIds: selectedCategories, languages: selectedLanguages} : {}),
          ...(promoCode.trim() ? {promoCode: promoCode.trim().toUpperCase()} : {})
        })
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? t('unexpectedError'))
        return
      }

      // sign in right after registration
      await signIn('credentials', {email, password, redirect: false})
      toast.success(t('successRegister'))
      if (data.promoResult?.success) {
        const until = new Date(data.promoResult.vipUntil).toLocaleDateString()
        toast.success(t('promoSuccess', {date: until}), {duration: 6000})
      }
      router.push('/')
    } catch {
      toast.error(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ── STEP: SEND ── */}
        {step === 'send' && (() => {
          const isTeacherProfileStep = role === 'Teacher' && teacherSubStep === 2

          return (
            <>
              {isTeacherProfileStep && (
                <button className={styles.backBtn} onClick={() => setTeacherSubStep(1)}>
                  <BackArrowIcon />
                  {t('back')}
                </button>
              )}

              <div className={styles.header}>
                <h1 className={styles.title}>
                  {isTeacherProfileStep ? t('teacherProfileTitle') : t('title')}
                </h1>
                <p className={styles.subtitle}>
                  {isTeacherProfileStep ? t('teacherProfileSubtitle') : t('subtitle')}
                </p>
              </div>

              {!isTeacherProfileStep && (
                <>
                  {/* Role switcher */}
                  <div className={styles.roleTabs}>
                    <button
                      className={`${styles.roleTab} ${role === 'User' ? styles.active : ''}`}
                      onClick={() => setRole('User')}
                    >
                      {t('roleStudent')}
                    </button>
                    <button
                      className={`${styles.roleTab} ${role === 'Teacher' ? styles.active : ''}`}
                      onClick={() => setRole('Teacher')}
                    >
                      {t('roleTeacher')}
                    </button>
                  </div>

                  <div className={styles.fields}>
                    <TextInputUI
                      helpTitle={t('fieldName')}
                      theme='newWhite'
                      placeholder={t('namePlaceholder')}
                      currentValue={name}
                      onSetValue={(v) => { setName(v); if (nameError) setNameError('') }}
                      autoComplete='name'
                      errorValue={nameError}
                    />
                    <TextInputUI
                      helpTitle={t('fieldEmail')}
                      theme='newWhite'
                      placeholder={t('emailPlaceholder')}
                      currentValue={email}
                      onSetValue={(v) => { setEmail(v); if (emailError) setEmailError('') }}
                      autoComplete='email'
                      errorValue={emailError}
                    />
                    <TextInputUI
                      helpTitle={t('fieldPhone')}
                      theme='newWhite'
                      placeholder={t('phonePlaceholder')}
                      currentValue={phone}
                      onSetValue={setPhone}
                      autoComplete='tel'
                    />
                    <TextInputUI
                      helpTitle={t('fieldPassword')}
                      theme='newWhite'
                      placeholder={t('passwordPlaceholder')}
                      currentValue={password}
                      onSetValue={(v) => { setPassword(v); if (passwordError) setPasswordError('') }}
                      isSecret
                      autoComplete='new-password'
                      errorValue={passwordError}
                    />
                    <TextInputUI
                      helpTitle={t('fieldPromoCode')}
                      theme='newWhite'
                      placeholder={t('promoPlaceholder')}
                      currentValue={promoCode}
                      onSetValue={(v) => setPromoCode(v.toUpperCase())}
                    />
                  </div>

                  <label className={styles.consentRow}>
                    <input
                      type="checkbox"
                      className={styles.consentCheck}
                      checked={agreeConsent}
                      onChange={e => setAgreeConsent(e.target.checked)}
                    />
                    <span className={styles.consentText}>
                      {t('consentText')}{' '}
                      <Link href="/privacy" className={styles.link} target="_blank">{t('privacyLink')}</Link>
                      {' '}{t('consentAnd')}{' '}
                      <Link href="/terms" className={styles.link} target="_blank">{t('termsLink')}</Link>
                    </span>
                  </label>
                </>
              )}

              {isTeacherProfileStep && (
                <div className={styles.fields}>
                  <CategorySelect
                    canSelectMany={true}
                    maxLevel={1}
                    value={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder={t('categoriesPlaceholder')}
                  />
                  <LanguageSelect
                    value={selectedLanguages}
                    onChange={setSelectedLanguages}
                    label={t('languagesLabel')}
                  />
                </div>
              )}

              {role === 'Teacher' && teacherSubStep === 1 ? (
                <button className={styles.btn} onClick={handleContinueToTeacherProfile} disabled={!agreeConsent}>
                  {t('nextStep')}
                </button>
              ) : (
                <button
                  className={styles.btn}
                  onClick={handleSend}
                  disabled={loading || (isTeacherProfileStep && selectedCategories.length === 0) || (!isTeacherProfileStep && !agreeConsent)}
                >
                  {loading ? t('loading') : t('sendCode')}
                </button>
              )}

              {!isTeacherProfileStep && (
                <p className={styles.hint}>
                  {t('hasAccount')}{' '}
                  <Link href='/login' className={styles.link}>
                    {t('login')}
                  </Link>
                </p>
              )}
            </>
          )
        })()}

        {/* ── STEP: VERIFY ── */}
        {step === 'verify' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('send')}>
              <BackArrowIcon />
              {t('back')}
            </button>

            <div className={styles.header}>
              <h1 className={styles.title}>{t('verifyTitle')}</h1>
              <p className={styles.subtitle}>
                {t('verifySubtitle')} <strong>{email}</strong>
              </p>
            </div>

            <div className={styles.otpWrap}>
              <InputOtp className={styles.extra_otp} length={6} onComplete={handleVerify} disabled={loading} autoFocus />
            </div>

            <p className={styles.resendHint}>
              {t('noCode')}{' '}
              <button className={styles.resendBtn} onClick={handleSend} disabled={loading}>
                {t('resend')}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
