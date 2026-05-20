import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAICacheManager } from '@google/generative-ai/server'
import { prisma } from '@/shared/prisma/prisma'
import type { CategoryRef } from '@/shared/lib/gemini'
import type { Prisma } from '@prisma/client'

const LANGS = ['ru', 'en', 'hi', 'zh'] as const
type Lang = typeof LANGS[number]

// ─── Category cache (same pattern as gemini.ts) ───────────────────────────────

interface CacheEntry {
  name: string
  hash: string
  expireAt: number
}

let _cache: CacheEntry | null = null
const CACHE_TTL_SECONDS = 3600
const CACHE_REFRESH_BEFORE_MS = 5 * 60 * 1000

function hashCategories(cats: CategoryRef[]): string {
  return cats.map(c => `${c.id}:${c.name}`).sort().join('|')
}

const SYSTEM_INSTRUCTION = `
You are a multilingual translation and categorization assistant for an educational platform.
Given a post title, optional subtitle, and text blocks — translate them to all four languages: ru, en, hi, zh.
Also pick the single best matching category from the provided list.
Return ONLY valid JSON, no markdown.
`.trim()

async function getModel(cats: CategoryRef[]) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const genAI = new GoogleGenerativeAI(apiKey)
  const cacheManager = new GoogleAICacheManager(apiKey)
  const hash = hashCategories(cats)
  const now = Date.now()

  if (_cache && _cache.hash === hash && _cache.expireAt > now) {
    try {
      const cached = await cacheManager.get(_cache.name)
      return genAI.getGenerativeModelFromCachedContent(cached)
    } catch {
      _cache = null
    }
  }

  if (_cache) {
    try { await cacheManager.delete(_cache.name) } catch {}
    _cache = null
  }

  const categoriesBlock = cats.map(c => `  - id="${c.id}" name="${c.name}"`).join('\n')

  try {
    const created = await cacheManager.create({
      model: 'models/gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Available categories:\n${categoriesBlock}\n\nRemember these.` }],
        },
        {
          role: 'model',
          parts: [{ text: 'Categories remembered. Ready to translate and categorize posts.' }],
        },
      ],
      ttlSeconds: CACHE_TTL_SECONDS,
    })

    _cache = {
      name: created.name!,
      hash,
      expireAt: now + CACHE_TTL_SECONDS * 1000 - CACHE_REFRESH_BEFORE_MS,
    }

    return genAI.getGenerativeModelFromCachedContent(created)
  } catch {
    return genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTextBlocks(content: unknown): { index: number; text: string }[] {
  const c = content as { blocks?: { type: string; payload?: { text?: string } }[] } | null
  if (!c?.blocks) return []
  return c.blocks
    .map((b, i) => ({ index: i, text: b.type === 'TEXT' ? (b.payload?.text ?? '') : '' }))
    .filter(b => b.text.trim().length > 0)
}

function applyTextTranslations(
  content: unknown,
  translations: { index: number; [k: string]: string | number }[],
  lang: Lang,
): unknown {
  const c = content as { blocks?: unknown[] } | null
  if (!c?.blocks) return c
  const blocks = c.blocks.map((block, idx) => {
    const b = block as { type: string; payload?: { text?: string } }
    if (b.type !== 'TEXT' || !b.payload?.text) return block
    const t = translations.find(x => x.index === idx)
    if (!t) return block
    return { ...b, payload: { ...b.payload, text: (t[lang] as string) ?? b.payload.text } }
  })
  return { ...c, blocks }
}

// ─── Main enrichment function ─────────────────────────────────────────────────

export async function enrichPostWithAI(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post) return

  const categoriesRaw = await prisma.category.findMany({
    where: { levelNumber: 1 },
    include: { translations: { where: { langCode: 'ru' } } },
    take: 60,
  })
  const cats: CategoryRef[] = categoriesRaw.map(c => ({
    id: c.id,
    name: c.translations[0]?.name ?? c.slug,
  }))

  const textBlocks = extractTextBlocks(post.content)
  const blocksJson = JSON.stringify(
    textBlocks.slice(0, 20).map(b => ({ index: b.index, text: b.text }))
  )

  const prompt = `Translate this educational post to ru, en, hi, zh and pick the best category.
Also evaluate content safety: flag as unsafe ONLY if the post clearly contains spam, adult/sexual content,
hate speech, violence promotion, scams, or illegal activities.
Educational discussion of sensitive topics is acceptable.

Title: ${JSON.stringify(post.title)}
AdditionalTitle: ${post.additionalTitle ? JSON.stringify(post.additionalTitle) : 'null'}
TextBlocks: ${blocksJson}

Return exactly this JSON structure:
{
  "titleTranslations": {"ru":"...","en":"...","hi":"...","zh":"..."},
  "additionalTitleTranslations": ${post.additionalTitle ? '{"ru":"...","en":"...","hi":"...","zh":"..."}' : 'null'},
  "textBlockTranslations": [{"index":0,"ru":"...","en":"...","hi":"...","zh":"..."}],
  "suggestedCategoryId": "<id or null>",
  "contentOk": true,
  "contentReason": null
}`

  const model = await getModel(cats)
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const raw = result.response.text().trim()
  const jsonStr = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(jsonStr)

  const contentOk: boolean = parsed.contentOk !== false
  const contentTranslations: Record<string, unknown> = {}
  for (const lang of LANGS) {
    contentTranslations[lang] = applyTextTranslations(
      post.content,
      parsed.textBlockTranslations ?? [],
      lang,
    )
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      titleTranslations: (parsed.titleTranslations ?? undefined) as Prisma.InputJsonValue | undefined,
      additionalTitleTranslations: (parsed.additionalTitleTranslations ?? undefined) as Prisma.InputJsonValue | undefined,
      contentTranslations: contentTranslations as Prisma.InputJsonValue,
      aiModerated: true,
      aiModerationOk: contentOk,
      ...(!post.categoryId && parsed.suggestedCategoryId
        ? { categoryId: parsed.suggestedCategoryId }
        : {}),
      ...(contentOk === false ? { moderationStatus: 'BLOCKED' as const } : {}),
    },
  })
}

// ─── Comment translation ──────────────────────────────────────────────────────

export async function enrichCommentWithAI(commentId: string): Promise<void> {
  const comment = await prisma.postComment.findUnique({ where: { id: commentId } })
  if (!comment || !comment.text.trim()) return

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: `Translate this comment to ru, en, hi, zh. Return ONLY JSON: {"ru":"...","en":"...","hi":"...","zh":"..."}\n\nComment: ${JSON.stringify(comment.text)}` }],
    }],
  })

  const raw = result.response.text().trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
  const parsed = JSON.parse(raw)

  await prisma.postComment.update({
    where: { id: commentId },
    data: { textTranslations: parsed },
  })
}

export function localizeComment<T extends {
  text: string
  textTranslations?: unknown
}>(comment: T, lang: string): T {
  const l = (LANGS as readonly string[]).includes(lang) ? lang : 'ru'
  const tt = comment.textTranslations as Record<string, string> | null | undefined
  return { ...comment, text: tt?.[l] ?? comment.text }
}

// ─── Service AI ───────────────────────────────────────────────────────────────

export async function enrichServiceWithAI(serviceId: string): Promise<void> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service || !service.title.trim()) return

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const prompt = `Translate this teacher service listing to ru, en, hi, zh for an educational platform.
Return ONLY valid JSON, no markdown.

Title: ${JSON.stringify(service.title)}
Description: ${service.description ? JSON.stringify(service.description) : 'null'}

Return:
{
  "titleTranslations": {"ru":"...","en":"...","hi":"...","zh":"..."},
  "descriptionTranslations": ${service.description ? '{"ru":"...","en":"...","hi":"...","zh":"..."}' : 'null'}
}`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const raw = result.response.text().trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
  const parsed = JSON.parse(raw)

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      titleTranslations: parsed.titleTranslations ?? undefined,
      descriptionTranslations: parsed.descriptionTranslations ?? undefined,
    },
  })
}

export function localizeService<T extends {
  title: string
  description?: string | null
  titleTranslations?: unknown
  descriptionTranslations?: unknown
}>(service: T, lang: string): T {
  const l = (LANGS as readonly string[]).includes(lang) ? lang as Lang : 'ru'
  const tt = service.titleTranslations as Record<string, string> | null | undefined
  const dt = service.descriptionTranslations as Record<string, string> | null | undefined
  return {
    ...service,
    title: tt?.[l] ?? service.title,
    description: dt?.[l] ?? service.description,
  }
}

// ─── Roadmap AI ───────────────────────────────────────────────────────────────

type TranslatableItem = { key: string; text: string }
type TranslationMap = Map<string, Record<Lang, string>>

// ── TipTap helpers ────────────────────────────────────────────────────────────

function isBlankNode(node: unknown): boolean {
  const t = (node as { type?: string })?.type ?? ''
  return t === 'inputNode' || t === 'blank' || t === 'gap' || t === 'gapNode'
}

function blankNodeId(node: unknown): string {
  return String((node as { attrs?: { id?: unknown } })?.attrs?.id ?? '?')
}

function serializeParagraphChildren(children: unknown[]): string {
  return children
    .map((n) => {
      if ((n as { type?: string })?.type === 'text') return (n as { text?: string }).text ?? ''
      if (isBlankNode(n)) return `[BLANK_${blankNodeId(n)}]`
      return ''
    })
    .join('')
}

function extractTiptapItems(content: unknown, prefix: string, items: TranslatableItem[]): void {
  const doc = content as { type?: string; content?: unknown[] } | null
  if (!doc?.content) return
  doc.content.forEach((node, idx) => {
    const n = node as { type?: string; content?: unknown[] }
    if (n.type !== 'paragraph') return
    const text = serializeParagraphChildren(n.content ?? [])
    if (text.trim()) items.push({ key: `${prefix}.p${idx}`, text })
  })
}

function applyTiptapTranslation(content: unknown, prefix: string, map: TranslationMap, lang: Lang): unknown {
  const doc = content as { type?: string; content?: unknown[]; [k: string]: unknown } | null
  if (!doc?.content) return content
  const newContent = doc.content.map((node, idx) => {
    const n = node as { type?: string; content?: unknown[]; [k: string]: unknown }
    if (n.type !== 'paragraph') return node
    const translated = map.get(`${prefix}.p${idx}`)?.[lang]
    if (!translated) return node
    // Reconstruct paragraph: split translated string on [BLANK_id] markers
    const origBlanks = (n.content ?? []).filter(isBlankNode)
    const parts = translated.split(/\[BLANK_[^\]]*\]/g)
    const blankMatches = [...translated.matchAll(/\[BLANK_([^\]]*)\]/g)]
    const newChildren: unknown[] = []
    parts.forEach((textPart, i) => {
      if (textPart) newChildren.push({ type: 'text', text: textPart })
      if (i < blankMatches.length) {
        const blankId = blankMatches[i][1]
        const orig = origBlanks.find((b) => blankNodeId(b) === blankId) ?? origBlanks[i]
        if (orig) newChildren.push(orig)
      }
    })
    return { ...n, content: newChildren.length > 0 ? newChildren : n.content }
  })
  return { ...doc, content: newContent }
}

// ── Per-block extraction ──────────────────────────────────────────────────────

interface RoadmapTestBlock { id: string; type: string; payload: unknown }

function extractFromBlock(block: RoadmapTestBlock, prefix: string, items: TranslatableItem[]): void {
  const p = block.payload as Record<string, unknown>
  switch (block.type) {
    case 'CHOOSE_OPTION':
      if (typeof p.question === 'string' && p.question) items.push({ key: `${prefix}.q`, text: p.question })
      for (const opt of ((p.options ?? []) as { id: string; text: string }[])) {
        if (opt.text) items.push({ key: `${prefix}.o:${opt.id}`, text: opt.text })
      }
      break
    case 'SEQUENCE':
      for (const item of ((p.items ?? []) as { id: string; text: string }[])) {
        if (item.text) items.push({ key: `${prefix}.s:${item.id}`, text: item.text })
      }
      break
    case 'MATCH_PAIRS':
      for (const pair of ((p.pairs ?? []) as { id: string; left: string; right: string }[])) {
        if (pair.left) items.push({ key: `${prefix}.ml:${pair.id}`, text: pair.left })
        if (pair.right) items.push({ key: `${prefix}.mr:${pair.id}`, text: pair.right })
      }
      break
    case 'FREE_ANSWER':
      if (typeof p.question === 'string' && p.question) items.push({ key: `${prefix}.fq`, text: p.question })
      if (typeof p.referenceAnswer === 'string' && p.referenceAnswer) items.push({ key: `${prefix}.fa`, text: p.referenceAnswer })
      break
    case 'HIGHLIGHT_TEXT': {
      if (typeof p.instruction === 'string' && p.instruction) items.push({ key: `${prefix}.hi`, text: p.instruction })
      const tokens = (p.tokens ?? []) as { id: number; text: string; isCorrect: boolean }[]
      if (tokens.length > 0) {
        // Serialize as "word1[C] word2 word3[C]" — [C] marks correct tokens
        const serialized = tokens.map((t) => `${t.text}${t.isCorrect ? '[C]' : ''}`).join(' ')
        items.push({ key: `${prefix}.htoks`, text: serialized })
      }
      break
    }
    case 'WORD_SCRAMBLE':
      if (typeof p.source === 'string' && p.source) items.push({ key: `${prefix}.wssrc`, text: p.source })
      if (typeof p.hint === 'string' && p.hint) items.push({ key: `${prefix}.wshint`, text: p.hint })
      break
    case 'DIALOGUE': {
      if (typeof p.instruction === 'string' && p.instruction) items.push({ key: `${prefix}.dinst`, text: p.instruction })
      const spk = p.speakers as { a: string; b: string } | undefined
      if (spk?.a) items.push({ key: `${prefix}.dsa`, text: spk.a })
      if (spk?.b) items.push({ key: `${prefix}.dsb`, text: spk.b })
      for (const line of ((p.lines ?? []) as { id: string; text: string }[])) {
        if (line.text) items.push({ key: `${prefix}.dl:${line.id}`, text: line.text })
      }
      break
    }
    case 'FILL_TEXT':
      extractTiptapItems(p.content, `${prefix}.ft`, items)
      break
    case 'INFO_TEXT':
      extractTiptapItems(p.content, `${prefix}.it`, items)
      break
    case 'INFO_MEDIA':
      if (typeof p.caption === 'string' && p.caption) items.push({ key: `${prefix}.cap`, text: p.caption })
      break
  }
}

function applyToBlock(block: RoadmapTestBlock, prefix: string, map: TranslationMap, lang: Lang): RoadmapTestBlock {
  const p = block.payload as Record<string, unknown>
  const get = (key: string) => map.get(key)?.[lang]
  switch (block.type) {
    case 'CHOOSE_OPTION':
      return {
        ...block, payload: {
          ...p,
          question: get(`${prefix}.q`) ?? p.question,
          options: ((p.options ?? []) as { id: string; text: string }[]).map((opt) => ({
            ...opt, text: get(`${prefix}.o:${opt.id}`) ?? opt.text,
          })),
        },
      }
    case 'SEQUENCE':
      return {
        ...block, payload: {
          ...p,
          items: ((p.items ?? []) as { id: string; text: string }[]).map((item) => ({
            ...item, text: get(`${prefix}.s:${item.id}`) ?? item.text,
          })),
        },
      }
    case 'MATCH_PAIRS':
      return {
        ...block, payload: {
          ...p,
          pairs: ((p.pairs ?? []) as { id: string; left: string; right: string }[]).map((pair) => ({
            ...pair,
            left: get(`${prefix}.ml:${pair.id}`) ?? pair.left,
            right: get(`${prefix}.mr:${pair.id}`) ?? pair.right,
          })),
        },
      }
    case 'FREE_ANSWER':
      return {
        ...block, payload: {
          ...p,
          question: get(`${prefix}.fq`) ?? p.question,
          referenceAnswer: get(`${prefix}.fa`) ?? p.referenceAnswer,
        },
      }
    case 'HIGHLIGHT_TEXT': {
      const tokStr = get(`${prefix}.htoks`)
      let newTokens = p.tokens
      if (tokStr) {
        // Parse "word1[C] word2 word3[C]" back to token objects
        newTokens = tokStr.trim().split(/\s+/)
          .map((part, i) => ({
            id: i,
            text: part.replace(/\[C\]$/, '').trim(),
            isCorrect: part.endsWith('[C]'),
          }))
          .filter((t) => t.text.length > 0)
      }
      return {
        ...block, payload: {
          ...p,
          instruction: get(`${prefix}.hi`) ?? p.instruction,
          tokens: newTokens,
        },
      }
    }
    case 'WORD_SCRAMBLE':
      return {
        ...block, payload: {
          ...p,
          source: get(`${prefix}.wssrc`) ?? p.source,
          hint: get(`${prefix}.wshint`) ?? p.hint,
        },
      }
    case 'DIALOGUE': {
      const spk = p.speakers as { a: string; b: string } | undefined
      return {
        ...block, payload: {
          ...p,
          instruction: get(`${prefix}.dinst`) ?? p.instruction,
          speakers: { a: get(`${prefix}.dsa`) ?? spk?.a, b: get(`${prefix}.dsb`) ?? spk?.b },
          lines: ((p.lines ?? []) as { id: string; speaker: string; text: string }[]).map((line) => ({
            ...line, text: get(`${prefix}.dl:${line.id}`) ?? line.text,
          })),
        },
      }
    }
    case 'FILL_TEXT':
      return { ...block, payload: { ...p, content: applyTiptapTranslation(p.content, `${prefix}.ft`, map, lang) } }
    case 'INFO_TEXT':
      return { ...block, payload: { ...p, content: applyTiptapTranslation(p.content, `${prefix}.it`, map, lang) } }
    case 'INFO_MEDIA':
      return { ...block, payload: { ...p, caption: get(`${prefix}.cap`) ?? p.caption } }
    default:
      return block
  }
}

// ── Content-level extraction / application ────────────────────────────────────

function extractRoadmapItems(content: unknown, title: string): TranslatableItem[] {
  const items: TranslatableItem[] = [{ key: 'roadTitle', text: title }]
  const c = content as { nodes?: unknown[] } | null
  if (!c?.nodes) return items
  for (const rawNode of c.nodes) {
    const node = rawNode as { id: string; data?: { type?: string; [k: string]: unknown } }
    if (!node?.data) continue
    const nk = `n:${node.id}`
    const data = node.data
    switch (data.type) {
      case 'ENTRY_POINT':
        if (typeof data.roadTitle === 'string' && data.roadTitle)
          items.push({ key: `${nk}.et`, text: data.roadTitle })
        if (typeof data.roadDescription === 'string' && data.roadDescription)
          items.push({ key: `${nk}.ed`, text: data.roadDescription })
        break
      case 'INFO_TEXT': {
        const infoText = (data.inputs as Record<string, string>)?.['INFO_TEXT']
        if (infoText) items.push({ key: `${nk}.it`, text: infoText })
        break
      }
      case 'ACTIVE_TEST': {
        const blocks = (data.activeTests ?? []) as RoadmapTestBlock[]
        blocks.forEach((block, i) => extractFromBlock(block, `${nk}.at:${i}`, items))
        break
      }
    }
  }
  return items
}

function applyRoadmapTranslations(content: unknown, map: TranslationMap, lang: Lang): unknown {
  const c = content as { nodes?: unknown[]; [k: string]: unknown } | null
  if (!c) return content
  const nodes = (c.nodes ?? []).map((rawNode: unknown) => {
    const node = rawNode as { id: string; data?: { type?: string; [k: string]: unknown }; [k: string]: unknown }
    if (!node?.data) return rawNode
    const nk = `n:${node.id}`
    const data = node.data
    const get = (key: string) => map.get(key)?.[lang]
    switch (data.type) {
      case 'ENTRY_POINT':
        return {
          ...node,
          data: {
            ...data,
            roadTitle: get(`${nk}.et`) ?? data.roadTitle,
            roadDescription: get(`${nk}.ed`) ?? data.roadDescription,
          },
        }
      case 'INFO_TEXT': {
        const inputs = (data.inputs ?? {}) as Record<string, string>
        return {
          ...node,
          data: {
            ...data,
            inputs: { ...inputs, INFO_TEXT: get(`${nk}.it`) ?? inputs['INFO_TEXT'] },
          },
        }
      }
      case 'ACTIVE_TEST': {
        const blocks = (data.activeTests ?? []) as RoadmapTestBlock[]
        return {
          ...node,
          data: {
            ...data,
            activeTests: blocks.map((block, i) => applyToBlock(block, `${nk}.at:${i}`, map, lang)),
          },
        }
      }
    }
    return rawNode
  })
  return { ...c, nodes }
}

// ── Main roadmap enrichment ───────────────────────────────────────────────────

export async function enrichRoadmapWithAI(roadmapId: string): Promise<void> {
  const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId } })
  if (!roadmap) return

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return

  const allItems = extractRoadmapItems(roadmap.content, roadmap.title)
  if (allItems.length <= 1) return // title only — nothing to do

  const items = allItems.slice(0, 200) // guard against huge roadmaps

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })

  const prompt = `You are a multilingual educational content translator for an e-learning platform.
Translate every item below to all four languages: ru, en, hi, zh.

Rules:
- Items with [BLANK_id] placeholders are fill-in-the-blank exercises. Keep the [BLANK_id] tokens in the translated text, placed where grammatically correct for that language.
- Items with [C] suffix on words (like "кошка[C] бежит[C] быстро") are highlight-text tasks. In the translation, mark the semantically equivalent words with [C] (the words that should be highlighted).
- Translate naturally and correctly for an educational context.
- Return ONLY valid JSON with no markdown.

Items:
${JSON.stringify(items)}

Response format:
{"items":[{"key":"<same key>","ru":"...","en":"...","hi":"...","zh":"..."}]}`

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })

  const raw = result.response.text().trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '')
  const parsed = JSON.parse(raw) as { items: ({ key: string } & Record<Lang, string>)[] }

  const translationMap: TranslationMap = new Map()
  for (const item of (parsed.items ?? [])) {
    translationMap.set(item.key, { ru: item.ru, en: item.en, hi: item.hi, zh: item.zh })
  }

  const titleEntry = translationMap.get('roadTitle')
  const contentTranslations: Record<Lang, unknown> = {} as Record<Lang, unknown>
  for (const lang of LANGS) {
    contentTranslations[lang] = applyRoadmapTranslations(roadmap.content, translationMap, lang)
  }

  await prisma.roadmap.update({
    where: { id: roadmapId },
    data: {
      ...(titleEntry ? { titleTranslations: titleEntry as Prisma.InputJsonValue } : {}),
      contentTranslations: contentTranslations as Prisma.InputJsonValue,
    },
  })
}

export function localizeRoadmap<T extends {
  title: string
  titleTranslations?: unknown
  content?: unknown
  contentTranslations?: unknown
}>(roadmap: T, lang: string): T {
  const l = (LANGS as readonly string[]).includes(lang) ? lang as Lang : 'ru'
  const tt = roadmap.titleTranslations as Record<string, string> | null | undefined
  const ct = roadmap.contentTranslations as Record<string, unknown> | null | undefined
  return {
    ...roadmap,
    title: tt?.[l] ?? roadmap.title,
    content: ct?.[l] ?? roadmap.content,
  }
}

// ─── Localize post for response ───────────────────────────────────────────────

export function localizePost<T extends {
  title: string
  additionalTitle?: string | null
  content?: unknown
  titleTranslations?: unknown
  additionalTitleTranslations?: unknown
  contentTranslations?: unknown
}>(post: T, lang: string): T {
  const l = (LANGS as readonly string[]).includes(lang) ? lang as Lang : 'ru'
  const tt = post.titleTranslations as Record<string, string> | null | undefined
  const att = post.additionalTitleTranslations as Record<string, string> | null | undefined
  const ct = post.contentTranslations as Record<string, unknown> | null | undefined

  return {
    ...post,
    title: tt?.[l] ?? post.title,
    additionalTitle: att?.[l] ?? post.additionalTitle,
    content: ct?.[l] ?? post.content,
  }
}
