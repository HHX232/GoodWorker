const MODEL = 'openrouter/free'
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goodworker.ru'
const TIMEOUT_MS = 120_000

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.1,
    response_format: { type: 'json_object' },
    stream: true,
  })

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': SITE_URL,
    'X-Title': 'GoodWorker',
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    // Manual AbortController is more reliable than AbortSignal.timeout()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`OpenRouter timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers, body, signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      if (attempt < 2) {
        await sleep(3000 * (attempt + 1))
        continue
      }
      throw new Error(`OpenRouter network error: ${(err as Error).message}`)
    }

    if (res.status === 429) {
      clearTimeout(timer)
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      const text = await res.text()
      throw new Error(`OpenRouter 429 (rate limit): ${text}`)
    }

    if (!res.ok) {
      clearTimeout(timer)
      const text = await res.text()
      throw new Error(`OpenRouter ${res.status}: ${text}`)
    }

    // Stream the response — keeps the TCP connection alive through NAT devices
    // and lets us enforce the timeout even if the model stalls mid-generation.
    try {
      const content = await readStream(res)
      clearTimeout(timer)
      if (!content) throw new Error('OpenRouter returned empty content')
      return content
    } catch (err) {
      clearTimeout(timer)
      const msg = (err as Error).message ?? ''
      if (attempt < 2 && (msg.includes('timed out') || msg.includes('abort') || msg.includes('TIMEOUT'))) {
        await sleep(3000 * (attempt + 1))
        continue
      }
      throw err
    }
  }

  throw new Error('OpenRouter: all retries exhausted')
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let content = ''
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return content
      try {
        const parsed = JSON.parse(data)
        content += parsed.choices?.[0]?.delta?.content ?? ''
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  return content
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export function parseJSON<T>(raw: string): T {
  const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(clean) as T
}
