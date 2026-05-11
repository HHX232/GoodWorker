'use client'

import dynamic from 'next/dynamic'

const VideoCallPage = dynamic(() => import('@/widgets/VideoRoom/VideoCallPage'), { ssr: false })

export default function CallEntry({ userName }: { userName: string }) {
  return <VideoCallPage userName={userName} />
}
