import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { callAI, parseJSON } from '@/lib/openrouter'

function extractTiptapText(content: unknown): string {
  const c = content as { content?: { content?: { text?: string }[] }[] } | null
  if (!c?.content) return ''
  return c.content
    .flatMap((p) => p.content ?? [])
    .map((n) => (n as { text?: string }).text ?? '')
    .join(' ')
}

interface SummarizableBlock {
  type?: string
  payload?: {
    question?: string
    pairs?: {left?: string; right?: string}[]
    content?: unknown
  }
}

function summarizeBlocks(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return ''
  return (blocks as SummarizableBlock[])
    .slice(0, 12)
    .map((b) => {
      const p = b?.payload ?? {}
      switch (b?.type) {
        case 'CHOOSE_OPTION':
        case 'FREE_ANSWER':
          return p.question ?? ''
        case 'MATCH_PAIRS':
          return (p.pairs ?? []).map((pair) => `${pair.left} — ${pair.right}`).join('; ')
        case 'INFO_TEXT':
          return extractTiptapText(p.content)
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { theme, description, blocks, avoid } = await req.json()
    const content = summarizeBlocks(blocks)
    if (!content.trim()) {
      return NextResponse.json({ error: 'Добавьте хотя бы один блок, чтобы придумать название' }, { status: 400 })
    }

    const avoidNote = avoid
      ? `\nDo NOT reuse this exact title — pick a clearly different alternative: "${avoid}"`
      : ''

    const prompt = `Generate a short, specific title (3-8 words) for a test/quiz on an e-learning platform, based on its content below. Detect the language of the content and write the title in that same language.${avoidNote}

Theme/topic hint: ${theme || '(none given)'}
Description: ${description || '(none given)'}

Content:
${content}

Return ONLY a valid JSON object: {"title": "..."}`

    const { content: raw } = await callAI(
      'You are a concise, expert namer of educational test/quiz titles. Return ONLY valid JSON, no markdown.',
      prompt,
      { temperature: 0.6, maxTokens: 60 },
    )
    const parsed = parseJSON<{ title?: string }>(raw)
    const title = (parsed.title ?? '').trim()

    if (!title) return NextResponse.json({ error: 'AI вернул пустое название' }, { status: 502 })

    return NextResponse.json({ title })
  } catch (error) {
    console.error('[POST /api/tests/generate-title]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
