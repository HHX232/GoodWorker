import {fetchPostsList} from '@/features/services/posts.server'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const {searchParams} = new URL(req.url)

    const result = await fetchPostsList({
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      categoryId: searchParams.get('categoryId') ?? undefined,
      teacherId: searchParams.get('teacherId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      onlyVip: searchParams.get('onlyVip') === 'true',
      sortBy: searchParams.get('sortBy') === 'viewCount' ? 'viewCount' : 'createdAt',
      lang: searchParams.get('lang') ?? undefined,
      userId: session?.user?.id,
      userRole: session?.user?.role
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/posts]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
