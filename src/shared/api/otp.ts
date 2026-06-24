import { prisma } from "../prisma/prisma"

const isE2E = process.env.E2E_MODE === 'true'

function generateRandomInt(min: number, max: number): number {
  const range = max - min + 1
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  return min + (randomBytes[0] % range)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forceLog(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${message}`;
  
  // Тройное логирование для гарантии
  console.log(output);
  console.error(output);
  process.stdout.write(output + '\n');
  
  // Принудительный сброс буфера
  if (process.stdout._handle) {
    process.stdout._handle.setBlocking(true);
  }
}

export function generateOtp(): string {
  if (isE2E) return '000000'
  return generateRandomInt(100000, 999999).toString()
}

export async function saveOtp(target: string, code: string) {
   forceLog('=== SAVE OTP START ===', { target, code, isE2E });
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  const finalCode = isE2E ? '000000' : code
  forceLog('we save new OTP', { target, finalCode, expiresAt: expiresAt.toISOString() })

  await prisma.otpCode.upsert({
    where: { target },
    update: { code: finalCode, expiresAt },
    create: { target, code: finalCode, expiresAt },
  })
  
}

export async function verifyOtp(target: string, code: string): Promise<boolean> {
   forceLog('=== VERIFY OTP START ===', { target, code, isE2E });
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

export async function sendOtp(target: string, code: string, langCode: string = 'ru') {
    forceLog('=== SEND OTP START 222===', { target, code, langCode });
  console.log(`[OTP] ${target} → ${code}`)

  const apiKey = process.env.SENDCOREX_API_KEY

  if (!apiKey) {
    console.warn('[OTP] SENDCOREX_API_KEY not set — email not sent')
    return
  }

  const translations: Record<string, { subject: string; title: string; label: string; note: string }> = {
    ru: {
      subject: 'Ваш код подтверждения',
      title: 'Код подтверждения',
      label: 'Ваш одноразовый код:',
      note: 'Код действителен 15 минут. Никому не сообщайте его.',
    },
    en: {
      subject: 'Your verification code',
      title: 'Verification Code',
      label: 'Your one-time code:',
      note: 'The code is valid for 15 minutes. Do not share it with anyone.',
    },
    zh: {
      subject: '您的验证码',
      title: '验证码',
      label: '您的一次性验证码：',
      note: '验证码有效期为15分钟，请勿告知他人。',
    },
    hi: {
      subject: 'आपका सत्यापन कोड',
      title: 'सत्यापन कोड',
      label: 'आपका एकल-उपयोग कोड:',
      note: 'कोड 15 मिनट के लिए वैध है। इसे किसी के साथ साझा न करें।',
    },
  }

  const lang = translations[langCode] ?? translations['ru']

  try {
    const res = await fetch('https://graph.sendcorex.com/v3.0/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: target,
        subject: lang.subject,
        body: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>${lang.title}</h2>
            <p>${lang.label}</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
              ${code}
            </div>
            <p style="color: #6b7280; font-size: 14px;">${lang.note}</p>
          </div>
        `,
        from: 'hello.user@sendcorex.com',
        senderName: 'GoodWorker',
      }),
    })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { id, success } = (res as any).data;
    if (!success) {
      const err = await res?.json()?.catch(() => ({}))
      console.error('[OTP] Sendcorex error:', err)
    }
  } catch (e) {
    console.error('[OTP] Failed to reach Sendcorex:', e)
  }
}