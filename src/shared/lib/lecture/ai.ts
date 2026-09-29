import { callAI, callVisionAI, type AIUsage } from '@/lib/openrouter'
import { prisma } from '@/shared/prisma/prisma'
import { getLectureSettings, lectureCostKopecks } from './pricing'

// Every /lecture AI call goes to DeepSeek (text: deepseek-chat, photos: the
// vision model). The house markdown dialect is parsed by markdownToDoc.ts.

const DIALECT = `Формат ответа — markdown с расширениями:
- заголовки ## и ###, списки, **жирный**, *курсив*;
- формулы строго в LaTeX: в строке $...$, отдельной строкой $$...$$ (никаких формул "словами");
- выделение маркером: ==важное== (или =={green}...==, цвета: yellow, green, blue, pink, orange);
- цветной текст: {red|текст} (цвета: red, orange, green, blue, purple, gray) — для определений, предупреждений, ключевых терминов;
- без HTML, без ссылок, без картинок, без блоков кода вокруг ответа.`

const STRUCTURE_SYSTEM = `Ты конспектируешь лекцию для студента. Тебе дают черновую расшифровку речи преподавателя с микрофона в аудитории.

Расшифровка грязная: ошибки распознавания, повторы, слова-паразиты, реплики студентов и посторонние разговоры, шум. Фрагменты в ⟨?…⟩ распознаватель считает сомнительными.

Правила:
1. Оставь только содержание лекции. Выкидывай посторонние разговоры, реплики не по теме, организационный шум ("откройте окно", "кто отсутствует"), сомнительные ⟨?…⟩ фрагменты, если они не вписываются в тему.
2. Исправляй явные ошибки распознавания по смыслу (термины, имена, формулы, произнесённые словами: "эф штрих от икс" → $f'(x)$).
3. Ничего не выдумывай и не добавляй от себя — только то, что сказал преподаватель. Если фрагмент непонятен и важен — оставь его и пометь ==[неразборчиво]==.
4. Структурируй: заголовок ### для новой темы/подтемы, определения — {blue|...}, важные предупреждения — {red|...}, ключевое — ==...==, перечисления — списком.
5. Пиши кратко, как хороший студенческий конспект, на языке лекции.
6. Если в новом фрагменте нет содержания лекции — верни пустой ответ.

${DIALECT}`

const PHOTO_SYSTEM = `Ты помогаешь студенту исправить фрагмент конспекта лекции по фото доски или слайда.
Тебе дают выделенный студентом фрагмент конспекта (он мог быть распознан с ошибками), окружающий контекст и фото.
Найди на фото то, что соответствует фрагменту, и верни исправленную версию ТОЛЬКО этого фрагмента: формулы — точно как на доске, в LaTeX.
Если на фото есть относящиеся к фрагменту детали, которых не хватает, — добавь их. Не переписывай то, чего нет в выделении.
Если на фото ничего относящегося к фрагменту нет — верни фрагмент без изменений.

${DIALECT}`

async function addUsage(lectureId: string, usage: AIUsage | null): Promise<void> {
  if (!usage) return
  const lecture = await prisma.lectureNote.update({
    where: { id: lectureId },
    data: { aiPromptTokens: { increment: usage.promptTokens }, aiCompletionTokens: { increment: usage.completionTokens } },
  })
  const tariff = await getLectureSettings()
  await prisma.lectureNote.update({
    where: { id: lectureId },
    data: { costKopecks: lectureCostKopecks(tariff, lecture.recordedMs, lecture.aiPromptTokens, lecture.aiCompletionTokens) },
  })
}

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:markdown|md)?\n?/i, '').replace(/\n?```$/, '').trim()
}

/** New transcript → markdown blocks that continue the notes (not rewriting what came before). */
export async function structureTranscript(opts: { lectureId: string; title: string; previousNotes: string; transcript: string }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `Тема лекции: ${opts.title || 'не указана'}

Конец уже готового конспекта (для связности — НЕ повторяй его):
"""
${opts.previousNotes.slice(-1500) || '(конспект пока пуст)'}
"""

Новый фрагмент расшифровки — законспектируй его как продолжение:
"""
${opts.transcript}
"""`
  const raw = await callAI(STRUCTURE_SYSTEM, prompt, { json: false, temperature: 0.2, maxTokens: 2500, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw)
}

/** A selected fragment + a board photo → the corrected fragment (vision model). */
export async function fixFragmentWithPhoto(opts: { lectureId: string; selection: string; context: string; photo: { mimeType: string; base64: string } }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `Контекст конспекта вокруг фрагмента:
"""
${opts.context.slice(0, 2000)}
"""

Выделенный фрагмент, который нужно исправить по фото:
"""
${opts.selection.slice(0, 2000)}
"""`
  const raw = await callVisionAI(PHOTO_SYSTEM, [opts.photo], prompt, { json: false, temperature: 0.1, maxTokens: 1500, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw)
}

const ASK_SYSTEM = `Ты — редактор конспекта лекции. Студент выделил фрагмент конспекта и просит его изменить.
Верни ТОЛЬКО новую версию выделенного фрагмента — без пояснений, без кавычек, без "Вот исправленный вариант".
Если просьба — вопрос (например, "что это значит?"), всё равно верни фрагмент, дополненный коротким пояснением в конце (курсивом).
Сохраняй смысл лекции, ничего не выдумывай сверх просьбы. Формулы — в LaTeX.

${DIALECT}`

/** "Спросить ИИ" on a selection → a suggested replacement (the student confirms or cancels it). */
export async function askAboutFragment(opts: { lectureId: string; selection: string; context: string; instruction: string }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `Контекст вокруг фрагмента:
"""
${opts.context.slice(0, 2500)}
"""

Выделенный фрагмент:
"""
${opts.selection.slice(0, 3000)}
"""

Просьба студента: ${opts.instruction.slice(0, 500)}`
  const raw = await callAI(ASK_SYSTEM, prompt, { json: false, temperature: 0.3, maxTokens: 2000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw)
}

const FORMULA_SYSTEM = `Ты — ассистент по математическим формулам в конспекте лекции. Возвращай ТОЛЬКО валидный JSON без markdown.
Формат: {"latex": "<LaTeX для редактора MathLive: без $, без \\\\[ \\\\], без окружений документа; \\\\frac, \\\\sqrt, \\\\sum, \\\\int, \\\\lim, \\\\cdot, ^, _, \\\\left(\\\\right), \\\\begin{cases}...\\\\end{cases}, \\\\begin{pmatrix}...\\\\end{pmatrix}>", "explanation": "<1–3 предложения по-русски: что это за формула / что изменено; пусто, если не нужно>"}`

export type FormulaMode = 'describe' | 'edit' | 'explain' | 'photo'

/**
 * Formula AI (the ✦ button in the formula editor):
 *   describe — words → LaTeX;  edit — apply an instruction to the current LaTeX;
 *   explain  — keep LaTeX, explain it;  photo — read the formula off a photo.
 */
export async function formulaAssist(opts: {
  lectureId: string
  mode: FormulaMode
  latex: string
  instruction: string
  context: string
  photo?: { mimeType: string; base64: string }
}): Promise<{ latex: string; explanation: string }> {
  let usage: AIUsage | null = null
  const task = {
    describe: `Составь формулу по описанию: ${opts.instruction}`,
    edit: `Текущая формула: ${opts.latex}\nИзмени её по просьбе: ${opts.instruction}`,
    explain: `Объясни формулу простыми словами (latex верни без изменений): ${opts.latex}`,
    photo: `Распознай формулу с фото${opts.instruction ? ` (уточнение: ${opts.instruction})` : ''}${opts.latex ? `. Сейчас в конспекте: ${opts.latex}` : ''}. Если формул несколько — возьми ту, что ближе к уточнению/текущей.`,
  }[opts.mode]
  const prompt = `${task}\n\nКонтекст конспекта:\n"""\n${opts.context.slice(0, 1500)}\n"""`
  const onUsage = (u: AIUsage) => { usage = u }
  const raw = opts.mode === 'photo' && opts.photo
    ? await callVisionAI(FORMULA_SYSTEM, [opts.photo], prompt, { temperature: 0.1, onUsage })
    : await callAI(FORMULA_SYSTEM, prompt, { temperature: 0.2, onUsage })
  await addUsage(opts.lectureId, usage)
  const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(clean) as { latex?: string; explanation?: string }
  const latex = (parsed.latex ?? '').trim().replace(/^\$+|\$+$/g, '')
  if (!latex) throw new Error('empty latex')
  return { latex, explanation: (parsed.explanation ?? '').trim() }
}
