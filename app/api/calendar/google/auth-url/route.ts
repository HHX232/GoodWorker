import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/calendar/google/callback`

  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CALENDAR_CLIENT_ID не настроен' }, { status: 500 })
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'online',
    prompt: 'consent',
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return NextResponse.json({ url })
}
