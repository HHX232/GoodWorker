import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getFilesSessionUser, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'
import { snippetAround } from '@/shared/lib/tutorFiles/extractText'
import { grantStudentSelect, loadOpens, studentItemCounter, toFile, toFolder } from '@/shared/lib/tutorFiles/readModel'
import type { LibraryFile } from '@/shared/types/TutorFiles/tutorFiles.types'

const MAX_CONTENT_HITS = 60

/** Attach "found inside" snippets to files whose text matches (idea 8). */
async function withContentMatches(files: LibraryFile[], extraIds: string[], q: string): Promise<{ matchedIds: string[]; snippets: Map<string, string> }> {
  const snippets = new Map<string, string>()
  const ids = [...new Set([...files.map(f => f.id), ...extraIds])]
  if (!ids.length) return { matchedIds: [], snippets }
  const hits = await prisma.tutorFile.findMany({
    where: { id: { in: ids }, contentText: { contains: q, mode: 'insensitive' } },
    select: { id: true, contentText: true },
    take: MAX_CONTENT_HITS,
  })
  for (const h of hits) {
    const snip = h.contentText ? snippetAround(h.contentText, q) : null
    if (snip) snippets.set(h.id, snip)
  }
  return { matchedIds: hits.map(h => h.id), snippets }
}

// GET /api/tutor-files/search?q=... — by name AND inside the files' text
// (PDF/Word/Excel/PowerPoint/text, extracted at upload). A content hit comes
// back with `contentMatch` — the passage around the first occurrence — so the
// card can show *where* it was found. Teacher: whole library; student: only
// what canStudentSee() allows (loadStudentVisibility).
export async function GET(req: NextRequest) {
  try {
    const user = await getFilesSessionUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) return NextResponse.json({ folders: [], files: [] })

    if (user.role === 'TEACHER') {
      const fileInclude = { grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' as const } }, review: true }
      const [folders, files] = await Promise.all([
        prisma.tutorFolder.findMany({
          where: { teacherId: user.id, name: { contains: q, mode: 'insensitive' } },
          include: { _count: { select: { children: true, files: true } }, grants: { include: grantStudentSelect, orderBy: { grantedAt: 'asc' } } },
          orderBy: { name: 'asc' },
        }),
        prisma.tutorFile.findMany({
          where: { teacherId: user.id, OR: [{ name: { contains: q, mode: 'insensitive' } }, { contentText: { contains: q, mode: 'insensitive' } }] },
          include: fileInclude,
          orderBy: { name: 'asc' },
          take: 200,
        }),
      ])
      const opened = await loadOpens(folders.map(f => f.id), files.map(f => f.id))
      const libFiles = files.map(f => toFile(f, f.grants, opened))
      const { snippets } = await withContentMatches(libFiles, [], q)
      return NextResponse.json({
        folders: folders.map(f => toFolder(f, f._count.children + f._count.files, f.grants, opened)),
        files: libFiles.map(f => ({ ...f, contentMatch: snippets.get(f.id) ?? null })),
      })
    }

    const { folders, files } = await loadStudentVisibility(user.id)
    const lowerQ = q.toLowerCase()
    const countOf = studentItemCounter(folders, files)
    const all = files.map(f => toFile(f))
    const { matchedIds, snippets } = await withContentMatches([], all.map(f => f.id), q)
    const matched = new Set(matchedIds)
    return NextResponse.json({
      folders: folders.filter(f => f.name.toLowerCase().includes(lowerQ)).map(f => toFolder(f, countOf(f.id))),
      files: all
        .filter(f => f.name.toLowerCase().includes(lowerQ) || matched.has(f.id))
        .map(f => ({ ...f, contentMatch: snippets.get(f.id) ?? null })),
    })
  } catch (e) {
    console.error('[GET /api/tutor-files/search]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
