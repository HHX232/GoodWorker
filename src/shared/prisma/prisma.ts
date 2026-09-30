import { PrismaClient } from '@prisma/client'

// TutorFile.contentText holds the whole extracted text of a library file (for
// search inside files) — never loaded unless a query opts in with
// `select: { contentText: true }` / `omit: { contentText: false }`.
function createClient() {
  return new PrismaClient({ omit: { tutorFile: { contentText: true } } })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
