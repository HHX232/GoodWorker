'use client'

import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import styles from './LoginPage.module.scss'
import { TextInputUI } from '@/shared/ui/inputs'

export default function LoginPage() {
  const t = useTranslations('auth2.login')
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function handleSubmit() {
    if (!email.trim()) {
      toast.error(t('emailRequired'))
      return
    }
    if (password.length < 6) {
      toast.error(t('passwordMin'))
      return
    }

    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        toast.error(t('invalidCredentials'))
      } else {
        toast.success(t('successLogin'))
        router.push('/')
        router.refresh()
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
            onSetValue={setEmail}
          />
          <TextInputUI
            helpTitle={t('fieldPassword')}
            theme='newWhite'
            placeholder={t('passwordPlaceholder')}
            currentValue={password}
            onSetValue={setPassword}
            isSecret
          />
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