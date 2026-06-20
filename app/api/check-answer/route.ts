import { NextRequest, NextResponse } from 'next/server'
import { callAI, parseJSON } from '@/lib/openrouter'

export async function POST(req: NextRequest) {
  const { userAnswer, correctAnswer, question } = await req.json()

  if (!userAnswer?.trim() || !correctAnswer?.trim()) {
    return NextResponse.json({ ok: false, hint: null })
  }

  // Fast path: exact / case-insensitive match — no AI needed
  if (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
    return NextResponse.json({ ok: true, hint: null })
  }

  try {
    const raw = await callAI(
      'You are a lenient educational quiz checker. Return ONLY valid JSON, no markdown.',
      `Check if the student's answer is essentially correct.
Be LENIENT: accept typos, synonyms, different word forms, abbreviations, and partially correct phrasing.
Only mark WRONG if the meaning is clearly incorrect or completely off-topic.

${question ? `Question: ${question}\n` : ''}Correct answer: ${correctAnswer}
Student answer: ${userAnswer}

Return: {"ok": true/false, "hint": "short hint in the language of the question if wrong, otherwise null"}`,
      { temperature: 0 },
    )
    const parsed = parseJSON<{ ok: boolean; hint?: string | null }>(raw)
    return NextResponse.json({ ok: !!parsed.ok, hint: parsed.hint ?? null })
  } catch {
    // Fallback: fuzzy match on failure
    const a = userAnswer.trim().toLowerCase()
    const b = correctAnswer.trim().toLowerCase()
    const ok = a.includes(b) || b.includes(a)
    return NextResponse.json({ ok, hint: null })
  }
}
