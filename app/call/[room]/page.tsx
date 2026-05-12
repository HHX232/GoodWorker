import { redirect } from 'next/navigation'
import { auth } from '../../../auth'
import { prisma } from '@/shared/prisma/prisma'
import RoomEntry from './RoomEntry'

interface Props {
  params: Promise<{ room: string }>
}

export async function generateMetadata({ params }: Props) {
  const { room } = await params
  try {
    const decoded = decodeURIComponent(room)
    const dbRoom =
      await prisma.videoCallRoom.findUnique({ where: { id: room } }) ??
      await prisma.videoCallRoom.findUnique({ where: { name: decoded } })
    return { title: dbRoom ? `Комната: ${dbRoom.name}` : `Комната: ${decoded}` }
  } catch {
    return { title: 'Видео-звонок' }
  }
}

export default async function RoomPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const { room: roomId } = await params
  const identity = session.user.name ?? session.user.id ?? 'User'

  // roomId can be either a DB CUID or a URL-encoded room name (fallback)
  const decodedName = (() => { try { return decodeURIComponent(roomId) } catch { return roomId } })()
  let roomName = decodedName
  let ownerIdentity = identity

  try {
    // try by CUID first, then by name
    const dbRoom =
      await prisma.videoCallRoom.findUnique({ where: { id: roomId } }) ??
      await prisma.videoCallRoom.findUnique({ where: { name: decodedName } })
    if (dbRoom) {
      roomName = dbRoom.name
      ownerIdentity = dbRoom.ownerIdentity
    }
  } catch {
    // table doesn't exist yet — current user is owner, room name = decoded param
  }

  let localAvatarUrl: string | undefined
  try {
    const student = await prisma.student.findFirst({ where: { name: identity }, select: { avatarUrl: true } })
    localAvatarUrl = student?.avatarUrl ?? undefined
    if (!localAvatarUrl) {
      const teacher = await prisma.teacher.findFirst({ where: { name: identity }, select: { avatarUrl: true } })
      localAvatarUrl = teacher?.avatarUrl ?? undefined
    }
  } catch {}

  return (
    <RoomEntry
      userName={identity}
      roomName={roomName}
      roomId={roomId}
      ownerIdentity={ownerIdentity}
      localAvatarUrl={localAvatarUrl}
    />
  )
}
