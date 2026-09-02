import {ExportBlock, ExportModel, questionTitle} from './buildExportModel'

const BLANK = '_'.repeat(32)

function renderQuestionExtra(block: Extract<ExportBlock, {kind: 'question'}>): string[] {
  switch (block.type) {
    case 'choose':
      return block.options.map((o) => `  ${o.label}) ${o.text}`)
    case 'free':
      return [`  ${block.answerPrompt}`, `  ${BLANK}`, `  ${BLANK}`]
    case 'match':
      return [
        ...block.left.map((l) => `  ${l.label}. ${l.text}`),
        '',
        ...block.right.map((r) => `  ${r.label}) ${r.text}`),
        '',
        `  ${block.answerPrompt} ${BLANK}`
      ]
    case 'fill':
      return [`  ${block.text}`]
    case 'sequence':
      return [
        ...block.items.map((item) => `  ${item.label}) ${item.text}`),
        `  ${block.answerPrompt} ${BLANK}`
      ]
    case 'highlight':
      return [block.instruction, block.text].filter(Boolean).map((t) => `  ${t}`)
    case 'scramble':
      return [
        `  ${block.scrambled}`,
        ...(block.hint ? [`  Подсказка: ${block.hint}`] : []),
        `  ${block.answerPrompt} ${BLANK}`
      ]
    case 'dialogue':
      return [
        ...block.lines.map((l) => `  ${l.label}) ${l.speaker}: ${l.text}`),
        `  ${block.answerPrompt} ${BLANK}`
      ]
  }
}

function renderBlock(block: ExportBlock, heading: (s: string) => string): string {
  if (block.kind === 'info') {
    if (block.type === 'text') return block.text
    if (block.type === 'media') return heading(`[${block.mediaKind === 'video' ? 'Видео' : 'Изображение'}${block.caption ? ': ' + block.caption : ''}]`)
    return heading(`[Аудио${block.filename ? ': ' + block.filename : ''}]`)
  }
  return [`${block.num}. ${questionTitle(block)}`, ...renderQuestionExtra(block)].join('\n')
}

function render(model: ExportModel, opts: {heading1: (s: string) => string; heading2: (s: string) => string}): string {
  const parts = [opts.heading1(model.title)]
  if (model.description) parts.push(model.description)
  model.blocks.forEach((block) => parts.push(renderBlock(block, opts.heading2)))
  return parts.join('\n\n')
}

export function toPlainText(model: ExportModel): string {
  return render(model, {heading1: (s) => `${s}\n${'='.repeat(s.length)}`, heading2: (s) => s})
}

export function toMarkdown(model: ExportModel): string {
  return render(model, {heading1: (s) => `# ${s}`, heading2: (s) => `### ${s}`})
}
