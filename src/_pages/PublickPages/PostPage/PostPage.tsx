/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import {PostBlockRenderer} from '@/_pages/CreatePostPage/PostBlockRenderer/PostBlockRenderer'
import {UserRolesObject} from '@/shared/constants/user/user.const'
import {PostCommentSection, UserPostInfo} from '@/shared/ui'
import {mockComments} from '@/shared/ui/Posts/PostCommentSection/PostCommentSection'
import {NavBar} from '@/widgets/BaseUI'
import {BorderTextHandler} from '@/widgets/Cards'
import styles from './PostPage.module.scss'
import {Prisma} from '@prisma/client'

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    teacher: {select: {id: true; name: true; avatarUrl: true}}
    category: {include: {translations: true}}
    _count: {select: {views: true; comments: true}}
  }
}>
function PostPage({post}: {post: PostWithRelations}) {
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

  const content = post.content && <PostBlockRenderer blocks={(post.content as {blocks: any[]}).blocks} />

  return (
    <div className={`container default_content ${styles.extra_content}`}>
      <NavBar />
      <BorderTextHandler />

      <div className={styles.mobile_wrapper}>
        <UserPostInfo {...userPostInfo} />
        {content}
        <PostCommentSection comments={mockComments} totalComments={400} />
      </div>

      <div className={styles.extra_full_bot}>{content}</div>

      <div className={`${styles.sticky_sidebar} ${styles.not_mobile_box}`}>
        <UserPostInfo {...userPostInfo} />
        <PostCommentSection comments={mockComments} totalComments={400} />
      </div>
    </div>
  )
}

export default PostPage
