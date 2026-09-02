import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {buildExportModel} from './buildExportModel'
import {toMarkdown, toPlainText} from './renderText'

export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'md'

function sanitizeFilename(title: string): string {
  return (title.trim() || 'test').replace(/[\\/:*?"<>|]/g, '').slice(0, 80)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTestFile(
  test: {title: string; description: string; blocks: TestBlock[]},
  format: ExportFormat
): Promise<void> {
  const model = buildExportModel(test)
  const name = sanitizeFilename(model.title)

  if (format === 'txt') {
    triggerDownload(new Blob([toPlainText(model)], {type: 'text/plain;charset=utf-8'}), `${name}.txt`)
    return
  }

  if (format === 'md') {
    triggerDownload(new Blob([toMarkdown(model)], {type: 'text/markdown;charset=utf-8'}), `${name}.md`)
    return
  }

  if (format === 'docx') {
    const {toDocxBlob} = await import('./toDocx')
    triggerDownload(await toDocxBlob(model), `${name}.docx`)
    return
  }

  const [regularBuf, boldBuf] = await Promise.all([
    fetch('/fonts/Roboto-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Roboto-Bold.ttf').then((r) => r.arrayBuffer())
  ])
  const [{pdf, Font}, {TestPDFDoc}] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./TestPDFDoc')
  ])
  Font.reset()
  Font.register({
    family: 'Roboto',
    fonts: [
      {src: URL.createObjectURL(new Blob([regularBuf], {type: 'font/ttf'})), fontWeight: 400},
      {src: URL.createObjectURL(new Blob([boldBuf], {type: 'font/ttf'})), fontWeight: 700}
    ]
  })
  const blob = await pdf(<TestPDFDoc model={model} />).toBlob()
  triggerDownload(blob, `${name}.pdf`)
}
