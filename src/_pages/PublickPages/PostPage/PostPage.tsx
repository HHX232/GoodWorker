/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {PostBlockRenderer} from '@/_pages/CreatePostPage/PostBlockRenderer/PostBlockRenderer'

import {UserRolesObject} from '@/shared/constants/user/user.const'
import {UserPostInfo} from '@/shared/ui'
import {CommentItem, PostCommentSection} from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import {NavBar} from '@/widgets/BaseUI'
import {BorderTextHandler} from '@/widgets/Cards'
import {Prisma, Role} from '@prisma/client'
import styles from './PostPage.module.scss'

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
    images: c.imageUrls ?? []
  }
}

function parsePostContent(content: Prisma.JsonValue): any[] {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  const obj = content as Record<string, Prisma.JsonValue>
  if (!Array.isArray(obj.blocks)) return []
  return obj.blocks as any[]
}

function PostPage({post, initialComments, currentUserId}: PostPageProps) {
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
  const content = blocks.length > 0 ? <PostBlockRenderer blocks={blocks} /> : null

  const commentSection = (
    <PostCommentSection
      postId={post.id}
      initialComments={resolvedComments}
      totalComments={post._count?.comments ?? 0}
      currentUserId={currentUserId}
    />
  )

  return (
    <div className={`container default_content ${styles.extra_content}`}>
      <NavBar />
      <BorderTextHandler />

      {/* mobile layout */}
      <div className={styles.mobile_wrapper}>
        <UserPostInfo {...userPostInfo} />
        {content}
        {commentSection}
      </div>

      {/* desktop: main content column */}
      <div className={styles.extra_full_bot}>{content}</div>

      {/* desktop: right sticky sidebar */}
      <div className={`${styles.sticky_sidebar} ${styles.not_mobile_box}`}>
        <UserPostInfo {...userPostInfo} />
        {commentSection}
      </div>
    </div>
  )
}

export default PostPage
export type {EnrichedComment, PostWithRelations}
