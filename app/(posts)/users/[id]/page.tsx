import { prisma } from '@/shared/prisma/prisma'
import { TeacherPublicProfile } from '@/_pages/TeacherPublicProfile/TeacherPublicProfile'
import { notFound } from 'next/navigation'
import { auth } from '../../../../auth'

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

interface MetaProps { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { id } = await params
  const t = await getTranslations('PageTitles')
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: { name: true }
    })
    if (teacher?.name) return { title: teacher.name }
  } catch {}
  return { title: t('teacherPublicProfile') }
}



interface Props {
  params: Promise<{ id: string }>
}

export default async function UserPublicPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  const [teacher, studentCount, callCount, experiences] = await Promise.all([
    prisma.teacher.findUnique({
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
    }),
    prisma.teacherStudent.count({ where: { teacherId: id } }),
    prisma.videoCallRoom.count({ where: { ownerId: id } }),
    prisma.teacherExperience.findMany({
      where: { teacherId: id },
      select: { id: true, title: true, organization: true, yearFrom: true, yearTo: true, description: true, verifiedAt: true },
      orderBy: { yearFrom: 'desc' },
    }),
  ])

  if (!teacher) notFound()

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
    />
  )
}
