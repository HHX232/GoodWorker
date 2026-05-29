'use client'

import dynamic from 'next/dynamic'

const VideoCallPage = dynamic(() => import('@/widgets/VideoRoom/VideoCallPage'), { ssr: false })

interface Props {
  userName: string
  roomName: string
  roomId: string
  ownerIdentity: string
  localAvatarUrl?: string
  topic?: string
  userRole?: string
}

export default function RoomEntry({ userName, roomName, roomId, ownerIdentity, localAvatarUrl, topic, userRole }: Props) {
  return (
    <VideoCallPage
      userName={userName}
      autoJoinRoom={roomName}
      roomId={roomId}
      ownerIdentity={ownerIdentity}
      localAvatarUrl={localAvatarUrl}
      topic={topic}
      userRole={userRole}
    />
  )
}
