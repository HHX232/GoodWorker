import { AccessToken } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomName } = await req.json()
  if (!roomName?.trim()) return NextResponse.json({ error: 'roomName required' }, { status: 400 })

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: session.user.name ?? session.user.id,
    ttl: 3600,
  })
  at.addGrant({ roomJoin: true, room: roomName.trim(), canPublish: true, canSubscribe: true })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}
