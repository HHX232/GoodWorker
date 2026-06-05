import { prisma } from "@/shared/prisma/prisma"
import { TeacherDashboard } from "@/_pages/TeacherDashboard/TeacherDashboard"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('teacherProfile') }
}


export default async function TeacherProfilePage() {
  const session = await auth()

  if (!session) redirect("/login")
  const role = session.user.role as string
  if (role === "STUDENT") redirect("/student-profile")

  const id = session.user.id

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { name: true, email: true, phone: true, avatarUrl: true, serviceLabels: true },
  })

  // ADMIN is backed by a teacher record — use session fallback if somehow missing
  const teacherData = teacher ?? {
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    phone: null,
    avatarUrl: null,
  }

  const [studentCount, callCount] = await Promise.all([
    prisma.teacherStudent.count({ where: { teacherId: id } }).catch(() => 0),
    prisma.videoCallRoom.count({ where: { ownerId: id } }).catch(() => 0),
  ])

  return (
    <TeacherDashboard
      initialData={teacherData}
      statsId={id}
      studentCount={studentCount}
      callCount={callCount}
    />
  )
}
