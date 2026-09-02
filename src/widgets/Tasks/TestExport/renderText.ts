import {ExportBlock, ExportModel, questionTitle} from './buildExportModel'

function renderQuestionExtra(block: Extract<ExportBlock, {kind: 'question'}>, bold: (s: string) => string): string[] {
  switch (block.type) {
    case 'choose':
      return block.options.map((o) => `  - ${block.correctOptions.includes(o) ? bold(o) : o}`)
    case 'free':
      return block.referenceAnswer ? [`  Ответ: ${bold(block.referenceAnswer)}`] : []
    case 'match':
      return block.pairs.map((p) => `  ${p.left} — ${bold(p.right)}`)
    case 'fill':
      return [`  ${block.text}`]
    case 'sequence':
      return block.items.map((item, i) => `  ${i + 1}. ${item}`)
    case 'highlight':
      return [block.instruction, block.text].filter(Boolean).map((t) => `  ${t}`)
    case 'scramble':
      return [`  ${bold(block.source)}`, ...(block.hint ? [`  Подсказка: ${block.hint}`] : [])]
    case 'dialogue':
      return block.lines.map((l) => `  ${l.speaker}: ${l.text}`)
  }
}

function renderBlock(block: ExportBlock, bold: (s: string) => string, heading: (s: string) => string): string {
  if (block.kind === 'info') {
    if (block.type === 'text') return block.text
    if (block.type === 'media') return heading(`[${block.mediaKind === 'video' ? 'Видео' : 'Изображение'}${block.caption ? ': ' + block.caption : ''}]`)
    return heading(`[Аудио${block.filename ? ': ' + block.filename : ''}]`)
  }
  return [`${block.num}. ${questionTitle(block)}`, ...renderQuestionExtra(block, bold)].join('\n')
}

function render(model: ExportModel, opts: {bold: (s: string) => string; heading1: (s: string) => string; heading2: (s: string) => string}): string {
  const parts = [opts.heading1(model.title)]
  if (model.description) parts.push(model.description)
  model.blocks.forEach((block) => parts.push(renderBlock(block, opts.bold, opts.heading2)))
  return parts.join('\n\n')
}

export function toPlainText(model: ExportModel): string {
  return render(model, {bold: (s) => s, heading1: (s) => `${s}\n${'='.repeat(s.length)}`, heading2: (s) => s})
}

export function toMarkdown(model: ExportModel): string {
  return render(model, {bold: (s) => `**${s}**`, heading1: (s) => `# ${s}`, heading2: (s) => `### ${s}`})
}
