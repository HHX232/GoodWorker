import { redirect } from 'next/navigation'
import { auth } from '../../../auth'
import { prisma } from '@/shared/prisma/prisma'
import RoomEntry from './RoomEntry'

interface Props {
  params: Promise<{ room: string }>
}

export async function generateMetadata({ params }: Props) {
  const { room } = await params
  return { title: `Комната: ${decodeURIComponent(room)}` }
}

export default async function RoomPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { room } = await params
  const name = decodeURIComponent(room)
  const identity = session.user.name ?? session.user.id ?? 'User'

  let ownerIdentity = identity
  try {
    let dbRoom = await prisma.videoCallRoom.findUnique({ where: { name } })
    if (!dbRoom) {
      dbRoom = await prisma.videoCallRoom.create({
        data: { name, ownerIdentity: identity, ownerId: session.user.id, ownerRole: session.user.role as 'STUDENT' | 'TEACHER' },
      })
    }
    ownerIdentity = dbRoom.ownerIdentity
  } catch {
    // DB unavailable locally — current user becomes owner fallback
  }

  return (
    <RoomEntry
      userName={identity}
      room={name}
      ownerIdentity={ownerIdentity}
    />
  )
}
