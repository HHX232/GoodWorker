import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import { loadLinkedSubtree } from '@/shared/lib/tutorFiles/folderLinks'
import { toFile } from '@/shared/lib/tutorFiles/readModel'
import type { LinkedFolderResponse } from '@/shared/types/TutorFiles/tutorFiles.types'

// GET /api/tutor-files/links/[token] — a folder attached by link, read-only,
// for any signed-in viewer of the homework/post/test/course it's embedded in.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { token } = await params
    const tree = await loadLinkedSubtree(token)
    if (!tree) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body: LinkedFolderResponse = {
      folder: { id: tree.root.id, name: tree.root.name, cover: tree.root.cover },
      teacher: tree.teacher,
      folders: tree.folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })),
      files: tree.files.map(f => toFile(f)),
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[GET /api/tutor-files/links/[token]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
