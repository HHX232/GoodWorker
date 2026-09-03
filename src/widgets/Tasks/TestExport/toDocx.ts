import {ExportBlock, ExportModel, questionTitle} from './buildExportModel'

const BLANK = '_'.repeat(32)

function questionLines(block: Extract<ExportBlock, {kind: 'question'}>): {text: string; bold?: boolean}[][] {
  const title = [{text: questionTitle(block)}]
  switch (block.type) {
    case 'choose':
      return [title, ...block.options.map((o) => [{text: `  ${o.label}) ${o.text}`}])]
    case 'free':
      return [title, [{text: `  ${block.answerPrompt}`}], [{text: `  ${BLANK}`}], [{text: `  ${BLANK}`}]]
    case 'match':
      return [
        title,
        ...block.left.map((l) => [{text: `  ${l.label}. ${l.text}`}]),
        [{text: ''}],
        ...block.right.map((r) => [{text: `  ${r.label}) ${r.text}`}]),
        [{text: ''}],
        [{text: `  ${block.answerPrompt} ${BLANK}`}]
      ]
    case 'fill':
      return [title, [{text: `  ${block.text}`}]]
    case 'sequence':
      return [
        title,
        ...block.items.map((item) => [{text: `  ${item.label}) ${item.text}`}]),
        [{text: `  ${block.answerPrompt} ${BLANK}`}]
      ]
    case 'highlight':
      return [title, ...[block.instruction, block.text].filter(Boolean).map((t) => [{text: `  ${t}`}])]
    case 'scramble':
      return [
        title,
        [{text: `  ${block.scrambled}`}],
        ...(block.hint ? [[{text: `  Подсказка: ${block.hint}`}]] : []),
        [{text: `  ${block.answerPrompt} ${BLANK}`}]
      ]
    case 'dialogue':
      return [
        title,
        ...block.lines.map((l) => [{text: `  ${l.label}) ${l.speaker}: ${l.text}`}]),
        [{text: `  ${block.answerPrompt} ${BLANK}`}]
      ]
  }
}

export async function toDocxBlob(model: ExportModel): Promise<Blob> {
  const {Document, Packer, Paragraph, TextRun, HeadingLevel} = await import('docx')

  const children = [
    new Paragraph({text: model.title, heading: HeadingLevel.TITLE}),
    ...(model.description ? [new Paragraph({text: model.description})] : [])
  ]

  for (const block of model.blocks) {
    if (block.kind === 'info') {
      if (block.type === 'text') {
        children.push(new Paragraph({text: block.text, spacing: {before: 200}}))
      } else if (block.type === 'media') {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: {before: 200},
          text: `[${block.mediaKind === 'video' ? 'Видео' : 'Изображение'}${block.caption ? ': ' + block.caption : ''}]`
        }))
      } else {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: {before: 200},
          text: `[Аудио${block.filename ? ': ' + block.filename : ''}]`
        }))
      }
      continue
    }

    const lines = questionLines(block)
    lines.forEach((runs, i) => {
      children.push(new Paragraph({
        spacing: {before: i === 0 ? 200 : 40},
        children: [
          ...(i === 0 ? [new TextRun({text: `${block.num}. `, bold: true})] : []),
          ...runs.map((r) => new TextRun({text: r.text, bold: r.bold}))
        ]
      }))
    })
  }

  const doc = new Document({sections: [{children}]})
  return Packer.toBlob(doc)
}
