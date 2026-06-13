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
import { useState, useEffect } from 'react'
import styles from './PostPage.module.scss'
import { BookmarkHighlighter } from '@/shared/ui/bookmark/BookmarkHighlighter'
import { PostCommentCompact } from '@/shared/ui/Posts/PostCommentCompact/PostCommentCompact'
import { PostCardHeader } from '@/shared/ui/Posts/PostCardHeader/PostCardHeader'

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
  const isCompact = useCompactSidebar()
  const resolvedComments: CommentItem[] = initialComments ?? (post.enrichedComments ?? []).map(enrichedToCommentItem)

  const userPostInfo = {
    avatarUrl: post.teacher?.avatarUrl ?? '',
    name: post.teacher?.name ?? '',
    email: '',
    userId: post.teacher?.id ?? '',
    userType: UserRolesObject.Teacher,
    totalView: post.viewCount ?? 0,
    publishDate: new Date(post.createdAt),
    postCategory: post.category?.translations.find((t) => t.langCode === 'ru')?.name ?? '—'
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

  const content = blocks.length > 0 ? (
    <>
      {!firstBlockIsText && standaloneTitle}
      <PostBlockRenderer postId={post.id} blocks={blocks} titleNode={firstBlockIsText ? titleNode : undefined} />
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
        <UserPostInfo {...userPostInfo} />
        {content}
        <SetCommentBlock postId={post.id} />
        {commentSection}
      </div>

      {/* desktop: main content column */}
      <div className={styles.extra_full_bot}>
        {cardHeader}
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
