// Every AI request in the app goes to DeepSeek — text via `deepseek-chat`,
// photos via the vision model. There is deliberately no fallback provider:
// without DEEPSEEK_API_KEY a call fails loudly instead of silently switching.
const DEEPSEEK_MODEL        = 'deepseek-chat'
const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp'
const DEEPSEEK_ENDPOINT     = 'https://api.deepseek.com/chat/completions'
const TIMEOUT_MS  = 120_000

// `json: false` drops response_format so the model can answer in plain
// text / markdown (e.g. lecture notes); default stays JSON for older callers.
type CallOpts = { temperature?: number; maxTokens?: number; json?: boolean; onUsage?: (usage: AIUsage) => void }

export interface AIUsage { promptTokens: number; completionTokens: number }

function deepseekHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

function buildRequest(systemPrompt: string, userPrompt: string, opts: CallOpts): { endpoint: string; headers: Record<string, string>; body: string } {
  return {
    endpoint: DEEPSEEK_ENDPOINT,
    headers: deepseekHeaders(),
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: opts.temperature ?? 0.1,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json === false ? {} : { response_format: { type: 'json_object' } }),
      stream: true,
      stream_options: { include_usage: true },
    }),
  }
}

export type VisionImage = { mimeType: string; base64: string }

function buildVisionRequest(
  systemPrompt: string,
  images: VisionImage[],
  userPrompt: string,
  opts: CallOpts,
): { endpoint: string; headers: Record<string, string>; body: string } {
  return {
    endpoint: DEEPSEEK_ENDPOINT,
    headers: deepseekHeaders(),
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
      ...(opts.json === false ? {} : { response_format: { type: 'json_object' } }),
      stream: true,
      stream_options: { include_usage: true },
    }),
  }
}

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  opts: CallOpts = {},
): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set')

  const { endpoint, headers, body } = buildRequest(systemPrompt, userPrompt, opts)
  const promptPreview = userPrompt.slice(0, 120).replace(/\n/g, ' ')
  console.log(`[AI] provider=deepseek prompt="${promptPreview}..."`)

  return sendChatRequest(endpoint, headers, body, 'deepseek', opts.onUsage)
}

export async function callVisionAI(
  systemPrompt: string,
  images: VisionImage[],
  userPrompt: string,
  opts: CallOpts = {},
): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY is not set — photo analysis requires the DeepSeek vision model')

  const { endpoint, headers, body } = buildVisionRequest(systemPrompt, images, userPrompt, opts)
  console.log(`[AI] provider=deepseek-vision images=${images.length}`)

  return sendChatRequest(endpoint, headers, body, 'deepseek-vision', opts.onUsage)
}

async function sendChatRequest(endpoint: string, headers: Record<string, string>, body: string, providerLabel: string, onUsage?: (usage: AIUsage) => void): Promise<string> {
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
      const content = await readStream(res, onUsage)
      clearTimeout(timer)
      if (!content) throw new Error(`${providerLabel} returned empty content`)
      console.log(`[AI] ok attempt=${attempt + 1} ms=${Date.now() - t0} chars=${content.length}`)
      return content
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

async function readStream(res: Response, onUsage?: (usage: AIUsage) => void): Promise<string> {
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
        // With stream_options.include_usage the last chunk carries the totals.
        if (parsed.usage && onUsage) onUsage({ promptTokens: parsed.usage.prompt_tokens ?? 0, completionTokens: parsed.usage.completion_tokens ?? 0 })
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
  return !!process.env.DEEPSEEK_API_KEY
}

export function parseJSON<T>(raw: string): T {
  const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(clean) as T
}
