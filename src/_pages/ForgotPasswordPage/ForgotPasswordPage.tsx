'use client'

import { InputOtp, TextInputUI } from '@/shared/ui/inputs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './ForgotPasswordPage.module.scss'

const BackArrowIcon = () => (
  <svg width='16' height='16' viewBox='0 0 16 16' fill='none' className={styles.backIcon}>
    <path d='M9.5 3.5L4.5 8L9.5 12.5' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
  </svg>
)

type Step = 'request' | 'reset'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth2.forgotPassword')
  const router = useRouter()

  const [step, setStep] = useState<Step>('request')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function handleSend() {
    if (!email || !email.includes('@')) {
      setEmailError(t('emailInvalid'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'send', email }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? t('unexpectedError'))
        return
      }

      toast.success(t('codeSent'))
      setStep('reset')
    } catch {
      toast.error(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(otp: string) {
    if (newPassword.length < 6) {
      setPasswordError(t('passwordMin'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'verify', email, otp, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? t('unexpectedError'))
        return
      }

      toast.success(t('successReset'))
      router.push('/login')
    } catch {
      toast.error(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* ── STEP: REQUEST ── */}
        {step === 'request' && (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>{t('title')}</h1>
              <p className={styles.subtitle}>{t('subtitle')}</p>
            </div>

            <div className={styles.fields}>
              <TextInputUI
                helpTitle={t('fieldEmail')}
                theme='newWhite'
                placeholder={t('emailPlaceholder')}
                currentValue={email}
                onSetValue={(v) => { setEmail(v); if (emailError) setEmailError('') }}
                autoComplete='email'
                autoFocus
                errorValue={emailError}
              />
            </div>

            <button className={styles.btn} onClick={handleSend} disabled={loading}>
              {loading ? t('loading') : t('sendCode')}
            </button>

            <p className={styles.hint}>
              {t('rememberedPassword')}{' '}
              <Link href='/login' className={styles.link}>
                {t('backToLogin')}
              </Link>
            </p>
          </>
        )}

        {/* ── STEP: RESET ── */}
        {step === 'reset' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('request')}>
              <BackArrowIcon />
              {t('back')}
            </button>

            <div className={styles.header}>
              <h1 className={styles.title}>{t('verifyTitle')}</h1>
              <p className={styles.subtitle}>
                {t('verifySubtitle')} <strong>{email}</strong>
              </p>
            </div>

            <div className={styles.fields}>
              <TextInputUI
                helpTitle={t('fieldNewPassword')}
                theme='newWhite'
                placeholder={t('newPasswordPlaceholder')}
                currentValue={newPassword}
                onSetValue={(v) => { setNewPassword(v); if (passwordError) setPasswordError('') }}
                isSecret
                autoComplete='new-password'
                autoFocus
                errorValue={passwordError}
              />
            </div>

            <div className={styles.otpWrap}>
              <InputOtp className={styles.extra_otp} length={6} onComplete={handleVerify} disabled={loading} />
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
