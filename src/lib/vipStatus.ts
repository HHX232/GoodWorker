import { prisma } from '@/shared/prisma/prisma'

export async function resolveVip(email: string): Promise<boolean> {
  const now = new Date()
  const teacher = await prisma.teacher.findUnique({ where: { email }, select: { isVip: true, vipExpiresAt: true } })
  if (teacher) return teacher.isVip && (!teacher.vipExpiresAt || teacher.vipExpiresAt > now)
  const student = await prisma.student.findUnique({ where: { email }, select: { isVip: true, vipExpiresAt: true } })
  if (student) return student.isVip && (!student.vipExpiresAt || student.vipExpiresAt > now)
  return false
}
