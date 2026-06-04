import { prisma } from "@/shared/prisma/prisma"
import { StudentDashboard } from "@/_pages/StudentDashboard/StudentDashboard"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PageTitles')
  return { title: t('studentProfile') }
}


export default async function StudentProfilePage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "STUDENT") redirect("/teacher-profile")

  const id = session.user.id

  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  })

  if (!student) redirect("/login")

  return (
    <StudentDashboard initialData={student} />
  )
}
