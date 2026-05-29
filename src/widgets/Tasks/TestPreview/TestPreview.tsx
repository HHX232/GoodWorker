import Image from 'next/image'
import Link from 'next/link'
import styles from './TestPreview.module.scss'

function TestPreview({
  description,
  themes,
  title,
  createdAt,
  avatarUrl,
  authorName,
  testId,
  useBorder = true,
  isOwner = false,
  grayscale = false,
  useLink = true
}: {
  avatarUrl: string
  description: string
  themes: string[]
  title: string
  createdAt: string
  authorName: string
  testId: string
  useBorder?: boolean
  isOwner?: boolean
  grayscale?: boolean
  useLink?: boolean
}) {
  const formattedDate = new Date(createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short'
  })

  const inner = (
    <div className={`${styles.card} ${!useBorder ? styles.none_border : ''} ${grayscale ? styles.grayscale : ''}`}>
      <div className={styles.author}>
        <div className={styles.avatar}>
          <Image width={80} height={80} src={avatarUrl} alt={authorName} />
        </div>
        <span className={styles.authorName}>{authorName}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <p className={styles.title}>{title}</p>
          <span className={styles.date}>{formattedDate}</span>
        </div>

        <p className={styles.description}>{description}</p>

        <div className={styles.themes}>
          {themes.map((theme) => (
            <span key={theme} className={styles.tag}>
              {theme}
            </span>
          ))}
        </div>

        {isOwner && (
          <Link
            href={`/create-test?id=${testId}`}
            className={styles.editBtn}
            onClick={(e) => e.stopPropagation()}
          >
            <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
              <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
            </svg>
            Редактировать
          </Link>
        )}
      </div>
    </div>
  )

  if (!useLink) return inner

  return <Link href={`/test/${testId}`} style={{ textDecoration: 'none' }}>{inner}</Link>
}

export default TestPreview
