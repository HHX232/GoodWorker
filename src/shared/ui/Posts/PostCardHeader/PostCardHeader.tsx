'use client'

import { useBookmarks } from '@/features/hooks/Bookmark/useBookmarks'
import { PostComplaintModal } from '@/shared/ui/Posts/PostComplaintModal/PostComplaintModal'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './PostCardHeader.module.scss'

interface Props {
  postId: string
  postTitle: string
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className={styles.tip_wrap}>
      {children}
      <span className={styles.tip_box}>{text}</span>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export function PostCardHeader({ postId, postTitle }: Props) {
  const t = useTranslations('PostPage')
  const router = useRouter()
  const [reportOpen, setReportOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { bookmarks, save, remove } = useBookmarks('post', postId)
  const bookmark = bookmarks[0] ?? null
  const isBookmarked = !!bookmark

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const handleBookmark = () => {
    if (isBookmarked && bookmark) {
      remove(bookmark.id)
    } else {
      save({ text: postTitle, xpath: '', offset: 0, length: 0, contextText: '' })
    }
  }

  return (
    <>
      <div className={styles.bar}>
        <Tip text={t('backBtn')}>
          <button
            className={styles.back}
            onClick={() => router.back()}
            aria-label={t('backBtn')}
          >
            <BackIcon />
          </button>
        </Tip>

        <div className={styles.actions}>
          <Tip text={copied ? t('copied') : t('share')}>
            <button
              className={`${styles.action} ${copied ? styles.action_ok : ''}`}
              onClick={handleShare}
              aria-label={t('share')}
            >
              {copied ? <CheckIcon /> : <ShareIcon />}
            </button>
          </Tip>

          <Tip text={isBookmarked ? t('bookmarkRemove') : t('bookmark')}>
            <button
              className={`${styles.action} ${isBookmarked ? styles.action_active : ''}`}
              onClick={handleBookmark}
              aria-label={isBookmarked ? t('bookmarkRemove') : t('bookmark')}
            >
              <BookmarkIcon filled={isBookmarked} />
            </button>
          </Tip>

          <Tip text={t('report')}>
            <button
              className={`${styles.action} ${styles.action_report}`}
              onClick={() => setReportOpen(true)}
              aria-label={t('report')}
            >
              <ReportIcon />
            </button>
          </Tip>
        </div>
      </div>

      <PostComplaintModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        postId={postId}
        postTitle={postTitle}
      />
    </>
  )
}
