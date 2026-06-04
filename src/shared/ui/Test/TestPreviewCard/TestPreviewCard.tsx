'use client'

import { CardOwnerMenu } from '@/shared/ui/CardOwnerMenu/CardOwnerMenu'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { FC } from 'react'
import React from 'react'
import styles from './TestPreviewCard.module.scss'

const INFO_TYPES = new Set(['INFO_TEXT', 'INFO_MEDIA', 'INFO_AUDIO'])

interface Block { type: string }
interface Category {
  category: { translations: { langCode: string; name: string }[] }
}

export interface TestPreviewCardProps {
  id: string
  title: string
  aiTopic?: string | null
  content: { description?: string; blocks?: Block[] }
  testCategories?: Category[]
  teacher: { id: string; name: string; avatarUrl: string | null }
  isOwner?: boolean
  onDelete?: () => void
}

function getCategoryName(cat: Category, locale: string): string {
  const t = cat.category.translations.find(t => t.langCode === locale)
    ?? cat.category.translations.find(t => t.langCode === 'ru')
    ?? cat.category.translations[0]
  return t?.name ?? ''
}

const TYPE_ICONS: Record<string, React.ReactElement> = {
  CHOOSE_OPTION: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  FREE_ANSWER: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
    </svg>
  ),
  FILL_TEXT: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  MATCH_PAIRS: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  ),
  SEQUENCE: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M6 12h12M9 18h6"/>
    </svg>
  ),
}

const TYPE_COLORS: Record<string, string> = {
  CHOOSE_OPTION:  '#EEF2FF',
  FREE_ANSWER:    '#F0FDF4',
  FILL_TEXT:      '#FFF7ED',
  MATCH_PAIRS:    '#EFF6FF',
  SEQUENCE:       '#FDF4FF',
  HIGHLIGHT_TEXT: '#FEF9C3',
  WORD_SCRAMBLE:  '#ECFDF5',
  DIALOGUE:       '#FFF1F2',
}

const TYPE_TEXT_COLORS: Record<string, string> = {
  CHOOSE_OPTION:  '#4338CA',
  FREE_ANSWER:    '#16A34A',
  FILL_TEXT:      '#EA580C',
  MATCH_PAIRS:    '#2563EB',
  SEQUENCE:       '#9333EA',
  HIGHLIGHT_TEXT: '#CA8A04',
  WORD_SCRAMBLE:  '#059669',
  DIALOGUE:       '#E11D48',
}

export const TestPreviewCard: FC<TestPreviewCardProps> = ({
  id, title, aiTopic, content, testCategories = [], teacher, isOwner = false, onDelete,
}) => {
  const t = useTranslations('testPreview')
  const tDash = useTranslations('dashboard')
  const locale = typeof window !== 'undefined'
    ? document.documentElement.lang || 'ru'
    : 'ru'

  const blocks = content?.blocks ?? []
  const questionBlocks = blocks.filter(b => !INFO_TYPES.has(b.type))
  const questionCount = questionBlocks.length

  // Count by type for the type pills
  const typeCounts = questionBlocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.type] = (acc[b.type] ?? 0) + 1
    return acc
  }, {})

  const typeEntries = Object.entries(typeCounts).slice(0, 3)

  const categoryName = testCategories[0]
    ? getCategoryName(testCategories[0], locale)
    : null

  return (
    <div className={styles.card} style={{ position: 'relative' }}>
      {isOwner && onDelete && (
        <CardOwnerMenu onDelete={onDelete} deleteLabel={tDash('deleteItem')} />
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
          </svg>
        </div>
        <div className={styles.meta}>
          {categoryName && <span className={styles.category}>{categoryName}</span>}
          {aiTopic && <span className={styles.topic}>{aiTopic}</span>}
        </div>
      </div>

      {/* Title */}
      <Link href={`/test/${id}`} className={styles.titleLink}>
        <h5 className={styles.title}>{title}</h5>
      </Link>

      {/* Description */}
      {content?.description && (
        <p className={styles.desc}>{content.description}</p>
      )}

      {/* Type pills */}
      {typeEntries.length > 0 && (
        <div className={styles.typePills}>
          {typeEntries.map(([type, count]) => (
            <span
              key={type}
              className={styles.typePill}
              style={{
                background: TYPE_COLORS[type] ?? '#F5F5F5',
                color: TYPE_TEXT_COLORS[type] ?? '#555',
              }}
            >
              {TYPE_ICONS[type] ?? null}
              <span>{t(`type_${type}` as Parameters<typeof t>[0])}</span>
              {count > 1 && <span className={styles.typeCount}>×{count}</span>}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.questionCount}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>
          </svg>
          {t('questions', { count: questionCount })}
        </span>

        <div className={styles.actions}>
          <Link href={`/test/${id}`} className={styles.openBtn}>
            <span>{t('open')}</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M1 8H15M15 8L8 1M15 8L8 15" stroke="#868897" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          {isOwner && (
            <Link
              href={`/edit-test/${id}`}
              className={styles.editBtn}
              title={t('edit')}
              onClick={e => e.stopPropagation()}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
