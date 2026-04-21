import { prisma } from '@/shared/prisma/prisma'
import ProfileEditForm from '@/widgets/Forms/ProfileEditForm/ProfileEditForm'
import { redirect } from 'next/navigation'
import { auth } from '../../../../auth'

export default async function TeacherProfileEditPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const teacher = await prisma.teacher.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  })

  if (!teacher) {
    redirect('/login')
  }

  return (
    <ProfileEditForm
      userType="Teacher"
      initialData={teacher}
    />
  )
}