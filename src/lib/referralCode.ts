import { prisma } from '@/shared/prisma/prisma'
import crypto from 'crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion

function randomCode(length = 7) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

// Returns the user's existing referral code, generating and persisting a unique one on first call.
export async function getOrCreateReferralCode(userId: string, role: 'TEACHER' | 'STUDENT'): Promise<string> {
  const existing = role === 'TEACHER'
    ? await prisma.teacher.findUnique({ where: { id: userId }, select: { referralCode: true } })
    : await prisma.student.findUnique({ where: { id: userId }, select: { referralCode: true } })
  if (existing?.referralCode) return existing.referralCode

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    try {
      if (role === 'TEACHER') {
        await prisma.teacher.update({ where: { id: userId }, data: { referralCode: code } })
      } else {
        await prisma.student.update({ where: { id: userId }, data: { referralCode: code } })
      }
      return code
    } catch {
      // unique constraint collision — retry with a new code
    }
  }
  throw new Error('Failed to generate a unique referral code')
}

export async function findReferralOwner(
  code: string,
): Promise<{ id: string; role: 'TEACHER' | 'STUDENT' } | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  const teacher = await prisma.teacher.findUnique({ where: { referralCode: normalized }, select: { id: true } })
  if (teacher) return { id: teacher.id, role: 'TEACHER' }

  const student = await prisma.student.findUnique({ where: { referralCode: normalized }, select: { id: true } })
  if (student) return { id: student.id, role: 'STUDENT' }

  return null
}

export async function getReferralSettings() {
  return prisma.referralSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global' },
  })
}
