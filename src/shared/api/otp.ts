import { prisma } from "../prisma/prisma"

const isE2E = process.env.E2E_MODE === 'true'

function generateRandomInt(min: number, max: number): number {
  const range = max - min + 1
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  return min + (randomBytes[0] % range)
}

export function generateOtp(): string {
  if (isE2E) return '000000'
  return generateRandomInt(100000, 999999).toString()
}

export async function saveOtp(target: string, code: string) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  const finalCode = isE2E ? '000000' : code

  await prisma.otpCode.upsert({
    where: { target },
    update: { code: finalCode, expiresAt },
    create: { target, code: finalCode, expiresAt },
  })
}

export async function verifyOtp(target: string, code: string): Promise<boolean> {
  if (isE2E) return true

  const otp = await prisma.otpCode.findUnique({ where: { target } })

  if (!otp) return false
  if (otp.code !== code) return false
  if (otp.expiresAt < new Date()) {
    await prisma.otpCode.delete({ where: { target } })
    return false
  }

  await prisma.otpCode.delete({ where: { target } })
  return true
}

export async function sendOtp(target: string, code: string) {
  console.log(`[OTP] ${target} → ${code}`)

  const serviceUrl = process.env.PDF_SERVICE_URL
  const serviceKey = process.env.PDF_SERVICE_KEY

  if (!serviceUrl || !serviceKey) {
    console.warn('[OTP] PDF_SERVICE_URL / PDF_SERVICE_KEY not set — email not sent')
    return
  }

  try {
    const res = await fetch(`${serviceUrl.replace(/\/$/, '')}/api/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': serviceKey },
      body: JSON.stringify({ to: target, code, appName: 'GoodWorker' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[OTP] Email service error:', err)
    }
  } catch (e) {
    console.error('[OTP] Failed to reach email service:', e)
  }
}