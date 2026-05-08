'use client'

import {useOnlineStatus} from '@/features/hooks/User/useOnlineStatus'
import {formatActivity} from '@/shared/helpers/formatActivity'
import {ITeacherListItem} from '@/features/services/TeacherService.service'
import {getAvatarColor} from '@/shared/ui/User/UserHeaderCard/UserHeaderCard'
import {useLocale, useTranslations} from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import {FC, useState} from 'react'
import styles from './TeacherCard.module.scss'

interface Props {
  teacher: ITeacherListItem
}

const TeacherCard: FC<Props> = ({teacher}) => {
  const t = useTranslations('TeacherCard')
  const locale = useLocale()
  const [imgError, setImgError] = useState(false)
  const {online, lastSeenAt} = useOnlineStatus(teacher.id)
  const activity = formatActivity(online, lastSeenAt)

  const showFallback = !teacher.avatarUrl || imgError
  const {bg, text} = getAvatarColor(teacher.name)

  const categories = teacher.categories.slice(0, 3).map(({category}) => {
    const translation = category.translations.find((tr) => tr.langCode === locale)
    return translation?.name ?? category.slug
  })

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.avatar_wrap}>
          {showFallback ? (
            <div className={styles.avatar_fallback} style={{backgroundColor: bg, color: text}}>
              {teacher.name.trim()[0]?.toUpperCase() ?? '?'}
            </div>
          ) : (
            <Image
              src={teacher.avatarUrl!}
              alt={teacher.name}
              width={56}
              height={56}
              className={styles.avatar}
              onError={() => setImgError(true)}
            />
          )}
          {online && <span className={styles.online_dot} />}
        </div>

        <div className={styles.header_info}>
          <div className={styles.name_row}>
            <Link href={`/users/${teacher.id}`} className={styles.name}>
              {teacher.name}
            </Link>
            {teacher.isVip && <span className={styles.vip_badge}>★ VIP</span>}
          </div>
          <p className={`${styles.activity} ${activity === 'Online' ? styles.activity_online : ''}`}>{activity}</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className={styles.categories}>
          {categories.map((cat) => (
            <span key={cat} className={styles.category_chip}>
              {cat}
            </span>
          ))}
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.stat_value}>{teacher._count.posts}</span>
          <span className={styles.stat_label}>{t('posts')}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.stat_value}>{teacher._count.students}</span>
          <span className={styles.stat_label}>{t('students')}</span>
        </div>
      </div>

      <Link href={`/users/${teacher.id}`} className={styles.link_btn}>
        {t('viewProfile')}
        <svg width='14' height='14' viewBox='0 0 16 16' fill='none'>
          <path d='M1 8H15M15 8L8 1M15 8L8 15' stroke='#868897' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </Link>
    </div>
  )
}

export default TeacherCard
