import { callAI, callVisionAI, parseJSON, type AIUsage, type VisionImage } from '@/lib/openrouter'
import { addUsage, CONTEXT_RULE, DIALECT, stripFence, stripMeta } from '@/shared/lib/lecture/ai'
import type { BoardItem } from './docOps'

// DeepSeek prompts of the video-call auto-notes. Speech goes through the lecture's
// own cleanTranscript → structureTranscript (plus LESSON_NOTE in the context);
// what's here is only new: reading the board, tidying, naming, picking a folder.

/** Added to the lecture context of every call-notes prompt. */
export const LESSON_NOTE = 'Это урок по видеосвязи: в расшифровке реплики репетитора и ученика с именами; конспектируй учебное содержание обеих сторон. Домашнее задание, сроки и что будет на контрольной — тоже записывай, это не организационный шум.'

const BOARD_SYSTEM = `Ты ведёшь конспект урока по видеосвязи. Тебе дают уже готовый конспект пронумерованными блоками [0], [1], … и снимок общей доски (большая доска приходит несколькими кусками-фото по порядку слева направо, сверху вниз — это ОДНА доска).
Сам реши, что из доски должно быть в конспекте, — подтверждения никто не даёт, ты отвечаешь за результат. Найди на доске всё учебное: текст, определения, формулы и выкладки (в LaTeX, точно как на доске), фигуры (блок \`\`\`board), графики и диаграммы (блок \`\`\`graph). Каждая фигура и каждый график — свой фрагмент; остальное раздели на смысловые фрагменты. Для КАЖДОГО фрагмента выбери действие:
- "new" — нового содержания в конспекте нет; допишется в конец;
- "continuation" — продолжение или уточнение блока N (следующий шаг выкладки, дополнение к примеру); вставится сразу после блока N;
- "fix" — блок N записан неверно (речь распознали криво: формула, термин, обозначение, число), а на доске правильно — верни исправленную версию ВСЕГО блока N, она заменит его;
- "duplicate" — это уже есть в конспекте (та же формула/мысль, даже записанная иначе) — ничего не делаем.
Переноси по умолчанию ВСЁ учебное. Пропускай фрагмент ТОЛЬКО когда уверен, что это бред: каракули, случайные штрихи, нечитаемое, бессмысленный набор символов. Сомневаешься — добавляй.
НИКОГДА не решай задачи, не выводи ответы, не добавляй «пояснения к решению», шаги и выводы, которых нет на доске — переноси только то, что на ней реально написано или нарисовано.
Формулы сравнивай по смыслу, а не по записи ($x^2$ и $x\\cdot x$ — одно и то же).
${CONTEXT_RULE}
Возвращай ТОЛЬКО JSON без markdown:
{"items":[{"action":"new"|"continuation"|"fix"|"duplicate","block":<номер или null>,"markdown":"<фрагмент в формате ниже>"}]}
Ничего учебного на доске нет — {"items":[]}.

Формат поля markdown:
${DIALECT}`

const ACTIONS = new Set(['new', 'continuation', 'fix', 'duplicate'])

/** Board tiles + the notes as numbered blocks → what to add / continue / fix (3 read attempts in callVisionAI). */
export async function readBoard(opts: { lectureId: string; lecture: string; outline: string[]; photos: VisionImage[] }): Promise<BoardItem[]> {
  let usage: AIUsage | null = null
  const outline = opts.outline.slice(-80).map((t, i, arr) => `[${opts.outline.length - arr.length + i}] ${t.slice(0, 220)}`).join('\n')
  const prompt = `${opts.lecture}\n\nКонспект (блоки):\n${outline || '(конспект пока пуст)'}\n\n${opts.photos.length > 1 ? `Доска в ${opts.photos.length} кусках.` : 'Доска одним снимком.'}`
  const raw = await callVisionAI(BOARD_SYSTEM, opts.photos, prompt, { temperature: 0.1, maxTokens: 5000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  let items: unknown
  try { items = parseJSON<{ items?: unknown }>(raw).items } catch { return [] }
  if (!Array.isArray(items)) return []
  return items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof i.markdown === 'string' && ACTIONS.has(String(i.action)))
    .map(i => ({
      action: i.action as BoardItem['action'],
      block: Number.isInteger(i.block) ? (i.block as number) : null,
      markdown: stripMeta(String(i.markdown)),
    }))
}

const TIDY_SYSTEM = `Ты вычищаешь мусор из свежих кусков конспекта урока по видеосвязи. Тебе дают пронумерованные блоки [n] — только новые части, остального конспекта не видно.
Мусор — то, что НЕ относится к учебной теме урока: бытовые и технические реплики («слышно меня?», «камера зависла», «сейчас, налью чай»), организационное, приветствия и прощания, повторы уже сказанного, оговорки, обрывки без смысла, галлюцинации распознавателя («Субтитры сделал…», «Продолжение следует»).
Всё по теме урока остаётся — объяснения, примеры, вопросы ученика по делу, задачи, формулы, а также домашнее задание, сроки и что будет на контрольной. Сомневаешься — не трогай.
Блок целиком мусор — в "remove". В блоке есть и мусор, и дело — в "replace" верни этот блок без мусора (тем же форматом, ничего не добавляя). Чистые блоки не упоминай.
${CONTEXT_RULE}
Возвращай ТОЛЬКО JSON без markdown: {"remove":[<n>],"replace":[{"n":<n>,"markdown":"<блок без мусора>"}]}

Формат поля markdown:
${DIALECT}`

/** The tidy pass over new sections only: junk blocks to drop, mixed ones to rewrite. Broken answer → nothing. */
export async function tidySections(opts: { lectureId: string; context: string; blocks: { n: number; text: string }[] }): Promise<{ remove: number[]; replace: { n: number; markdown: string }[] }> {
  const none = { remove: [], replace: [] }
  if (!opts.blocks.length) return none
  let usage: AIUsage | null = null
  const list = opts.blocks.map(b => `[${b.n}] ${b.text.slice(0, 1500)}`).join('\n')
  const raw = await callAI(TIDY_SYSTEM, `${opts.context}\n\nНовые блоки конспекта:\n${list}`, { temperature: 0.1, maxTokens: 4000, onUsage: u => { usage = u } })
  await addUsage(opts.lectureId, usage)
  const known = new Set(opts.blocks.map(b => b.n))
  try {
    const parsed = parseJSON<{ remove?: unknown; replace?: unknown }>(raw)
    return {
      remove: (Array.isArray(parsed.remove) ? parsed.remove : []).filter((n): n is number => known.has(n as number)),
      replace: (Array.isArray(parsed.replace) ? parsed.replace : [])
        .filter((r): r is { n: number; markdown: string } => !!r && known.has(r.n) && typeof r.markdown === 'string')
        .map(r => ({ n: r.n, markdown: stripMeta(r.markdown) })),
    }
  } catch {
    return none
  }
}

const NAME_SYSTEM = `Придумай короткое название конспекта урока по его началу и контексту: о чём урок, как назвал бы его ученик в списке файлов («Квадратные уравнения: дискриминант», «Present Perfect vs Past Simple»). До 80 символов, без кавычек, без даты, без слов «Конспект»/«Урок».
Возвращай ТОЛЬКО JSON: {"title": "<название>"}`

/** The notes' title (≤ 80 chars, safe as a file name); '' when the AI fails — the caller has a fallback. */
export async function nameNote(opts: { context: string; transcriptHead: string }): Promise<string> {
  try {
    const raw = await callAI(NAME_SYSTEM, `${opts.context}\n\nНачало конспекта:\n"""\n${opts.transcriptHead.slice(0, 3000)}\n"""`, { temperature: 0.3, maxTokens: 100 })
    const title = parseJSON<{ title?: unknown }>(raw).title
    return typeof title === 'string' ? stripFence(title).replace(/[\\/:*?"<>|«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  } catch (e) {
    console.error('[callNotes] nameNote failed', e)
    return ''
  }
}

const FOLDER_SYSTEM = `Ты раскладываешь конспект урока в файловое хранилище человека. Дано: предмет и тема урока, преподаватель, (для репетитора) ученик, и существующие папки этого человека (id и полный путь).
Выбери самую подходящую папку: ту, где уже лежит этот предмет / этот преподаватель / этот ученик (одна дисциплина под другим названием — та же папка). Подходящей нет — предложи новый путь: короткие названия папок, например ["Конспекты уроков", "Математика"] или для репетитора — внутри разрешённого корня ["Конспекты уроков", "Иванов Пётр"]. Не создавай лишних уровней.
Возвращай ТОЛЬКО JSON: {"folderId": "<id существующей папки>" | null, "newPath": ["<папка>", "<подпапка>"]} — если выбран folderId, newPath пустой.`

/** Per-person folder pick: an existing folder id, or a new path. Broken answer → {null, []} (caller's default). */
export async function chooseFolder(opts: { role: 'STUDENT' | 'TEACHER'; subject: string; topic: string; teacherName: string; studentName?: string; folders: { id: string; path: string }[]; rule?: string }): Promise<{ folderId: string | null; newPath: string[] }> {
  const none = { folderId: null, newPath: [] }
  try {
    const prompt = [
      `Хранилище: ${opts.role === 'STUDENT' ? 'ученика' : 'репетитора'}`,
      opts.rule,
      `Предмет: ${opts.subject || 'неизвестен'}`,
      opts.topic && `Тема: ${opts.topic}`,
      opts.teacherName && `Преподаватель: ${opts.teacherName}`,
      opts.studentName && `Ученик: ${opts.studentName}`,
      `Папки:\n${opts.folders.slice(0, 300).map(f => `${f.id} — ${f.path}`).join('\n') || '(папок нет)'}`,
    ].filter(Boolean).join('\n')
    const parsed = parseJSON<{ folderId?: unknown; newPath?: unknown }>(await callAI(FOLDER_SYSTEM, prompt, { temperature: 0, maxTokens: 200 }))
    const folderId = typeof parsed.folderId === 'string' && opts.folders.some(f => f.id === parsed.folderId) ? parsed.folderId : null
    const newPath = Array.isArray(parsed.newPath) ? parsed.newPath.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []
    return { folderId, newPath: folderId ? [] : newPath }
  } catch (e) {
    console.error('[callNotes] chooseFolder failed', e)
    return none
  }
}
