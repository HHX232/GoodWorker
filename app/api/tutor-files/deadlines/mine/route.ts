import { NextResponse } from 'next/server'
import { getFilesSessionUser, loadStudentVisibility } from '@/shared/lib/tutorFiles/access'

// GET /api/tutor-files/deadlines/mine — the student's own view of the same
// submission dropboxes: due date, and whether/when they've already submitted.
// Reuses loadStudentVisibility() (the one loader for what a student may see)
// rather than re-deriving folder visibility here.
export async function GET() {
  try {
    const user = await getFilesSessionUser()
    if (!user || user.role !== 'STUDENT') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { folders, files } = await loadStudentVisibility(user.id)
    const dropboxes = folders.filter(f => f.submissionDeadline !== null)

    const deadlines = dropboxes.map(dropbox => {
      const mySubfolder = folders.find(f => f.parentId === dropbox.id && f.restrictedToStudentId === user.id)
      const mySubmission = mySubfolder
        ? files.filter(f => f.folderId === mySubfolder.id && f.uploadedByRole === 'STUDENT').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
        : undefined
      return {
        folderId: dropbox.id,
        folderName: dropbox.name,
        deadline: dropbox.submissionDeadline!.toISOString(),
        submitted: !!mySubmission,
        submittedAt: mySubmission ? mySubmission.createdAt.toISOString() : null,
        late: !!mySubmission && mySubmission.createdAt > dropbox.submissionDeadline!,
      }
    })

    return NextResponse.json({ deadlines })
  } catch (e) {
    console.error('[GET /api/tutor-files/deadlines/mine]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
