'use client'

import {useMe} from '@/features/hooks/User/useMe'
import Image from 'next/image'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import styles from './ProfilePreview.module.scss'

export function ProfilePreview() {
  const t = useTranslations('Header')
  const {data: user, isLoading} = useMe()

  if (isLoading) {
    return (
      <div className={styles.skeleton}>
        <div className={styles.skeletonText}>
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLineSm} />
        </div>
        <div className={styles.skeletonAvatar} />
      </div>
    )
  }

  if (!user) {
    return (
      <Link href='/login' className={styles.wrapper}>
        <div className={styles.info}>
          <p className={styles.name}>{t('loginTitle')}</p>
          <p style={{whiteSpace: 'nowrap'}} className={styles.username}>
            {t('loginSub')}
          </p>
        </div>
        <div className={styles.avatarWrap}>
          <span className={styles.initials}>?</span>
        </div>
      </Link>
    )
  }

  const href = user.role === 'TEACHER' ? '/teacher-profile' : '/student-profile'
  const username = user.email.split('@')[0]

  return (
    <Link href={href} className={styles.wrapper}>
      <div className={styles.info}>
        <p className={styles.name}>{user.name}</p>
        <p className={styles.username}>@{username}</p>
      </div>

      <div className={styles.avatarWrap}>
        {user.avatarUrl ? (
          <Image width={100} height={100} src={user.avatarUrl} alt={user.name} className={styles.avatar} />
        ) : (
          <span className={styles.initials}>{user.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
    </Link>
  )
}
