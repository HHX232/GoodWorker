import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const closeScript = (type: string, payload: object) => `
<!DOCTYPE html>
<html>
<head><title>Google Calendar</title></head>
<body>
<script>
  try {
    window.opener && window.opener.postMessage(${JSON.stringify({ type, ...payload })}, window.location.origin);
  } catch (e) {}
  window.close();
</script>
</body>
</html>`

  if (error || !code) {
    return new NextResponse(closeScript('GOOGLE_CAL_ERROR', { message: error ?? 'Авторизация отменена' }), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/calendar/google/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      return new NextResponse(
        closeScript('GOOGLE_CAL_ERROR', { message: 'Не удалось получить токен доступа' }),
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    return new NextResponse(
      closeScript('GOOGLE_CAL_TOKEN', { token: tokenData.access_token }),
      { headers: { 'Content-Type': 'text/html' } }
    )
  } catch {
    return new NextResponse(
      closeScript('GOOGLE_CAL_ERROR', { message: 'Серверная ошибка обмена токена' }),
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
}
