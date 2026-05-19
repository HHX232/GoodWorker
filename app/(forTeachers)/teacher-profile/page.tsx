import { prisma } from "@/shared/prisma/prisma"
import { TeacherDashboard } from "@/_pages/TeacherDashboard/TeacherDashboard"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

export default async function TeacherProfilePage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role === "STUDENT") redirect("/student-profile")

  const id = session.user.id

  const [teacher, studentCount, callCount] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id },
      select: { name: true, email: true, phone: true, avatarUrl: true },
    }),
    prisma.teacherStudent.count({ where: { teacherId: id } }),
    prisma.videoCallRoom.count({ where: { ownerId: id } }),
  ])

  if (!teacher) redirect("/login")

  return (
    <TeacherDashboard
      initialData={teacher}
      statsId={id}
      studentCount={studentCount}
      callCount={callCount}
    />
  )
}
