import { prisma } from '@/shared/prisma/prisma'
import ProfileEditForm from '@/widgets/Forms/ProfileEditForm/ProfileEditForm'
import { redirect } from 'next/navigation'
import { auth } from '../../../../auth'

export default async function StudentProfileEditPage() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  const student = await prisma.student.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  })

  if (!student) {
    redirect('/login')
  }

  return (
    <ProfileEditForm
      userType="Student"
      initialData={student}
    />
  )
}