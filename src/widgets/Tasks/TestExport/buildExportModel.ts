import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {tiptapToPlainText} from '@/shared/lib/tiptapToPlainText'
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

export type ExportBlock =
  | {kind: 'question'; num: number; type: 'choose'; question: string; options: string[]; correctOptions: string[]}
  | {kind: 'question'; num: number; type: 'free'; question: string; referenceAnswer: string}
  | {kind: 'question'; num: number; type: 'match'; pairs: {left: string; right: string}[]}
  | {kind: 'question'; num: number; type: 'fill'; text: string}
  | {kind: 'question'; num: number; type: 'sequence'; items: string[]}
  | {kind: 'question'; num: number; type: 'highlight'; instruction: string; text: string}
  | {kind: 'question'; num: number; type: 'scramble'; source: string; hint: string}
  | {kind: 'question'; num: number; type: 'dialogue'; lines: {speaker: string; text: string}[]}
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

    switch (block.type as TaskBlockType) {
      case TaskBlockType.CHOOSE_OPTION: {
        const p = payload as ChooseOptionPayload
        const correctIds = Array.isArray(p.correctId) ? p.correctId : [p.correctId]
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'choose',
          question: p.question,
          options: p.options.map((o) => o.text),
          correctOptions: p.options.filter((o) => correctIds.includes(o.id)).map((o) => o.text)
        })
        break
      }
      case TaskBlockType.FREE_ANSWER: {
        const p = payload as FreeAnswerPayload
        blocks.push({kind: 'question', num: ++num, type: 'free', question: p.question, referenceAnswer: p.referenceAnswer ?? ''})
        break
      }
      case TaskBlockType.MATCH_PAIRS: {
        const p = payload as MatchPairsPayload
        blocks.push({kind: 'question', num: ++num, type: 'match', pairs: p.pairs.map((pair) => ({left: pair.left, right: pair.right}))})
        break
      }
      case TaskBlockType.FILL_TEXT: {
        const p = payload as FillTextPayload
        blocks.push({kind: 'question', num: ++num, type: 'fill', text: tiptapToPlainText(p.content)})
        break
      }
      case TaskBlockType.SEQUENCE: {
        const p = payload as SequencePayload
        blocks.push({kind: 'question', num: ++num, type: 'sequence', items: p.items.map((i) => i.text)})
        break
      }
      case TaskBlockType.HIGHLIGHT_TEXT: {
        const p = payload as HighlightTextPayload
        const text = (p.tokens ?? []).map((t) => (t.isCorrect ? `**${t.text}**` : t.text)).join(' ')
        blocks.push({kind: 'question', num: ++num, type: 'highlight', instruction: p.instruction ?? '', text})
        break
      }
      case TaskBlockType.WORD_SCRAMBLE: {
        const p = payload as WordScramblePayload
        blocks.push({kind: 'question', num: ++num, type: 'scramble', source: p.source ?? '', hint: p.hint ?? ''})
        break
      }
      case TaskBlockType.DIALOGUE: {
        const p = payload as DialoguePayload
        blocks.push({
          kind: 'question',
          num: ++num,
          type: 'dialogue',
          lines: p.lines.map((l) => ({speaker: p.speakers[l.speaker], text: l.text}))
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
