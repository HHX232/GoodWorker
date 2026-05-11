'use client'

import dynamic from 'next/dynamic'

const VideoCallPage = dynamic(() => import('@/widgets/VideoRoom/VideoCallPage'), { ssr: false })

interface Props {
  userName: string
  room: string
  ownerIdentity: string
}

export default function RoomEntry({ userName, room, ownerIdentity }: Props) {
  return <VideoCallPage userName={userName} autoJoinRoom={room} ownerIdentity={ownerIdentity} />
}
