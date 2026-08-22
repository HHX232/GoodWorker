'use client'

import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import styles from './LoginPage.module.scss'
import { TextInputUI } from '@/shared/ui/inputs'

export default function LoginPage() {
  const t = useTranslations('auth2.login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    let hasError = false
    if (!email.trim()) {
      setEmailError(t('emailRequired'))
      hasError = true
    }
    if (password.length < 6) {
      setPasswordError(t('passwordMin'))
      hasError = true
    }
    if (hasError) return

    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setPasswordError(t('invalidCredentials'))
      } else {
        toast.success(t('successLogin'))
        window.location.href = '/'
      }
    } catch {
      toast.error(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
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
            errorValue={emailError}
          />
          <TextInputUI
            helpTitle={t('fieldPassword')}
            theme='newWhite'
            placeholder={t('passwordPlaceholder')}
            currentValue={password}
            onSetValue={(v) => { setPassword(v); if (passwordError) setPasswordError('') }}
            isSecret
            autoComplete='current-password'
            errorValue={passwordError}
          />
          <div className={styles.forgotRow}>
            <Link href='/forgot-password' className={styles.forgotLink}>
              {t('forgotPassword')}
            </Link>
          </div>
        </div>

        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('loading') : t('submit')}
        </button>

        <p className={styles.hint}>
          {t('noAccount')}{' '}
          <Link href='/register' className={styles.link}>
            {t('register')}
          </Link>
        </p>
      </div>
    </div>
  )
}