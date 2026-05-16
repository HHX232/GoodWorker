import { prisma } from "@/shared/prisma/prisma"
import { StudentErrorsList } from "@/shared/ui/Stats/StudentErrorsWidget/StudentErrorsList"
import ProfileEditForm from "@/widgets/Forms/ProfileEditForm/ProfileEditForm"
import { redirect } from "next/navigation"
import { auth } from "../../../auth"

export default async function StudentProfilePage() {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "STUDENT") redirect("/teacher-profile")

  const student = await prisma.student.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  })

  if (!student) redirect("/login")

  return (
    <>
      <ProfileEditForm
        userType="Student"
        initialData={student}
      />
      <StudentErrorsList />
    </>
  )
}
