import { prisma } from '@/shared/prisma/prisma'
import { TeacherPublicProfile } from '@/_pages/TeacherPublicProfile/TeacherPublicProfile'
import { StudentPublicProfile } from '@/_pages/StudentPublicProfile/StudentPublicProfile'
import { notFound } from 'next/navigation'
import { auth } from '../../../../auth'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('PageTitles')
  try {
    const [teacher, student] = await Promise.all([
      prisma.teacher.findUnique({ where: { id }, select: { name: true } }),
      prisma.student.findUnique({ where: { id }, select: { name: true } }),
    ])
    const name = teacher?.name ?? student?.name
    if (name) return { title: name }
  } catch {}
  return { title: t('teacherPublicProfile') }
}

export default async function UserPublicPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  // ── Try teacher first ──
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      name: true,
      avatarUrl: true,
      isVip: true,
      createdAt: true,
      langCode: true,
      bio: true,
      coverPhotoUrl: true,
      socialLinks: true,
      serviceLabels: true,
      pasportConfirmed: true,
      categories: {
        select: {
          category: {
            select: {
              id: true,
              slug: true,
              translations: { select: { langCode: true, name: true } },
            },
          },
        },
      },
      _count: { select: { posts: true } },
    },
  })

  if (teacher) {
    const [studentCount, callCount, experiences] = await Promise.all([
      prisma.teacherStudent.count({ where: { teacherId: id } }),
      prisma.videoCallRoom.count({ where: { ownerId: id } }),
      prisma.teacherExperience.findMany({
        where: { teacherId: id },
        select: { id: true, title: true, organization: true, yearFrom: true, yearTo: true, description: true, verifiedAt: true, documentUrls: true },
        orderBy: { yearFrom: 'desc' },
      }),
    ])
    const categories = teacher.categories.map(tc => tc.category)
    const locale = session?.user ? undefined : teacher.langCode

    return (
      <TeacherPublicProfile
        teacherId={id}
        name={teacher.name}
        avatarUrl={teacher.avatarUrl}
        isVip={teacher.isVip}
        createdAt={teacher.createdAt.toISOString()}
        studentCount={studentCount}
        postCount={teacher._count.posts}
        callCount={callCount}
        categories={categories}
        locale={locale}
        bio={teacher.bio}
        coverPhotoUrl={teacher.coverPhotoUrl}
        socialLinks={teacher.socialLinks as Record<string, string> | null}
        experiences={experiences.map(e => ({ ...e, verifiedAt: e.verifiedAt ? e.verifiedAt.toISOString() : null }))}
        serviceLabels={teacher.serviceLabels}
        identityConfirmed={teacher.pasportConfirmed ?? false}
      />
    )
  }

  // ── Try student ──
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      lastSeenAt: true,
      _count: { select: { postViews: true, roadmapProgress: true } },
    },
  })

  if (!student) notFound()

  const [commentCount, isMyStudentRecord] = await Promise.all([
    prisma.postComment.count({ where: { authorId: id, authorRole: 'STUDENT' } }),
    session?.user?.role === 'TEACHER'
      ? prisma.teacherStudent.findFirst({
          where: { teacherId: session.user.id, studentId: id },
          select: { linkedAt: true },
        })
      : Promise.resolve(null),
  ])

  return (
    <StudentPublicProfile
      id={student.id}
      name={student.name}
      avatarUrl={student.avatarUrl}
      createdAt={student.createdAt.toISOString()}
      lastSeenAt={student.lastSeenAt?.toISOString() ?? null}
      stats={{
        postsRead: student._count.postViews,
        roadmapsStarted: student._count.roadmapProgress,
        commentsLeft: commentCount,
      }}
      isMyStudent={!!isMyStudentRecord}
      linkedAt={isMyStudentRecord ? isMyStudentRecord.linkedAt.toISOString() : null}
      viewerRole={(session?.user?.role as 'STUDENT' | 'TEACHER' | 'ADMIN' | null) ?? null}
    />
  )
}
