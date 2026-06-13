// app/api/post/route.ts
import {prisma} from '@/shared/prisma/prisma'
import {PostVisibility} from '@prisma/client'
import {NextRequest, NextResponse} from 'next/server'
import {auth} from '../../../auth'
import {enrichPostWithAI} from '@/lib/postAI'
import {hasAIProvider} from '@/lib/openrouter'
import {cookies} from 'next/headers'

type ContentBlock = {type: string; payload: {url?: string | null}}
type PostContent = {blocks?: ContentBlock[]} | null

function extractMediaUrls(content: PostContent): string[] {
  if (!content?.blocks) return []
  return content.blocks
    .filter((b) => b.type === 'MEDIA' && b.payload?.url && !b.payload.url.startsWith('blob:'))
    .map((b) => b.payload.url as string)
}

function detectHasMiniTest(content: PostContent): boolean {
  return (content?.blocks ?? []).some((b) => b.type === 'MINI_TEST')
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const body = await req.json()
    const {
      title,
      additionalTitle,
      visibility = 'PUBLIC',
      categoryIds,
      content,
      isVip = false,
      vipExpiresAt,
      allowedStudentIds
    } = body

    if (!title?.trim()) {
      return NextResponse.json({error: 'Title is required'}, {status: 400})
    }

    if (!Object.values(PostVisibility).includes(visibility)) {
      return NextResponse.json({error: 'Invalid visibility value'}, {status: 400})
    }

    if (visibility === 'SELECTED' && (!allowedStudentIds || allowedStudentIds.length === 0)) {
      return NextResponse.json({error: 'allowedStudentIds required for SELECTED visibility'}, {status: 400})
    }

    const categoryId = categoryIds?.[0] ?? null
    const mediaUrls = extractMediaUrls(content)
    const hasMiniTest = detectHasMiniTest(content)

    const cookieStore = await cookies()
    const originalLang = cookieStore.get('NEXT_LOCALE')?.value ?? 'ru'

    const post = await prisma.post.create({
      data: {
        teacherId: session.user.id,
        title: title.trim(),
        additionalTitle: additionalTitle?.trim() ?? null,
        visibility,
        categoryId,
        content,
        mediaUrls,
        hasMiniTest,
        aiTopics: [],
        isVip,
        vipExpiresAt: isVip && vipExpiresAt ? new Date(vipExpiresAt) : null,
        originalLang,
        allowedStudents:
          visibility === 'SELECTED' ? {create: allowedStudentIds.map((studentId: string) => ({studentId}))} : undefined
      },
      include: {allowedStudents: true}
    })

    if (hasAIProvider()) {
      enrichPostWithAI(post.id)
        .then(() => console.log(`[postAI] translated post ${post.id}`))
        .catch(e => console.error(`[postAI] failed for post ${post.id}:`, e?.message ?? e))
    }

    return NextResponse.json(post, {status: 201})
  } catch (error) {
    console.error('[POST /api/posts]', error)
    return NextResponse.json({error: 'Internal server error'}, {status: 500})
  }
}
