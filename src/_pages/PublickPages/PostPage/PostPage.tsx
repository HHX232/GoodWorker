/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { PostBlockRenderer } from '@/_pages/CreatePostPage/PostBlockRenderer/PostBlockRenderer'
import { PostBlockType } from '@/shared/types/Post/Post.type'

import { UserRolesObject } from '@/shared/constants/user/user.const'
import { UserPostInfo } from '@/shared/ui'
import { CommentItem, PostCommentSection } from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import { SetCommentBlock } from '@/shared/ui/Posts/SetCommentBlock/SetCommentBlock'
import { NavBar } from '@/widgets/BaseUI'
import { BorderTextHandler } from '@/widgets/Cards'
import { Prisma, Role } from '@prisma/client'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePomodoroCtx } from '@/widgets/Pomodoro/PomodoroContext'
import styles from './PostPage.module.scss'

import { BookmarkHighlighter } from '@/shared/ui/bookmark/BookmarkHighlighter'
import { PostCommentCompact } from '@/shared/ui/Posts/PostCommentCompact/PostCommentCompact'
import { PostCardHeader } from '@/shared/ui/Posts/PostCardHeader/PostCardHeader'

// ─── Pomodoro bar ─────────────────────────────────────────────────────────────

function ClockFace({ progress, phaseColor }: { progress: number; phaseColor: string }) {
  const r = 13
  const circ = 2 * Math.PI * r
  const angle = (progress * 360 - 90) * (Math.PI / 180)
  const hx = 16 + 8 * Math.cos(angle)
  const hy = 16 + 8 * Math.sin(angle)
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = ((i * 30 - 90) * Math.PI) / 180
        return (
          <line key={i}
            x1={16 + 11.2 * Math.cos(a)} y1={16 + 11.2 * Math.sin(a)}
            x2={16 + 13 * Math.cos(a)} y2={16 + 13 * Math.sin(a)}
            stroke="currentColor" strokeOpacity={i % 3 === 0 ? 0.3 : 0.1} strokeWidth={i % 3 === 0 ? 1.5 : 1}
          />
        )
      })}
      <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="2.5" />
      <circle cx="16" cy="16" r={r} fill="none" stroke={phaseColor} strokeWidth="2.5"
        strokeDasharray={`${circ * progress} ${circ}`}
        strokeLinecap="round" transform="rotate(-90 16 16)"
        style={{ transition: 'stroke-dasharray 0.9s linear' }}
      />
      <line x1="16" y1="16" x2={hx} y2={hy}
        stroke={phaseColor} strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'x2 0.9s linear, y2 0.9s linear' }}
      />
      <circle cx="16" cy="16" r="2.2" fill={phaseColor} />
    </svg>
  )
}

function PostPomodoroBar() {
  const t = useTranslations('Pomodoro')
  const { phase, timeLeft, isRunning, progress, toggle, settings, applySettings } = usePomodoroCtx()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [localSettings, setLocalSettings] = useState(settings)

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')
  const phaseLabel = phase === 'work' ? t('phase_work') : phase === 'short-break' ? t('phase_short') : t('phase_long')
  const phaseColor = phase === 'work' ? '#6366f1' : phase === 'short-break' ? '#22c55e' : '#f59e0b'

  const handleApply = () => {
    applySettings(localSettings)
    setSettingsOpen(false)
  }

  return (
    <div className={styles.pom_wrap}>
      <div className={styles.pomodoro_bar}>
        <ClockFace progress={progress} phaseColor={phaseColor} />

        <div className={styles.pom_center}>
          <span className={styles.pom_time}>{mm}:{ss}</span>
          <span className={styles.pom_phase} style={{ color: phaseColor }}>{phaseLabel}</span>
        </div>

        <div className={styles.pom_actions}>
          <button className={styles.pom_btn} onClick={toggle} aria-label={isRunning ? 'Пауза' : 'Старт'}>
            {isRunning
              ? <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <button
            className={`${styles.pom_btn} ${settingsOpen ? styles.pom_btn_active : ''}`}
            onClick={() => setSettingsOpen(o => !o)}
            aria-label="Настройки"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className={styles.pom_settings}>
          {([
            { key: 'work',       labelKey: 'setting_work',  min: 5, max: 60, step: 5 },
            { key: 'shortBreak', labelKey: 'setting_short', min: 1, max: 15, step: 1 },
            { key: 'longBreak',  labelKey: 'setting_long',  min: 5, max: 30, step: 5 },
          ] as const).map(({ key, labelKey, min, max, step }) => (
            <label key={key} className={styles.pom_setting_row}>
              <span className={styles.pom_setting_label}>{t(labelKey)}</span>
              <input type="range" min={min} max={max} step={step}
                value={localSettings[key]}
                onChange={e => setLocalSettings(v => ({ ...v, [key]: +e.target.value }))}
                className={styles.pom_range}
                style={{ '--fill': phaseColor } as React.CSSProperties}
              />
              <span className={styles.pom_setting_val}>{localSettings[key]} {t('setting_min')}</span>
            </label>
          ))}
          <button className={styles.pom_apply} onClick={handleApply}>{t('apply')}</button>
        </div>
      )}
    </div>
  )
}

function useCompactSidebar() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const check = () => setCompact(window.innerWidth > 1040 && window.innerHeight < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return compact
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    teacher: {select: {id: true; name: true; avatarUrl: true}}
    category: {include: {translations: true}}
    _count: {select: {views: true; comments: true}}
  }
}> & {
  /** Comments enriched with author — resolved on the server before passing to this page */
  enrichedComments?: EnrichedComment[]
}

interface EnrichedComment {
  id: string
  postId: string
  authorId: string
  authorRole: Role
  text: string
  imageUrls: string[]
  editedAt: Date | null
  createdAt: Date
  author: {
    id: string
    name: string
    avatarUrl: string | null
  } | null
  stars?: number | null
}

interface PostPageProps {
  post: PostWithRelations
  /** Pre-mapped CommentItem[] — if provided, takes priority over post.enrichedComments */
  initialComments?: CommentItem[]
  /** Current viewer's id from session — enables edit/delete on own comments */
  currentUserId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function enrichedToCommentItem(c: EnrichedComment): CommentItem {
  return {
    id: c.id,
    user: {
      cardID: c.id,
      userID: c.authorId,
      name: c.author?.name ?? 'Unknown',
      role: c.authorRole === 'TEACHER' ? 'Admin' : 'Member',
      image: c.author?.avatarUrl ?? '',
      dateActivity: new Date(c.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
      }),
      BlurDots: c.authorRole === 'TEACHER'
    },
    commentText: c.text,
    images: c.imageUrls ?? [],
    stars: c.stars ?? null,
  }
}

function parsePostContent(content: Prisma.JsonValue): any[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  const obj = content as Record<string, Prisma.JsonValue>
  if (!Array.isArray(obj.blocks)) return []
  return obj.blocks as any[]
}

// ─── Page ─────────────────────────────────────────────────

function PostPage({post, initialComments, currentUserId}: PostPageProps) {
  const locale = useLocale()
  const tPreview = useTranslations('roadmapPreview')
  const tLangs = useTranslations('roadmapPreview.languages')
  const isCompact = useCompactSidebar()
  const { data: session } = useSession()
  const isStudent = session?.user?.role === 'STUDENT'

  useEffect(() => {
    document.documentElement.classList.add('post-page')
    return () => document.documentElement.classList.remove('post-page')
  }, [])

  const showLangBadge = (post as any).originalLang && (post as any).originalLang !== locale
  const resolvedComments: CommentItem[] = initialComments ?? (post.enrichedComments ?? []).map(enrichedToCommentItem)

  const userPostInfo = {
    avatarUrl: post.teacher?.avatarUrl ?? '',
    name: post.teacher?.name ?? '',
    email: '',
    userId: post.teacher?.id ?? '',
    userType: UserRolesObject.Teacher,
    totalView: post.viewCount ?? 0,
    publishDate: new Date(post.createdAt),
    postCategory: post.category?.translations.find((t) => t.langCode === locale)?.name
      ?? post.category?.translations.find((t) => t.langCode === 'ru')?.name
      ?? '—'
  }

  const blocks = parsePostContent(post.content)

  // Inject title into the first TEXT block; otherwise render it as a standalone header box
  const firstBlockIsText = blocks[0]?.type === PostBlockType.TEXT
  const titleNode = <h1 className={styles.post_title}>{post.title}</h1>

  const standaloneTitle = (
    <div style={{background: '#fff', borderRadius: 12, padding: '12px 16px'}}>
      {titleNode}
    </div>
  )

  const langBadge = showLangBadge ? (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(83,74,183,0.1)', color: '#534AB7', fontSize: 12, fontWeight: 600, fontFamily: 'Roboto, sans-serif', margin: '0 0 8px', boxShadow: '0 1px 6px rgba(83,74,183,0.12)'}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      {tPreview('originalLang')}: {tLangs((post as any).originalLang as Parameters<typeof tLangs>[0]) ?? (post as any).originalLang}
    </div>
  ) : null

  const content = blocks.length > 0 ? (
    <>
      {!firstBlockIsText && standaloneTitle}
      <PostBlockRenderer key={locale} postId={post.id} blocks={blocks} titleNode={firstBlockIsText ? titleNode : undefined} />
      <BookmarkHighlighter postId={post.id} />
    </>
  ) : standaloneTitle

  const commentSection = (
    <PostCommentSection
      postId={post.id}
      initialComments={resolvedComments}
      totalComments={post._count?.comments ?? 0}
      currentUserId={currentUserId}
    />
  )

  const cardHeader = (
    <PostCardHeader postId={post.id} postTitle={post.title} />
  )

  return (
    <div className={`container default_content ${styles.extra_content}`}>
      <NavBar />
      <BorderTextHandler />

      {/* mobile layout */}
      <div className={styles.mobile_wrapper}>
        {cardHeader}
        {isStudent && <PostPomodoroBar />}
        <UserPostInfo {...userPostInfo} />
        {langBadge}
        {content}
        <SetCommentBlock postId={post.id} />
        {commentSection}
      </div>

      {/* desktop: main content column */}
      <div className={styles.extra_full_bot}>
        {cardHeader}
        {isStudent && <PostPomodoroBar />}
        {langBadge}
        {content}
        <SetCommentBlock postId={post.id} />
      </div>

      {/* desktop: right sticky sidebar */}
      <div className={`${styles.sticky_sidebar} ${styles.not_mobile_box}`}>
        <UserPostInfo {...userPostInfo} />
        {isCompact ? (
          <PostCommentCompact
            postId={post.id}
            initialComments={resolvedComments}
            totalComments={post._count?.comments ?? 0}
            currentUserId={currentUserId}
          />
        ) : (
          <div style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}>{commentSection}</div>
        )}
      </div>
    </div>
  )
}

export default PostPage
export type { EnrichedComment, PostWithRelations }
