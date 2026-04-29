import {prisma} from '@/shared/prisma/prisma'
import {NextRequest, NextResponse} from 'next/server'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000

interface Params {
  params: Promise<{id: string}>
}

export async function GET(_req: NextRequest, {params}: Params) {
  const {id} = await params

  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({where: {id}, select: {lastSeenAt: true}}),
    prisma.student.findUnique({where: {id}, select: {lastSeenAt: true}})
  ])

  const lastSeenAt = (teacher ?? student)?.lastSeenAt

  if (!lastSeenAt) {
    return NextResponse.json({online: false, lastSeenAt: null})
  }

  const online = Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
  return NextResponse.json({online, lastSeenAt: lastSeenAt.toISOString()})
}
