import { getStudentDriveLimits, getStudentUsedBytes } from '@/shared/lib/studentDrive/drive'
import { getTeacherStorageLimits, getUsedBytes } from '@/shared/lib/tutorFiles/storage'

/** Room left in the owner's storage — the student's drive quota, or the tutor's library quota. */
export async function ownerFreeBytes(ownerId: string, ownerRole: 'STUDENT' | 'TEACHER'): Promise<number> {
  if (ownerRole === 'STUDENT') {
    const [{ quotaBytes }, used] = await Promise.all([getStudentDriveLimits(), getStudentUsedBytes(ownerId)])
    return quotaBytes - used
  }
  const [{ quotaBytes }, used] = await Promise.all([getTeacherStorageLimits(ownerId), getUsedBytes(ownerId)])
  return quotaBytes - used
}
