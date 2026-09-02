import {ExportBlock, ExportModel, questionTitle} from './buildExportModel'

function questionLines(block: Extract<ExportBlock, {kind: 'question'}>): {text: string; bold?: boolean}[][] {
  const title = [{text: questionTitle(block)}]
  switch (block.type) {
    case 'choose':
      return [
        title,
        ...block.options.map((o) => [{text: '  •  '}, {text: o, bold: block.correctOptions.includes(o)}])
      ]
    case 'free':
      return [
        title,
        ...(block.referenceAnswer ? [[{text: '  Ответ: '}, {text: block.referenceAnswer, bold: true}]] : [])
      ]
    case 'match':
      return [title, ...block.pairs.map((p) => [{text: `  ${p.left} — `}, {text: p.right, bold: true}])]
    case 'fill':
      return [title, [{text: `  ${block.text}`}]]
    case 'sequence':
      return [title, ...block.items.map((item, i) => [{text: `  ${i + 1}. ${item}`}])]
    case 'highlight':
      return [title, ...[block.instruction, block.text].filter(Boolean).map((t) => [{text: `  ${t}`}])]
    case 'scramble':
      return [
        title,
        [{text: '  '}, {text: block.source, bold: true}],
        ...(block.hint ? [[{text: `  Подсказка: ${block.hint}`}]] : [])
      ]
    case 'dialogue':
      return [title, ...block.lines.map((l) => [{text: `  ${l.speaker}: ${l.text}`}])]
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
