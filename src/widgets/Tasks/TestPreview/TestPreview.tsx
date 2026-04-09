import Image from 'next/image'
import styles from './TestPreview.module.scss'
import Link from 'next/link'

function TestPreview({
  description,
  themes,
  title,
  createdAt,
  avatarUrl,
  authorName,
  testId,
  useBorder = true
}: {
  avatarUrl: string
  description: string
  themes: string[]
  title: string
  createdAt: string
  authorName: string
  testId: string
  useBorder?: boolean
}) {
  const formattedDate = new Date(createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short'
  })

  return (
    <Link href={`/test/${testId}`}>
      <div className={`${styles.card} ${!useBorder ? styles.none_border : ''}`}>
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
        </div>
      </div>
    </Link>
  )
}

export default TestPreview
