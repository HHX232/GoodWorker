import HomeworkViewerPage from '@/_pages/HomeworkPages/HomeworkViewerPage/HomeworkViewerPage'
import { prisma } from '@/shared/prisma/prisma'
import { notFound, redirect } from 'next/navigation'
import { auth } from '../../../../auth'

async function getAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.homeworkAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      homework: {
        include: {
          teacher: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      student: { select: { id: true, name: true, avatarUrl: true } },
      blockProgress: { select: { blockIndex: true, completedAt: true } },
    },
  })
  if (!assignment) return null

  const isAssignmentTeacher = assignment.homework.teacherId === userId
  const isAssignmentStudent = assignment.studentId === userId

  if (!isAssignmentTeacher && !isAssignmentStudent) return null

  return assignment
}

export default async function HomeworkViewerServerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const assignment = await getAssignment(id, session.user.id)
  if (!assignment) return notFound()

  const isTeacherViewer = session.user.id === assignment.homework.teacherId

  // Mark as started if PENDING (only for the student, not the teacher viewing)
  if (assignment.status === 'PENDING' && !isTeacherViewer) {
    await prisma.homeworkAssignment.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    }).catch(() => {})
    assignment.status = 'IN_PROGRESS'
  }

  return (
    <HomeworkViewerPage
      isTeacherViewer={isTeacherViewer}
      assignment={{
        ...assignment,
        homework: {
          ...assignment.homework,
          content: assignment.homework.content as { blocks: unknown[] },
          dueAt: assignment.homework.dueAt?.toISOString() ?? null,
          sendAt: assignment.homework.sendAt?.toISOString() ?? null,
        },
        startedAt: assignment.startedAt?.toISOString() ?? null,
        submittedAt: assignment.submittedAt?.toISOString() ?? null,
        grade: assignment.grade,
        gradeComment: assignment.gradeComment,
        gradePhotos: assignment.gradePhotos,
        reviewedAt: assignment.reviewedAt?.toISOString() ?? null,
        blockProgress: assignment.blockProgress.map((p: { blockIndex: number; completedAt: Date }) => ({
          blockIndex: p.blockIndex,
          completedAt: p.completedAt.toISOString(),
        })),
      }}
    />
  )
}
