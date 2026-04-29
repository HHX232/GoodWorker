/* eslint-disable @typescript-eslint/no-explicit-any */
import PostPage from '@/_pages/PublickPages/PostPage/PostPage'
import {prisma} from '@/shared/prisma/prisma'
import {SeoPostContent} from '@/shared/ui/Posts/SeoPostContent/SeoPostContent'
import {notFound} from 'next/navigation'
import {auth} from '../../../../auth'

async function PostServerPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params

  const post = await prisma.post.findUnique({
    where: {id},
    include: {
      teacher: {select: {id: true, name: true, avatarUrl: true}},
      category: {include: {translations: true}},
      _count: {select: {views: true, comments: true}}
    }
  })

  if (!post) return notFound()

  const session = await auth()
  if (session?.user?.id) {
    const userId = session.user.id
    const role = session.user.role

    if (role === 'STUDENT') {
      const alreadyViewed = await prisma.postView.findUnique({
        where: {postId_studentId: {postId: id, studentId: userId}}
      })
      if (!alreadyViewed) {
        await prisma.$transaction([
          prisma.postView.create({data: {postId: id, studentId: userId, viewerRole: 'STUDENT'}}),
          prisma.post.update({where: {id}, data: {viewCount: {increment: 1}}})
        ])
        post.viewCount += 1
      }
    } else if (role === 'TEACHER') {
      const alreadyViewed = await prisma.postView.findFirst({
        where: {postId: id, teacherId: userId}
      })
      if (!alreadyViewed) {
        await prisma.$transaction([
          prisma.postView.create({data: {postId: id, teacherId: userId, viewerRole: 'TEACHER'}}),
          prisma.post.update({where: {id}, data: {viewCount: {increment: 1}}})
        ])
        post.viewCount += 1
      }
    }
  }

  return (
    <>
      <SeoPostContent blocks={(post.content as any)?.blocks ?? []} />
      <PostPage post={post} />
    </>
  )
}
export default PostServerPage
