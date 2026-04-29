// lib/post/canViewPost.ts
import {prisma} from '@/shared/prisma/prisma'
import {PostVisibility} from '@prisma/client'

interface CanViewPostOptions {
  post: {
    id: string
    teacherId: string
    visibility: PostVisibility
    isVip: boolean
    vipExpiresAt: Date | null
  }
  userId?: string
  userRole?: string
}

export async function canViewPost({post, userId, userRole}: CanViewPostOptions): Promise<boolean> {
  switch (post.visibility) {
    case 'PUBLIC':
      return true

    case 'PRIVATE':
      return userId === post.teacherId

    case 'STUDENTS': {
      if (!userId) return false
      if (userId === post.teacherId) return true
      if (userRole !== 'STUDENT') return false
      const link = await prisma.teacherStudent.findUnique({
        where: {teacherId_studentId: {teacherId: post.teacherId, studentId: userId}}
      })
      return !!link
    }

    case 'SELECTED': {
      if (!userId) return false
      if (userId === post.teacherId) return true
      if (userRole !== 'STUDENT') return false
      const allowed = await prisma.postAllowedStudent.findUnique({
        where: {postId_studentId: {postId: post.id, studentId: userId}}
      })
      return !!allowed
    }

    default:
      return false
  }
}
