import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {seededShuffleStudentView} from '@/features/Roadmap/helpers/seededShuffleStudentView'
import {tiptapToPlainText} from '@/shared/lib/tiptapToPlainText'
import {getShuffledItems} from '@/widgets/Tasks/BlockEditor/WordScrambleEditor/StudentViewWordScramble/StudentViewWordScramble'
import {
  ChooseOptionPayload,
  DialoguePayload,
  FillTextPayload,
  FreeAnswerPayload,
  HighlightTextPayload,
  InfoAudioPayload,
  InfoMediaPayload,
  InfoTextPayload,
  MatchPairsPayload,
  SequencePayload,
  WordScramblePayload
} from '@/shared/types/Tasks/TaskPayload.type'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'

// А printed test is a blank the student fills in — it must never reveal
// which option/order/pairing is correct. Every block type below is
// shuffled (seeded by the block's own id, so re-downloading the same test
// always produces the same arrangement) and stripped of any "this is the
// right answer" marker before it leaves buildExportModel.
const LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('')
const letterLabel = (i: number) => LETTERS[i] ?? `#${i + 1}`

function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  }
  return h
}

export interface Labeled {
  label: string
  text: string
}

export type ExportBlock =
  | {kind: 'question'; num: number; type: 'choose'; question: string; options: Labeled[]}
  | {kind: 'question'; num: number; type: 'free'; question: string; answerPrompt: string}
  | {kind: 'question'; num: number; type: 'match'; left: Labeled[]; right: Labeled[]; answerPrompt: string}
  | {kind: 'question'; num: number; type: 'fill'; text: string}
  | {kind: 'question'; num: number; type: 'sequence'; items: Labeled[]; answerPrompt: string}
  | {kind: 'question'; num: number; type: 'highlight'; instruction: string; text: string}
  | {kind: 'question'; num: number; type: 'scramble'; scrambled: string; hint: string; answerPrompt: string}
  | {kind: 'question'; num: number; type: 'dialogue'; lines: (Labeled & {speaker: string})[]; answerPrompt: string}
  | {kind: 'info'; type: 'text'; text: string}
  | {kind: 'info'; type: 'media'; mediaKind: string; caption: string}
  | {kind: 'info'; type: 'audio'; filename: string}

export interface ExportModel {
  title: string
  description: string
  blocks: ExportBlock[]
}

export function questionTitle(block: Extract<ExportBlock, {kind: 'question'}>): string {
  switch (block.type) {
    case 'choose': return block.question
    case 'free': return block.question
    case 'match': return 'Сопоставьте пары'
    case 'fill': return 'Заполните пропуски'
    case 'sequence': return 'Расставьте в правильном порядке'
    case 'highlight': return 'Выделите правильные слова'
    case 'scramble': return 'Составьте слово / предложение'
    case 'dialogue': return 'Расставьте диалог в верном порядке'
  }
}

export function buildExportModel(test: {title: string; description: string; blocks: TestBlock[]}): ExportModel {
  let num = 0
  const blocks: ExportBlock[] = []

  for (const block of test.blocks) {
    const payload = block.payload as never
    const seed = hashSeed(block.id)

    switch (block.type as TaskBlockType) {
      case TaskBlockType.CHOOSE_OPTION: {
        const p = payload as ChooseOptionPayload
        const shuffled = seededShuffleStudentView(p.options.map((o) => o.text), seed)
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'choose',
          question: p.question,
          options: shuffled.map((text, i) => ({label: letterLabel(i), text}))
        })
        break
      }
      case TaskBlockType.FREE_ANSWER: {
        const p = payload as FreeAnswerPayload
        blocks.push({kind: 'question', num: ++num, type: 'free', question: p.question, answerPrompt: 'Ваш ответ:'})
        break
      }
      case TaskBlockType.MATCH_PAIRS: {
        const p = payload as MatchPairsPayload
        const left = p.pairs.map((pair, i) => ({label: String(i + 1), text: pair.left}))
        const shuffledRight = seededShuffleStudentView(p.pairs.map((pair) => pair.right), seed)
        const right = shuffledRight.map((text, i) => ({label: letterLabel(i), text}))
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'match',
          left,
          right,
          answerPrompt: `Ответы (например: 1-${letterLabel(0)}, 2-${letterLabel(1)}, …):`
        })
        break
      }
      case TaskBlockType.FILL_TEXT: {
        const p = payload as FillTextPayload
        blocks.push({kind: 'question', num: ++num, type: 'fill', text: tiptapToPlainText(p.content)})
        break
      }
      case TaskBlockType.SEQUENCE: {
        const p = payload as SequencePayload
        const shuffled = seededShuffleStudentView(p.items.map((i) => i.text), seed)
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'sequence',
          items: shuffled.map((text, i) => ({label: letterLabel(i), text})),
          answerPrompt: `Ваш порядок (например: ${letterLabel(1)}, ${letterLabel(0)}, …):`
        })
        break
      }
      case TaskBlockType.HIGHLIGHT_TEXT: {
        const p = payload as HighlightTextPayload
        const text = (p.tokens ?? []).map((t) => t.text).join(' ')
        blocks.push({kind: 'question', num: ++num, type: 'highlight', instruction: p.instruction ?? '', text})
        break
      }
      case TaskBlockType.WORD_SCRAMBLE: {
        const p = payload as WordScramblePayload
        const source = p.source ?? ''
        const units = getShuffledItems(source, p.mode)
        const scrambled = units.join(p.mode === 'letters' ? ' ' : '   ')
        blocks.push({kind: 'question', num: ++num, type: 'scramble', scrambled, hint: p.hint ?? '', answerPrompt: 'Ваш ответ:'})
        break
      }
      case TaskBlockType.DIALOGUE: {
        const p = payload as DialoguePayload
        const rawLines = p.lines.map((l) => ({speaker: p.speakers[l.speaker], text: l.text}))
        const shuffled = seededShuffleStudentView(rawLines, seed)
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'dialogue',
          lines: shuffled.map((l, i) => ({label: letterLabel(i), speaker: l.speaker, text: l.text})),
          answerPrompt: `Порядок реплик (например: ${letterLabel(1)}, ${letterLabel(0)}, …):`
        })
        break
      }
      case TaskBlockType.INFO_TEXT: {
        const p = payload as InfoTextPayload
        blocks.push({kind: 'info', type: 'text', text: tiptapToPlainText(p.content)})
        break
      }
      case TaskBlockType.INFO_MEDIA: {
        const p = payload as InfoMediaPayload
        blocks.push({kind: 'info', type: 'media', mediaKind: p.kind ?? 'image', caption: p.caption ?? ''})
        break
      }
      case TaskBlockType.INFO_AUDIO: {
        const p = payload as InfoAudioPayload
        blocks.push({kind: 'info', type: 'audio', filename: p.filename ?? ''})
        break
      }
    }
  }

  return {title: test.title, description: test.description, blocks}
}
