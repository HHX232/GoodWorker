// Plain text out of a library file for search inside files (idea 8). Server
// only; each extractor is a dynamic import so none of them load unless needed.
// Best effort: any failure just means "not searchable by content".

const MAX_CHARS = 300_000
const MAX_PDF_PAGES = 300

function extOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
}

export function isIndexable(name: string, mimeType: string): boolean {
  const ext = extOf(name)
  return mimeType === 'application/pdf' || mimeType.startsWith('text/')
    || ['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'ods', 'csv', 'txt', 'md', 'json', 'rtf'].includes(ext)
}

function decodeXmlText(xml: string, paragraphTag: RegExp): string {
  return xml
    .replace(paragraphTag, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

async function fromPdf(buf: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise
  const parts: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PDF_PAGES); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    parts.push(content.items.map(it => ('str' in it ? it.str : '')).join(' '))
    if (parts.join('\n').length > MAX_CHARS) break
  }
  await doc.destroy()
  return parts.join('\n')
}

async function fromOfficeZip(buf: Buffer, ext: string): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buf)
  if (ext === 'docx') {
    const xml = await zip.file('word/document.xml')?.async('string')
    return xml ? decodeXmlText(xml, /<\/w:p>/g) : ''
  }
  // pptx: every slide's text runs, in slide order
  const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()))
  const texts = await Promise.all(slides.map(n => zip.file(n)!.async('string')))
  return texts.map(x => decodeXmlText(x, /<\/a:p>/g)).join('\n')
}

async function fromSheet(buf: Buffer, ext: string): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = ext === 'csv' ? XLSX.read(buf.toString('utf8'), { type: 'string' }) : XLSX.read(buf, { type: 'buffer' })
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' ' })).join('\n')
}

export async function extractText(buf: Buffer, name: string, mimeType: string): Promise<string> {
  const ext = extOf(name)
  let text = ''
  try {
    if (mimeType === 'application/pdf' || ext === 'pdf') text = await fromPdf(buf)
    else if (ext === 'docx' || ext === 'pptx') text = await fromOfficeZip(buf, ext)
    else if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) text = await fromSheet(buf, ext)
    else if (ext === 'rtf') text = buf.toString('utf8').replace(/\\[a-z]+-?\d* ?|[{}]/g, '')
    else if (mimeType.startsWith('text/') || ['txt', 'md', 'json'].includes(ext)) text = buf.toString('utf8')
  } catch (e) {
    console.error('[extractText] failed', name, e)
  }
  return text.replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, MAX_CHARS)
}

/** `…текст вокруг <совпадения> текст…` — a window around the first match, for search results. */
export function snippetAround(text: string, query: string, before = 32, after = 110): string | null {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i < 0) return null
  // Little context before the match, more after: the card clamps to 3 lines, so the match stays visible.
  let start = Math.max(0, i - before)
  const space = text.indexOf(' ', start)
  if (start > 0 && space !== -1 && space < i) start = space + 1 // don't open mid-word
  const end = Math.min(text.length, i + query.length + after)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`
}
