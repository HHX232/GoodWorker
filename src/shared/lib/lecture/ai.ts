import { callAI, callVisionAI, type AIUsage } from '@/lib/openrouter'
import { prisma } from '@/shared/prisma/prisma'
import { getLectureSettings, lectureCostKopecks } from './pricing'

// Every /lecture AI call goes to DeepSeek (text: deepseek-chat, photos: the
// vision model). The house markdown dialect is parsed by markdownToDoc.ts.

// The graph block spec (graphSpec.ts validates it). Shared by the notes dialect and graphAssist.
const GRAPH_FORMAT = `Формат графика (JSON):
  type "plot" (по умолчанию) — графики на осях: "x": [min, max], необязательно "y": [min, max], "xLabel"/"yLabel", "series" — список:
    {"kind": "fn", "expr": "sin x", "from": 0, "to": 3} — функция; from/to — область куска (кусочная функция = несколько fn с разными from/to);
    {"kind": "area", "expr": "2 - x", "from": 0, "to": 2} — закрашенная площадь под кривой (интеграл);
    {"kind": "points", "points": [{"x": 1, "y": 2, "label": "A"}]} — отмеченные точки;
    {"kind": "line", "points": [{"x": 0, "y": 0}, {"x": 1, "y": 3}]} — ломаная по данным (эксперимент, таблица значений, кривая без формулы);
    {"kind": "vline", "value": 1} / {"kind": "hline", "value": 0} — асимптоты и прямые x = a, y = b;
    у любой серии: "label", "color" (blue, red, green, orange, purple, teal, pink, gray, black), "dashed": true.
    expr — обычная запись: x^2, 2x+1, sin x, cos(2x), sqrt(x), |x|, e^(-x), ln x, log x, 1/(x-1), pi.
  type "bar" — диаграмма по категориям: "categories": ["Янв", "Фев"], "series": [{"label": "…", "values": [3, 5], "kind": "bar" | "line"}] — столбцы и линии можно комбинировать.
  По фото графика: если по виду (пересечения с осями, вершина, асимптоты, период, подписи) формула очевидна — пиши её в expr; если нет — перенеси кривую ломаной "line" по 8–20 точкам, снятым с рисунка. Диапазоны осей — как на рисунке. Ничего не выдумывай сверх нарисованного/сказанного.`

const DIALECT = `Формат ответа — markdown с расширениями:
- заголовки ## и ###, списки, **жирный**, *курсив*;
- формулы строго в LaTeX: в строке $...$, отдельной строкой $$...$$ (никаких формул "словами");
- выделение маркером: ==важное== (или =={green}...==, цвета: yellow, green, blue, pink, orange);
- цветной текст: {red|текст} (цвета: red, orange, green, blue, purple, gray) — для определений, предупреждений, ключевых терминов;
- таблицы — обычной markdown-таблицей (| Столбец | Столбец |, строка |---|---|), когда данные табличные или просят таблицу; в ячейках можно $формулы$;
- без HTML, без ссылок, без картинок, без блоков кода вокруг ответа;
- если на фото/доске нарисована (или преподаватель строит) геометрическая фигура — вставь блок доски, и в нём ТОЛЬКО то, что реально есть:
\`\`\`board
{"title": "Пирамида SABCD", "shapes": [{"solid": "pyramid", "sides": 4, "label": "SABCD"}], "annotations": ["AB = 6 см", "SO = 8 см — высота"]}
\`\`\`
  solid: cube | pyramid | prism | cone | cylinder | sphere | polygon (плоский многоугольник); sides — число вершин основания (3 — треугольная, 4 — четырёхугольная…); annotations — данные и обозначения с доски как есть. Не выдумывай размеры, которых нет.
- если на фото/доске нарисован график или диаграмма (или преподаватель строит/описывает график функции) — вставь блок графика:
\`\`\`graph
{"title": "…", "x": [-5, 5], "series": [{"kind": "fn", "expr": "x^2 - 2x", "label": "y = x² − 2x"}]}
\`\`\`
${GRAPH_FORMAT}`

// Context makes unclear fragments readable — but only where the match is obvious.
const CONTEXT_RULE = `Используй контекст лекции (предмет, тема, подтемы, обозначения), чтобы правильно понять неразборчивые места: если фрагмент распознан плохо, но явно совпадает с типичной формулой или термином этой темы — восстанови его. Если совпадение не очевидно — просто не включай этот кусок, ничего не выдумывай. Никогда не добавляй содержание, которого не было.
Никаких служебных пометок и примечаний в ответе: не пиши «[неразборчиво]», «(по контексту не восстановить)», «Примечание: фрагмент содержит ошибки распознавания…», «восстановлены только очевидные места» и т.п. — в ответе только сам конспект.`

const STRUCTURE_SYSTEM = `Ты конспектируешь лекцию для студента. Тебе дают черновую расшифровку речи преподавателя с микрофона в аудитории.

Расшифровка грязная: ошибки распознавания, повторы, слова-паразиты, реплики студентов и посторонние разговоры, шум. Фрагменты в ⟨?…⟩ распознаватель считает сомнительными.

Правила:
1. Конспектируй ВСЁ, что преподаватель говорит по существу: определения, объяснения, рассуждения, примеры, истории из практики, вводную часть, план занятия, требования к курсу — даже если там нет формул. Короткий содержательный фрагмент — это всё равно конспект (пусть 1–3 пункта).
2. Выкидывай только явный мусор: посторонние разговоры, реплики из зала не по теме, организационный шум ("откройте окно", "кто отсутствует"), обрывки без смысла, галлюцинации распознавателя ("Субтитры сделал…", "Продолжение следует", "Спасибо за просмотр").
3. Исправляй ошибки распознавания по смыслу и теме (термины, имена, формулы, произнесённые словами: "эф штрих от икс" → $f'(x)$).
4. ${CONTEXT_RULE}
5. Структурируй: заголовок ### для новой темы/подтемы, определения — {blue|...}, важные предупреждения — {red|...}, ключевое — ==...==, перечисления — списком.
6. Пиши на языке лекции. Насколько подробно — сказано ниже в «Степени сжатия».
7. markdown пустой ТОЛЬКО если во фрагменте вообще нет речи преподавателя по делу (одни шумы и обрывки). Если сомневаешься — конспектируй.

Также веди КОНТЕКСТ лекции: определи предмет (например "Математический анализ"), общую тему лекции, подтемы, которые реально прошли в этом фрагменте, и ключевые термины/обозначения (например "f'(x)", "цепное правило"). Если контекст уже дан — уточняй его, не меняй без явной причины.

Возвращай ТОЛЬКО JSON без markdown-обёртки:
{"markdown": "<конспект фрагмента>", "context": {"subject": "...", "topic": "...", "subtopics": ["..."], "terms": ["..."]}}

Формат поля markdown:
${DIALECT}`

const PHOTO_SYSTEM = `Ты помогаешь студенту исправить фрагмент конспекта лекции по фото доски или слайда.
Тебе дают выделенный студентом фрагмент конспекта (он мог быть распознан с ошибками), окружающий контекст и фото.
Найди на фото то, что соответствует фрагменту, и верни исправленную версию ТОЛЬКО этого фрагмента: формулы — точно как на доске, в LaTeX.
Если на фото есть относящиеся к фрагменту детали, которых не хватает, — добавь их. Не переписывай то, чего нет в выделении.
НИКОГДА не решай задачи, не выводи ответы, не добавляй «пояснения к решению», шаги и выводы, которых нет на фото — переноси только то, что на нём реально написано или нарисовано.
Если на фото ничего относящегося к фрагменту нет — верни фрагмент без изменений.
${CONTEXT_RULE}

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
  return stripMeta(s.trim().replace(/^```(?:markdown|md)?\n?/i, '').replace(/\n?```$/, '').trim())
}

/**
 * The model's notes about itself never belong in a student's notes: "[неразборчиво] — …"
 * lines and "Примечание: …ошибки распознавания…" remarks are dropped, inline markers removed.
 */
export function stripMeta(md: string): string {
  return md
    .split('\n')
    .filter(line => {
      const l = line.replace(/^[\s>*_\-–—•]+/, '')
      // A line that is only "about" an unclear place: starts with the marker, or says it can't be recovered.
      if (/^=*\[\s*неразборчиво[^\]]*\]=*\s*([—–\-:]|$)/i.test(l) || /по контексту не восстановить/i.test(l)) return false
      if (/^примечани[ея]\s*:/i.test(l) && /распозна|неразборчив|восстановл/i.test(l)) return false
      return true
    })
    .join('\n')
    .replace(/ ?=*\[\s*неразборчиво[^\]]*\]=*/gi, '')
    .replace(/\(\s*по контексту не восстановить\s*\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CLEAN_SYSTEM = `Ты чистишь черновую расшифровку речи преподавателя на лекции (микрофон в аудитории, распознавание Whisper) перед конспектированием.

Расшифровка грязная: слова распознаны неправильно (созвучные, но бессмысленные в контексте), повторы, слова-паразиты, обрывки, реплики студентов и посторонние разговоры, галлюцинации распознавателя ("Субтитры сделал…", "Продолжение следует", "Спасибо за просмотр", "Редактор субтитров…"). Фрагменты в ⟨?…⟩ распознаватель считает сомнительными.

Задача — восстановить, что на самом деле сказал преподаватель:
1. Заменяй неверно распознанные слова на те, что по звучанию близки и логичны по смыслу и теме лекции ("инженерная псих ология" → "инженерная психология", "эр гономика" → "эргономика").
2. Убирай мусор: паразиты, повторы, оборванные фразы без смысла, посторонние разговоры, галлюцинации. Сомнительные ⟨?…⟩ — исправь по смыслу или выкинь; скобки ⟨?⟩ в ответе не оставляй.
3. Склеивай обрывки в связные предложения, расставляй пунктуацию.
4. НЕ добавляй фактов, которых преподаватель не говорил, НЕ сокращай содержательную речь и НЕ пересказывай — это всё ещё его речь, только чистая. Примеры, вводная часть, отступления по делу остаются.
5. Если слово восстановить нельзя — оставь как есть.
${CONTEXT_RULE}

Верни ТОЛЬКО очищенный текст, без пояснений и кавычек. Если во фрагменте нет ни одной осмысленной фразы преподавателя — верни пустую строку.`

/** Pass 1: dirty STT text → what the teacher actually said (fixed words, no junk). */
export async function cleanTranscript(opts: { lectureId: string; context: string; transcript: string }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `${opts.context || 'КОНТЕКСТ ЛЕКЦИИ: пока неизвестен — определи по расшифровке.'}

Черновая расшифровка:
"""
${opts.transcript}
"""`
  const raw = await callAI(CLEAN_SYSTEM, prompt, { json: false, temperature: 0.1, maxTokens: 4000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw).replace(/^"""|"""$/g, '').trim()
}

/** New transcript → markdown blocks that continue the notes, plus the refreshed lecture context. */
export type Compression = 'none' | 'medium' | 'strong'
export const COMPRESSIONS: Compression[] = ['none', 'medium', 'strong']

// How much of the lecture survives into the notes — the student picks it on the page.
const COMPRESSION_RULE: Record<Compression, string> = {
  none: 'Степень сжатия: БЕЗ СЖАТИЯ. Подробный конспект: сохрани каждую мысль преподавателя — объяснения, рассуждения, примеры, оговорки, связки между идеями, почти в полном объёме (переформулируй только для ясности). Убирай лишь мусор, повторы и слова-паразиты.',
  medium: 'Степень сжатия: СРЕДНЕЕ. Хороший студенческий конспект: все определения, формулы и выводы, объяснения — кратко, из примеров — главное.',
  strong: 'Степень сжатия: СИЛЬНОЕ. Только суть тезисами: определения, формулы, ключевые выводы и важные предупреждения. Без примеров, историй и отступлений.',
}

export async function structureTranscript(opts: { lectureId: string; context: string; previousNotes: string; transcript: string; compression?: Compression }): Promise<{ markdown: string; context: unknown }> {
  let usage: AIUsage | null = null
  const prompt = `${opts.context || 'КОНТЕКСТ ЛЕКЦИИ: пока неизвестен — определи по расшифровке.'}

Конец уже готового конспекта (для связности — НЕ повторяй его):
"""
${opts.previousNotes.slice(-1500) || '(конспект пока пуст)'}
"""

${COMPRESSION_RULE[opts.compression ?? 'none']}

Новый фрагмент (расшифровка уже очищена от мусора) — законспектируй его как продолжение:
"""
${opts.transcript}
"""`
  const raw = await callAI(STRUCTURE_SYSTEM, prompt, { temperature: 0.2, maxTokens: 3000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  try {
    const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()) as { markdown?: unknown; context?: unknown }
    return { markdown: stripFence(typeof parsed.markdown === 'string' ? parsed.markdown : ''), context: parsed.context ?? null }
  } catch {
    // The model broke the JSON contract — keep the notes, skip the context update.
    return { markdown: stripFence(raw), context: null }
  }
}

/** A selected fragment + a board photo → the corrected fragment (vision model). */
export async function fixFragmentWithPhoto(opts: { lectureId: string; lecture: string; selection: string; context: string; photo: { mimeType: string; base64: string } }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `${opts.lecture}

Контекст конспекта вокруг фрагмента:
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

const ASK_SYSTEM = `Ты — редактор конспекта лекции. Студент выделил фрагмент конспекта и о чём-то просит.
Режим ответа указан в запросе:
- «ЗАМЕНА» — верни ТОЛЬКО новую версию выделенного фрагмента. Если просьба — вопрос (например, "что это значит?"), всё равно верни фрагмент, дополненный коротким пояснением в конце (курсивом).
- «ДОБАВЛЕНИЕ» — фрагмент остаётся как есть, твой ответ вставят сразу ПОСЛЕ него: верни только новое (таблицу, пояснение, пример, вывод), не повторяя сам фрагмент.
Без пояснений от себя, без кавычек, без "Вот исправленный вариант".
Если просят таблицу (сравнить, свести, разложить по столбцам) — верни markdown-таблицу.
Сохраняй смысл лекции, ничего не выдумывай сверх просьбы. Формулы — в LaTeX. Учитывай предмет и тему лекции (обозначения, принятые в этой теме).

${DIALECT}`

/** "Спросить ИИ" on a selection → a suggested replacement (the student confirms or cancels it). */
export async function askAboutFragment(opts: { lectureId: string; lecture: string; selection: string; context: string; instruction: string; insertAfter?: boolean }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `${opts.lecture}

Контекст вокруг фрагмента:
"""
${opts.context.slice(0, 2500)}
"""

Выделенный фрагмент:
"""
${opts.selection.slice(0, 3000)}
"""

Режим ответа: ${opts.insertAfter ? 'ДОБАВЛЕНИЕ (вставят после фрагмента)' : 'ЗАМЕНА (заменит фрагмент)'}

Просьба студента: ${opts.instruction.slice(0, 500)}`
  const raw = await callAI(ASK_SYSTEM, prompt, { json: false, temperature: 0.3, maxTokens: 2000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw)
}

const FORMULA_SYSTEM = `Ты — ассистент по математическим формулам в конспекте лекции. Возвращай ТОЛЬКО валидный JSON без markdown.
Учитывай предмет и тему лекции: принятые в ней обозначения. Распознавая формулу с фото, неразборчивые символы восстанавливай по типичным формулам темы только при очевидном совпадении; иначе не додумывай, а скажи о сомнении в explanation.
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
  lecture: string
  photo?: { mimeType: string; base64: string }
}): Promise<{ latex: string; explanation: string }> {
  let usage: AIUsage | null = null
  const task = {
    describe: `Составь формулу по описанию: ${opts.instruction}`,
    edit: `Текущая формула: ${opts.latex}\nИзмени её по просьбе: ${opts.instruction}`,
    explain: `Объясни формулу простыми словами (latex верни без изменений): ${opts.latex}`,
    photo: `Распознай формулу с фото${opts.instruction ? ` (уточнение: ${opts.instruction})` : ''}${opts.latex ? `. Сейчас в конспекте: ${opts.latex}` : ''}. Если формул несколько — возьми ту, что ближе к уточнению/текущей.`,
  }[opts.mode]
  const prompt = `${opts.lecture}\n\n${task}\n\nКонтекст конспекта:\n"""\n${opts.context.slice(0, 1500)}\n"""`
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

const PHOTO_READ_SYSTEM = `Ты переносишь в конспект лекции то, что написано на фото доски, слайда или тетрадного листа.
Перепиши содержимое фото аккуратно и структурированно: формулы — точно как на фото, в LaTeX; текст — как есть, без пересказа; выкладки — по шагам.
Игнорируй то, что не относится к учебному материалу (посторонние предметы, отражения, стёртые фрагменты).
НИКОГДА не решай задачи, не выводи ответы, не добавляй «пояснения к решению», шаги и выводы, которых нет на фото — переноси только то, что на нём реально написано или нарисовано.
Если на фото нет учебного содержимого — верни пустой ответ.
${CONTEXT_RULE}

${DIALECT}`

/** "Вставить с фото": the photo's content as notes, placed where the student chose. */
export async function readPhoto(opts: { lectureId: string; lecture: string; context: string; photo: { mimeType: string; base64: string } }): Promise<string> {
  let usage: AIUsage | null = null
  const prompt = `${opts.lecture}\n\nКонтекст конспекта в месте вставки (для терминов и обозначений):\n"""\n${opts.context.slice(0, 2000)}\n"""\n\nПерепиши содержимое фото.`
  const raw = await callVisionAI(PHOTO_READ_SYSTEM, [opts.photo], prompt, { json: false, temperature: 0.1, maxTokens: 2500, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  return stripFence(raw)
}

const PHOTO_MERGE_SYSTEM = `Ты сверяешь фото доски с уже готовым конспектом лекции и решаешь, куда что добавить.
Тебе дают конспект как пронумерованные блоки [0], [1], … и фото.
Просмотри фото целиком и найди ВСЁ учебное содержимое четырёх видов — ни один вид не пропускай:
1. текст — определения, пояснения, примеры, списки;
2. формулы и выкладки — точно как на доске, в LaTeX;
3. фигуры — геометрические/объёмные фигуры с обозначениями и данными → отдельный фрагмент с блоком \`\`\`board;
4. графики и диаграммы — оси с кривыми, столбчатые/линейные диаграммы → отдельный фрагмент с блоком \`\`\`graph (формула кривой — только если она очевидна, иначе точки с рисунка).
Каждая фигура и каждый график — свой фрагмент. Раздели остальное на смысловые фрагменты (формула, выкладка, определение, пример). Для КАЖДОГО фрагмента реши:
- "duplicate" — это уже есть в конспекте (та же формула/мысль, даже если записана иначе). Укажи номер блока, где оно уже есть.
- "continuation" — это продолжение или уточнение уже записанного (следующий шаг выкладки, дополнение к формуле/примеру). Укажи номер блока, ПОСЛЕ которого вставить.
- "new" — новое содержание, которого в конспекте нет; вставляется в конец.
НИКОГДА не решай задачи, не выводи ответы, не добавляй «пояснения к решению», шаги и выводы, которых нет на фото — переноси только то, что на нём реально написано или нарисовано.
Формулы сравнивай по смыслу, а не по записи ($x^2$ и $x\\cdot x$ — одно и то же).
${CONTEXT_RULE}
Возвращай ТОЛЬКО JSON без markdown:
{"items":[{"kind":"text"|"formula"|"figure"|"graph","action":"duplicate"|"continuation"|"new","block":<номер или null>,"reason":"<коротко по-русски, почему так>","markdown":"<фрагмент в формате ниже; для duplicate — как на фото>"}]}

Формат поля markdown:
${DIALECT}`

export type PhotoFragmentKind = 'text' | 'formula' | 'figure' | 'graph'

export interface PhotoMergeItem {
  kind: PhotoFragmentKind
  action: 'duplicate' | 'continuation' | 'new'
  block: number | null
  reason: string
  markdown: string
}

/** What a fragment really is — read from its markdown first (a board/graph block wins), the model's label second. */
function fragmentKind(markdown: string, claimed: unknown): PhotoFragmentKind {
  if (/```graph/.test(markdown)) return 'graph'
  if (/```board/.test(markdown)) return 'figure'
  if (claimed === 'text' || claimed === 'formula') return /\$/.test(markdown) && claimed === 'text' && markdown.replace(/\$[^$]*\$/g, '').trim().length < 20 ? 'formula' : claimed
  return /\$\$|\$[^$]+\$/.test(markdown) ? 'formula' : 'text'
}

/** Left-rail "Обработать фото доски": what on the photo is already in the notes, what continues them, what's new. */
export async function mergePhoto(opts: { lectureId: string; lecture: string; outline: string[]; photos: { mimeType: string; base64: string }[] }): Promise<PhotoMergeItem[]> {
  let usage: AIUsage | null = null
  const outline = opts.outline.slice(-80).map((t, i, arr) => `[${opts.outline.length - arr.length + i}] ${t.slice(0, 220)}`).join('\n')
  const many = opts.photos.length > 1
  const prompt = `${opts.lecture}\n\nКонспект (блоки):\n${outline || '(конспект пока пуст)'}\n\n${many ? `Разбери все ${opts.photos.length} фото вместе, в порядке их следования: это одна доска или соседние доски. То, что видно сразу на нескольких фото, переноси один раз.` : 'Разбери фото.'}`
  const raw = await callVisionAI(PHOTO_MERGE_SYSTEM, opts.photos, prompt, { temperature: 0.1, maxTokens: 5000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  const clean = raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(clean) as { items?: Partial<PhotoMergeItem>[] }
  return (parsed.items ?? [])
    .filter(i => typeof i.markdown === 'string' && i.markdown.trim())
    .map(i => ({
      kind: fragmentKind(String(i.markdown), i.kind),
      action: i.action === 'duplicate' || i.action === 'continuation' ? i.action : 'new',
      block: Number.isInteger(i.block) && (i.block as number) >= 0 && (i.block as number) < opts.outline.length ? (i.block as number) : null,
      reason: String(i.reason ?? '').slice(0, 300),
      markdown: stripMeta(String(i.markdown)),
    }))
}

const GRAPH_SYSTEM = `Ты строишь график для конспекта лекции. Верни ТОЛЬКО JSON спецификации графика без markdown-обёртки.
${GRAPH_FORMAT}
Перенеси КАЖДЫЙ элемент из описания или с фото — все функции, куски, асимптоты (vline/hline), точки, площади; ничего не пропускай.
Если просят изменить текущий график — верни его целиком с правками.`

export type GraphMode = 'describe' | 'edit' | 'photo'

/** Words / a photo of a board graph / an edit request → a graph spec (validated by the caller). */
export async function graphAssist(opts: {
  lectureId: string
  mode: GraphMode
  lecture: string
  instruction: string
  spec: unknown
  photo?: { mimeType: string; base64: string }
}): Promise<unknown> {
  let usage: AIUsage | null = null
  const current = opts.spec ? `Текущий график: ${JSON.stringify(opts.spec).slice(0, 4000)}` : ''
  const task = {
    describe: `Построй график по описанию: ${opts.instruction}`,
    edit: `${current}\nИзмени его: ${opts.instruction}`,
    photo: `Перенеси график/диаграмму с фото${opts.instruction ? ` (уточнение: ${opts.instruction})` : ''}. ${current}`,
  }[opts.mode]
  const prompt = `${opts.lecture}\n\n${task}`
  const onUsage = (u: AIUsage) => { usage = u }
  const raw = opts.mode === 'photo' && opts.photo
    ? await callVisionAI(GRAPH_SYSTEM, [opts.photo], prompt, { temperature: 0.1, maxTokens: 3000, onUsage })
    : await callAI(GRAPH_SYSTEM, prompt, { temperature: 0.2, maxTokens: 3000, onUsage })
  await addUsage(opts.lectureId, usage)
  return JSON.parse(raw.trim().replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim())
}
