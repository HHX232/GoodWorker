import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../../../auth'
import { fileContentResponse } from '@/shared/lib/tutorFiles/content'
import { loadLinkedSubtree } from '@/shared/lib/tutorFiles/folderLinks'

export const runtime = 'nodejs'

// GET /api/tutor-files/links/[token]/files/[fileId]/content — viewer bytes for
// a file inside a linked folder (checked against the link's subtree).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { token, fileId } = await params
    const tree = await loadLinkedSubtree(token)
    const file = tree?.files.find(f => f.id === fileId)
    if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return fileContentResponse(file)
  } catch (e) {
    console.error('[GET /api/tutor-files/links/[token]/files/[fileId]/content]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
