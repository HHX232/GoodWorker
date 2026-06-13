const DEEPSEEK_MODEL    = 'deepseek-chat'
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'

const OR_MODEL    = 'openrouter/free'
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goodworker.ru'
const TIMEOUT_MS  = 120_000

type Provider = 'deepseek' | 'openrouter'

function getProvider(): Provider {
  return process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openrouter'
}

function buildRequest(systemPrompt: string, userPrompt: string, opts: { temperature?: number }): { endpoint: string; headers: Record<string, string>; body: string } {
  const provider = getProvider()

  if (provider === 'deepseek') {
    return {
      endpoint: DEEPSEEK_ENDPOINT,
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: opts.temperature ?? 0.1,
        response_format: { type: 'json_object' },
        stream: true,
      }),
    }
  }

  return {
    endpoint: OR_ENDPOINT,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': 'GoodWorker',
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: opts.temperature ?? 0.1,
      response_format: { type: 'json_object' },
      stream: true,
    }),
  }
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number } = {},
): Promise<string> {
  const provider = getProvider()
  if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set')
  if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const { endpoint, headers, body } = buildRequest(systemPrompt, userPrompt, opts)

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`AI timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      if (attempt < 2) { await sleep(3000 * (attempt + 1)); continue }
      throw new Error(`${provider} network error: ${(err as Error).message}`)
    }

    if (res.status === 429) {
      clearTimeout(timer)
      if (attempt < 2) { await sleep(2000 * (attempt + 1)); continue }
      const text = await res.text()
      throw new Error(`${provider} 429 (rate limit): ${text}`)
    }

    if (!res.ok) {
      clearTimeout(timer)
      const text = await res.text()
      throw new Error(`${provider} ${res.status}: ${text}`)
    }

    try {
      const content = await readStream(res)
      clearTimeout(timer)
      if (!content) throw new Error(`${provider} returned empty content`)
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

  throw new Error(`${provider}: all retries exhausted`)
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

export function hasAIProvider(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY)
}

export function parseJSON<T>(raw: string): T {
  const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(clean) as T
}
