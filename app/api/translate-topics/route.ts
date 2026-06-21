import { prisma } from '@/shared/prisma/prisma'
import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Translate a batch of topics using Claude claude-haiku-4-5 (cheapest, fast)
async function translateBatch(texts: string[], targetLang: string): Promise<string[]> {
  if (!ANTHROPIC_API_KEY) return texts

  const langNames: Record<string, string> = {
    en: 'English', zh: 'Chinese', hi: 'Hindi', ru: 'Russian',
  }
  const langName = langNames[targetLang] ?? targetLang
  const prompt = texts.map((t, i) => `${i + 1}. ${t}`).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Translate these topic names to ${langName}. Return only numbered translations, one per line. Keep concise.\n\n${prompt}`,
        },
      ],
    }),
  })

  if (!res.ok) return texts
  const data = await res.json()
  const raw: string = data?.content?.[0]?.text ?? ''
  const lines = raw.split('\n').map((l: string) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
  return lines.length === texts.length ? lines : texts
}

export async function POST(req: NextRequest) {
  try {
    const { topics, langCode }: { topics: string[]; langCode: string } = await req.json()

    if (!topics?.length || !langCode) {
      return NextResponse.json({ error: 'Missing topics or langCode' }, { status: 400 })
    }

    // Russian → no translation needed
    if (langCode === 'ru') {
      return NextResponse.json({ translations: topics })
    }

    // Check cache for all topics
    const cached = await prisma.topicTranslation.findMany({
      where: { original: { in: topics }, langCode },
      select: { original: true, translation: true },
    })

    const cacheMap = new Map(cached.map(r => [r.original, r.translation]))
    const missing = topics.filter(t => !cacheMap.has(t))

    if (missing.length > 0) {
      // Translate missing in one batch call
      const translations = await translateBatch(missing, langCode)

      const rows = missing.map((orig, i) => ({
        original: orig,
        langCode,
        translation: translations[i] ?? orig,
      }))

      // Save to cache (upsert to avoid race)
      await Promise.all(
        rows.map(r =>
          prisma.topicTranslation.upsert({
            where: { original_langCode: { original: r.original, langCode: r.langCode } },
            update: { translation: r.translation },
            create: r,
          })
        )
      )

      rows.forEach(r => cacheMap.set(r.original, r.translation))
    }

    const translations = topics.map(t => cacheMap.get(t) ?? t)
    return NextResponse.json({ translations })
  } catch (e) {
    console.error('[translate-topics]', e)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
