import { prisma } from "@/shared/prisma/prisma"
import { TeacherDashboard } from "@/_pages/TeacherDashboard/TeacherDashboard"
import { getTeacherCallStats } from "@/shared/lib/videoRoom/getTeacherCallStats"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('teacherProfile') }
}


interface TeacherProfilePageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function TeacherProfilePage({ searchParams }: TeacherProfilePageProps) {
  const session = await auth()

  if (!session) redirect("/login")
  const role = session.user.role as string
  if (role === "STUDENT") redirect("/student-profile")

  const { id: requestedId } = await searchParams
  if (requestedId && requestedId !== session.user.id) redirect(`/users/${requestedId}`)

  const id = session.user.id

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { name: true, email: true, phone: true, avatarUrl: true, serviceLabels: true, isVip: true, vipExpiresAt: true },
  })

  // ADMIN is backed by a teacher record — use session fallback if somehow missing
  const teacherData = teacher ?? {
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    phone: null,
    avatarUrl: null,
  }

  const [studentCount, callCount, { totalHours }] = await Promise.all([
    prisma.teacherStudent.count({ where: { teacherId: id } }).catch(() => 0),
    prisma.videoCallRoom.count({ where: { ownerId: id } }).catch(() => 0),
    getTeacherCallStats(id).catch(() => ({ totalCalls: 0, totalHours: 0 })),
  ])

  const now = new Date()
  const isAdmin = role === 'ADMIN'
  const isVip = isAdmin || ((teacher?.isVip ?? false) && (teacher?.vipExpiresAt == null || teacher.vipExpiresAt > now))
  // null = infinite VIP (admin or no expiry set)
  const vipExpiresAt = isAdmin ? null : (teacher?.vipExpiresAt ?? null)

  return (
    <TeacherDashboard
      initialData={teacherData}
      statsId={id}
      studentCount={studentCount}
      callCount={callCount}
      totalHours={totalHours}
      isVip={isVip}
      vipExpiresAt={vipExpiresAt ? vipExpiresAt.toISOString() : null}
    />
  )
}
