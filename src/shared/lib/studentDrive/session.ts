import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'

/** Only a student has a drive; tutors keep using their tutor library. */
export async function getDriveStudentId(): Promise<string | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return session.user.id
}
