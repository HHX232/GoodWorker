const DEEPSEEK_MODEL        = 'deepseek-chat'
const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp'
const DEEPSEEK_ENDPOINT     = 'https://api.deepseek.com/chat/completions'

const OR_MODEL    = 'openrouter/free'
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goodworker.ru'
const TIMEOUT_MS  = 120_000

type Provider = 'deepseek' | 'openrouter'

// Real per-call token usage, captured from DeepSeek's final SSE chunk
// (`stream_options: {include_usage: true}`) — the input to wallet/pricing.ts's
// computeCostCents(). null when the provider didn't return usage at all (the
// free OpenRouter fallback, or a malformed/missing usage field) — callers
// then treat the call's cost as $0, never guess.
export type AIUsage = {
  promptCacheHitTokens: number
  promptCacheMissTokens: number
  completionTokens: number
} | null

export type AIResult = { content: string; usage: AIUsage }

function getProvider(): Provider {
  return process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openrouter'
}

function buildRequest(systemPrompt: string, userPrompt: string, opts: { temperature?: number; maxTokens?: number }): { endpoint: string; headers: Record<string, string>; body: string } {
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
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        response_format: { type: 'json_object' },
        stream: true,
        stream_options: { include_usage: true },
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
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      response_format: { type: 'json_object' },
      stream: true,
    }),
  }
}

export type VisionImage = { mimeType: string; base64: string }

function buildVisionRequest(
  systemPrompt: string,
  images: VisionImage[],
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number },
): { endpoint: string; headers: Record<string, string>; body: string } {
  return {
    endpoint: DEEPSEEK_ENDPOINT,
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_VISION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
          ],
        },
      ],
      temperature: opts.temperature ?? 0.1,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      response_format: { type: 'json_object' },
      stream: true,
      stream_options: { include_usage: true },
    }),
  }
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AIResult> {
  const provider = getProvider()
  if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set')
  if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const { endpoint, headers, body } = buildRequest(systemPrompt, userPrompt, opts)
  const promptPreview = userPrompt.slice(0, 120).replace(/\n/g, ' ')
  console.log(`[AI] provider=${provider} prompt="${promptPreview}..."`)

  const result = await sendChatRequest(endpoint, headers, body, provider)
  // The free OpenRouter fallback isn't asked for usage and its cost is
  // unknown/uncharged either way — never surface a stray usage value for it.
  return provider === 'deepseek' ? result : { content: result.content, usage: null }
}

// DeepSeek-only: the free OpenRouter fallback model has no vision support, so
// this feature is simply unavailable when DEEPSEEK_API_KEY isn't configured.
export async function callVisionAI(
  systemPrompt: string,
  images: VisionImage[],
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<AIResult> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set — photo analysis requires the DeepSeek vision model')

  const { endpoint, headers, body } = buildVisionRequest(systemPrompt, images, userPrompt, opts)
  console.log(`[AI] provider=deepseek-vision images=${images.length}`)

  return sendChatRequest(endpoint, headers, body, 'deepseek-vision')
}

async function sendChatRequest(endpoint: string, headers: Record<string, string>, body: string, providerLabel: string): Promise<AIResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`AI timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    const t0 = Date.now()

    let res: Response
    try {
      res = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      console.warn(`[AI] attempt=${attempt + 1} network error: ${(err as Error).message}`)
      if (attempt < 2) { await sleep(3000 * (attempt + 1)); continue }
      throw new Error(`${providerLabel} network error: ${(err as Error).message}`)
    }

    if (res.status === 429) {
      clearTimeout(timer)
      console.warn(`[AI] attempt=${attempt + 1} rate limited (429)`)
      if (attempt < 2) { await sleep(2000 * (attempt + 1)); continue }
      const text = await res.text()
      throw new Error(`${providerLabel} 429 (rate limit): ${text}`)
    }

    if (!res.ok) {
      clearTimeout(timer)
      const text = await res.text()
      console.error(`[AI] attempt=${attempt + 1} HTTP ${res.status}: ${text.slice(0, 200)}`)
      throw new Error(`${providerLabel} ${res.status}: ${text}`)
    }

    try {
      const { content, usage } = await readStream(res)
      clearTimeout(timer)
      if (!content) throw new Error(`${providerLabel} returned empty content`)
      console.log(`[AI] ok attempt=${attempt + 1} ms=${Date.now() - t0} chars=${content.length}`)
      return { content, usage }
    } catch (err) {
      clearTimeout(timer)
      const msg = (err as Error).message ?? ''
      console.warn(`[AI] attempt=${attempt + 1} stream error: ${msg}`)
      if (attempt < 2 && (msg.includes('timed out') || msg.includes('abort') || msg.includes('TIMEOUT'))) {
        await sleep(3000 * (attempt + 1))
        continue
      }
      throw err
    }
  }

  throw new Error(`${providerLabel}: all retries exhausted`)
}

async function readStream(res: Response): Promise<AIResult> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let content = ''
  let buf = ''
  let usage: AIUsage = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return { content, usage }
      try {
        const parsed = JSON.parse(data)
        content += parsed.choices?.[0]?.delta?.content ?? ''
        // Final SSE chunk (from stream_options.include_usage) carries a
        // `usage` object instead of a `choices[].delta` — DeepSeek splits
        // prompt tokens into cache hit/miss; when it doesn't, the whole
        // prompt_tokens counts as cache-miss (worse case, never cheaper
        // than reality).
        if (parsed.usage) {
          const u = parsed.usage
          const hit = typeof u.prompt_cache_hit_tokens === 'number' ? u.prompt_cache_hit_tokens : 0
          const miss = typeof u.prompt_cache_miss_tokens === 'number'
            ? u.prompt_cache_miss_tokens
            : (typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0)
          const completion = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0
          usage = { promptCacheHitTokens: hit, promptCacheMissTokens: miss, completionTokens: completion }
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  return { content, usage }
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
