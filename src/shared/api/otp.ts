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

export async function sendOtp(
  target: string,
  code: string,
  langCode: string = 'ru'
): Promise<boolean> {
  forceLog('=== SEND OTP START ===', {
    target,
    code,
    langCode,
  })

  const apiKey = process.env.SENDCOREX_API_KEY

  if (!apiKey) {
    forceLog('[OTP] SENDCOREX_API_KEY not set')
    return false
  }

  const translations: Record<
    string,
    {
      subject: string
      title: string
      label: string
      note: string
    }
  > = {
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
      note: 'The code is valid for 15 minutes.',
    },
    zh: {
      subject: '您的验证码',
      title: '验证码',
      label: '您的一次性验证码：',
      note: '验证码有效期15分钟。',
    },
    hi: {
      subject: 'आपका सत्यापन कोड',
      title: 'सत्यापन कोड',
      label: 'आपका एकल-उपयोग कोड:',
      note: 'कोड 15 मिनट तक मान्य है।',
    },
  }

  const lang = translations[langCode] ?? translations.ru

  try {
    forceLog('[OTP] Sending request...')

    const res = await fetch(
      'https://graph.sendcorex.com/v3.0/mail/send',
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: target,
          subject: lang.subject,
          body: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2>${lang.title}</h2>
              <p>${lang.label}</p>

              <div style="
                font-size:36px;
                font-weight:bold;
                letter-spacing:8px;
                color:#2563eb;
              ">
                ${code}
              </div>

              <p style="color:#6b7280">
                ${lang.note}
              </p>
          </div>
          `,
          from: 'hello.user@sendcorex.com',
          senderName: 'GoodWorker',
        }),
      }
    )

    let data = {}

    try {
      data = await res.json()
    } catch {
      forceLog('[OTP] Response is not JSON')
    }

    forceLog('[OTP] Response received', {
      status: res.status,
      ok: res.ok,
      data,
    })

    switch (res.status) {
      case 200: {
        const result = data as {
          success?: boolean
          id?: string
          message?: string
        }

        if (result.success) {
          forceLog('[OTP] Email queued successfully', {
            id: result.id,
            message: result.message,
          })

          return true
        }

        forceLog('[OTP] 200 but success=false', result)

        return false
      }

      case 400: {
        forceLog('[OTP] Bad request', data)

        const err = data as {
          error?: string
          code?: string
        }

        switch (err.code) {
          case 'MISSING_TOADDRESS':
            forceLog(
              '[OTP] Recipient email missing'
            )
            break

          default:
            forceLog(
              '[OTP] Unknown validation error',
              err
            )
        }

        return false
      }

      case 401: {
        forceLog(
          '[OTP] Invalid API key',
          data
        )

        return false
      }

      case 403: {
        forceLog(
          '[OTP] Access denied',
          data
        )

        return false
      }

      case 429: {
        forceLog(
          '[OTP] Rate limit exceeded',
          data
        )

        return false
      }

      case 500: {
        forceLog(
          '[OTP] Sendcorex internal error',
          data
        )

        return false
      }

      default: {
        forceLog(
          '[OTP] Unexpected status',
          {
            status: res.status,
            data,
          }
        )

        return false
      }
    }
  } catch (error) {
    forceLog(
      '[OTP] Network / fetch failed',
      error
    )

    return false
  }
}