import {USER_ROLES} from '@/shared/constants'
import {formatDate} from '@/shared/helpers'
import Image from 'next/image'
import Link from 'next/link'
import styles from './UserPostInfo.module.scss'
import {useOnlineStatus} from '@/features/hooks/User/useOnlineStatus'
import {formatActivity} from '@/shared/helpers/formatActivity'
import {useTranslations} from 'next-intl'

const stub = '/stubs/stub-2.jpg'

export function UserPostInfo({
  avatarUrl,
  name,
  email,
  userId,
  userType,
  totalView,
  publishDate,
  postCategory
}: {
  avatarUrl: string
  name: string
  email: string
  userType: (typeof USER_ROLES)[number]
  userId: string
  totalView: number | string
  publishDate: Date
  postCategory: string
}) {
  const t = useTranslations('UserPostInfo')
  const {online, lastSeenAt} = useOnlineStatus(userId)
  const computedDateActivity = formatActivity(online, lastSeenAt)
  return (
    <div className={styles.card}>
      <Link href={`/users/${userId}`} className={styles.user_link}>
        <div className={styles.avatar_wrapper}>
          <Image src={avatarUrl || stub} alt={name} width={120} height={120} className={styles.avatar} />
          <div className={`${styles.status_circle} ${computedDateActivity === 'Online' && styles.active_circle}`}></div>
        </div>
        <p className={styles.name}>{name}</p>
        <p className={styles.email}>{email}</p>
      </Link>

      <ul className={styles.info_block}>
        <li className={styles.info_row}>
          <span className={styles.info_label}>{t('userType')}:</span>
          <span className={styles.info_value}>{userType}</span>
        </li>
        <li className={styles.info_row}>
          <span className={styles.info_label}>{t('totalView')}:</span>
          <span className={styles.info_value}>{Number(totalView).toLocaleString('en')}</span>
        </li>
        <li className={styles.info_row}>
          <span className={styles.info_label}>{t('publishDate')}:</span>
          <span className={styles.info_value}>{formatDate(publishDate)}</span>
        </li>
        <li className={styles.info_row}>
          <span className={styles.info_label}>{t('postCategory')}:</span>
          <span className={styles.info_value}>{postCategory}</span>
        </li>
      </ul>
    </div>
  )
}
