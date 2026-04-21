import { NextRequest } from 'next/server'
import { prisma } from '../prisma/prisma'

interface RateLimitOptions {
  max: number
  windowMs: number 
}

export async function checkRateLimit(key: string, opts: RateLimitOptions): Promise<boolean> {
  const now = new Date()

  const record = await prisma.rateLimit.findUnique({ where: { key } })

  if (record && record.resetAt < now) {
    await prisma.rateLimit.update({
      where: { key },
      data: { count: 1, resetAt: new Date(now.getTime() + opts.windowMs) },
    })
    return true
  }

  if (record && record.count >= opts.max) {
    return false
  }

  await prisma.rateLimit.upsert({
    where: { key },
    update: { count: { increment: 1 } },
    create: { key, count: 1, resetAt: new Date(now.getTime() + opts.windowMs) },
  })

  return true
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  )
}

export const limits = {
  ip:     (ip: string)     => checkRateLimit(`ip:${ip}`,         { max: 10, windowMs: 15 * 60 * 1000 }),
  target: (target: string) => checkRateLimit(`target:${target}`, { max: 3,  windowMs: 15 * 60 * 1000 }),
  verify: (ip: string)     => checkRateLimit(`verify:${ip}`,     { max: 5,  windowMs: 15 * 60 * 1000 }),
}