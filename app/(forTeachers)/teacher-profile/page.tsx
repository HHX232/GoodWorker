import { prisma } from "@/shared/prisma/prisma"
import ProfileEditForm from "@/widgets/Forms/ProfileEditForm/ProfileEditForm"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

export default async function TeacherProfilePage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "TEACHER") redirect("/student-profile")

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  })

  if (!teacher) redirect("/login")

  return (
    <ProfileEditForm
      userType="Teacher"
      initialData={teacher}
      statsId={session.user.id}
    />
  )
}