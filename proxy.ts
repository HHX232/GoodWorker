import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const privatePaths = ['/profile', '/orders', '/basket']

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  const isPrivatePath = privatePaths.some((privatePath) => path.startsWith(privatePath))

  const routeType = isPrivatePath ? 'PRIVATE' : 'PUBLIC'

  console.log(`📍 Роут: ${path}`)
  console.log(`🔑 Тип: ${routeType}`)
  console.log('---')

  const response = NextResponse.next()
  response.headers.set('x-route-type', routeType)
  response.headers.set('x-current-path', path)

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)']
}
