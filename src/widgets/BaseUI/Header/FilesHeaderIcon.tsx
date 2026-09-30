'use client'

import { FilesFolderIcon } from '@/widgets/Files/icons'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import styles from './ChatHeaderIcon.module.scss'
import local from './FilesHeaderIcon.module.scss'

// /files entry next to the chat icon — same button shape (reuses its styles),
// no badge: new shares already announce themselves as chat cards. Desktop
// only — see FilesHeaderIcon.module.scss.
export function FilesHeaderIcon() {
  const { data: session } = useSession()
  const t = useTranslations('files')
  if (!session?.user) return null
  return (
    <Link href="/files" className={`${styles.btn} ${local.hideNarrow}`} aria-label={t('pageTitle')} title={t('pageTitle')}>
      <FilesFolderIcon size={18} strokeWidth={2} />
    </Link>
  )
}
