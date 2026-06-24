'use client'

import { InputOtp, TextInputUI } from '@/shared/ui/inputs'
import { CategorySelect } from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import LanguageSelect from '@/shared/ui/inputs/LanguageSelect/LanguageSelect'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './RegisterPage.module.scss'

type Role = 'User' | 'Teacher'
type Step = 'send' | 'verify'

export default function RegisterPage() {
  const t = useTranslations('auth2.register')
  const router = useRouter()

  const [step, setStep] = useState<Step>('send')
  const [role, setRole] = useState<Role>('User')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.setProperty('overflow-y', 'auto', 'important')
    body.style.setProperty('overflow-y', 'auto', 'important')
    return () => {
      html.style.removeProperty('overflow-y')
      body.style.removeProperty('overflow-y')
    }
  }, [])

  // send step fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['ru'])
  const [agreeConsent, setAgreeConsent] = useState(false)
  const [promoCode, setPromoCode] = useState('')

  async function handleSend() {
    if (!name.trim()) {
      toast.error(t('nameRequired'))
      return
    }
    if (!email || !email.includes('@')) {
      toast.error(t('emailInvalid'))
      return
    }
    if (password.length < 6) {
      toast.error(t('passwordMin'))
      return
    }
    if (role === 'Teacher' && selectedCategories.length === 0) {
      toast.error(t('categoriesRequired'))
      return
    }
    if (!agreeConsent) {
      toast.error(t('consentRequired'))
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
        {step === 'send' && (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>{t('title')}</h1>
              <p className={styles.subtitle}>{t('subtitle')}</p>
            </div>

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
                onSetValue={setName}
              />
              <TextInputUI
                helpTitle={t('fieldEmail')}
                theme='newWhite'
                placeholder={t('emailPlaceholder')}
                currentValue={email}
                onSetValue={setEmail}
              />
              <TextInputUI
                helpTitle={t('fieldPhone')}
                theme='newWhite'
                placeholder={t('phonePlaceholder')}
                currentValue={phone}
                onSetValue={setPhone}
              />
              <TextInputUI
                helpTitle={t('fieldPassword')}
                theme='newWhite'
                placeholder={t('passwordPlaceholder')}
                currentValue={password}
                onSetValue={setPassword}
                isSecret
              />
              <TextInputUI
                helpTitle={t('fieldPromoCode')}
                theme='newWhite'
                placeholder={t('promoPlaceholder')}
                currentValue={promoCode}
                onSetValue={(v) => setPromoCode(v.toUpperCase())}
              />
            </div>

            {role === 'Teacher' && (
              <>
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
              </>
            )}

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

            <button className={styles.btn} onClick={handleSend} disabled={loading || !agreeConsent}>
              {loading ? t('loading') : t('sendCode')}
            </button>

            <p className={styles.hint}>
              {t('hasAccount')}{' '}
              <Link href='/login' className={styles.link}>
                {t('login')}
              </Link>
            </p>
          </>
        )}

        {/* ── STEP: VERIFY ── */}
        {step === 'verify' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('send')}>
              ← {t('back')}
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
