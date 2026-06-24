import { RoomServiceClient } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

const lkHost = (process.env.LIVEKIT_URL ?? '').replace(/^wss?:\/\//, 'https://')

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { roomName, participantIdentity, trackSid, muted } = await req.json()
    if (!roomName || !participantIdentity || !trackSid) {
      return NextResponse.json({ error: 'roomName, participantIdentity, trackSid required' }, { status: 400 })
    }

    const svc = new RoomServiceClient(lkHost, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!)
    await svc.mutePublishedTrack(roomName, participantIdentity, trackSid, muted ?? true)
    return NextResponse.json({ ok: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'LiveKit error' }, { status: 500 })
  }
}
