/* eslint-disable @typescript-eslint/no-explicit-any */
import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {TaskBlockType} from '@/shared/types/Tasks/TaskType.type'

// ── типы ответов ученика ──────────────────────────────────────────────────────

export type StudentAnswer =
  | {type: TaskBlockType.CHOOSE_OPTION; value: string | string[]}
  | {type: TaskBlockType.SEQUENCE; value: string[]} // массив id в порядке ученика
  | {type: TaskBlockType.MATCH_PAIRS; value: Map<string, string>} // leftId → rightId
  | {type: TaskBlockType.FREE_ANSWER; value: string}
  | {type: TaskBlockType.FILL_TEXT; value: Record<string, string>} // gapId → ответ
  | {type: TaskBlockType.HIGHLIGHT_TEXT; value: number[]} // id выделенных токенов
  | {type: TaskBlockType.WORD_SCRAMBLE; value: string[]} // итоговый порядок элементов
  | {type: TaskBlockType.DIALOGUE; value: string[]} // id реплик в порядке ученика
  | {type: 'INFO'} // info-блоки не проверяются

export interface BlockResult {
  blockId: string
  blockType: TaskBlockType
  isCorrect: boolean
  score: number // 0 или 1 (можно расширить на частичный балл)
  maxScore: number
}

export interface TestResult {
  totalScore: number
  maxScore: number
  percent: number
  blocks: BlockResult[]
  completedAt: string
}

type GapInfo = {gapId: string; answer: string}

function extractGaps(node: any): GapInfo[] {
  if (!node) return []

  if (node.type === 'inputGap') {
    return [{gapId: node.attrs?.gapId ?? node.attrs?.answer ?? '', answer: node.attrs?.answer ?? ''}]
  }

  if (node.type === 'selectGap') {
    const opts: string[] = node.attrs?.options ?? []
    return [{gapId: node.attrs?.gapId ?? opts[0] ?? '', answer: opts[0] ?? ''}]
  }

  return (node.content ?? []).flatMap(extractGaps)
}

export function calculateResult(blocks: TestBlock[], answers: Map<string, StudentAnswer>): TestResult {
  const results: BlockResult[] = []

  for (const block of blocks) {
    const answer = answers.get(block.id)

    if (
      block.type === TaskBlockType.INFO_TEXT ||
      block.type === TaskBlockType.INFO_MEDIA ||
      block.type === TaskBlockType.INFO_AUDIO ||
      !answer ||
      answer.type === 'INFO'
    )
      continue

    const result = scoreBlock(block, answer)
    results.push(result)
  }

  const totalScore = results.reduce((s, r) => s + r.score, 0)
  const maxScore = results.reduce((s, r) => s + r.maxScore, 0)

  return {
    totalScore,
    maxScore,
    percent: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
    blocks: results,
    completedAt: new Date().toISOString()
  }
}

function scoreBlock(block: TestBlock, answer: StudentAnswer): BlockResult {
  const base = {blockId: block.id, blockType: block.type, maxScore: 1}

  switch (block.type) {
    case TaskBlockType.CHOOSE_OPTION: {
      if (answer.type !== TaskBlockType.CHOOSE_OPTION) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {correctId: string | string[]}
      const correct = Array.isArray(p.correctId) ? p.correctId : [p.correctId]
      const given = Array.isArray(answer.value) ? answer.value : [answer.value]
      const isCorrect = correct.length === given.length && correct.every((id) => given.includes(id))
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.SEQUENCE: {
      if (answer.type !== TaskBlockType.SEQUENCE) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {items: {id: string}[]}
      const correct = p.items.map((i) => i.id)
      const isCorrect = correct.join() === answer.value.join()
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.MATCH_PAIRS: {
      if (answer.type !== TaskBlockType.MATCH_PAIRS) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {pairs: {id: string; left: string; right: string}[]}
      // каждая пара: leftId → rightId (у нас id одинаковый для left и right)
      const isCorrect = p.pairs.every((pair) => answer.value.get(pair.id) === pair.id)
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.FREE_ANSWER: {
      if (answer.type !== TaskBlockType.FREE_ANSWER) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {referenceAnswer?: string}
      const ref = (p.referenceAnswer ?? '').trim().toLowerCase()
      const given = answer.value.trim().toLowerCase()
      const isCorrect = ref.length > 0 && ref === given
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.HIGHLIGHT_TEXT: {
      if (answer.type !== TaskBlockType.HIGHLIGHT_TEXT) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {tokens: {id: number; isCorrect: boolean}[] | null}
      const correctIds = (p.tokens ?? []).filter((t) => t.isCorrect).map((t) => t.id)
      const isCorrect = correctIds.length === answer.value.length && correctIds.every((id) => answer.value.includes(id))
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.WORD_SCRAMBLE: {
      if (answer.type !== TaskBlockType.WORD_SCRAMBLE) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {source: string | null; mode: 'letters' | 'words'}
      if (!p.source) return {...base, isCorrect: false, score: 0}
      const correct = p.mode === 'letters' ? p.source.trim().split('') : p.source.trim().split(/\s+/)
      const isCorrect = correct.join() === answer.value.join()
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.DIALOGUE: {
      if (answer.type !== TaskBlockType.DIALOGUE) return {...base, isCorrect: false, score: 0}
      const p = block.payload as {lines: {id: string}[]}
      const isCorrect = p.lines.map((l) => l.id).join() === answer.value.join()
      return {...base, isCorrect, score: isCorrect ? 1 : 0}
    }

    case TaskBlockType.FILL_TEXT: {
      if (answer.type !== TaskBlockType.FILL_TEXT) return {...base, isCorrect: false, score: 0}

      const gaps = extractGaps((block as any).payload?.content)
      if (gaps.length === 0) return {...base, isCorrect: true, score: 1, maxScore: 1}

      let correctCount = 0
      for (const {gapId, answer: expected} of gaps) {
        const given = (answer.value[gapId] ?? '').trim().toLowerCase()
        if (expected.trim().toLowerCase() === given) correctCount++
      }

      return {
        ...base,
        maxScore: gaps.length,
        score: correctCount,
        isCorrect: correctCount === gaps.length
      }
    }
    default:
      return {...base, isCorrect: false, score: 0}
  }
}
