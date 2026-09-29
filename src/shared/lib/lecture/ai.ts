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
