// Dependency-free readers for the in-app viewer: .docx and .xlsx are zip
// archives of XML, which the browser can open with DecompressionStream +
// DOMParser. Deliberately a *reading* view (text, headings, lists, tables,
// cell values) — not a pixel-faithful Office renderer; anything fancier is
// one click away via "Скачать".

// ── Zip ──────────────────────────────────────────────────────────────────

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Reads the central directory and returns a lazy getter for entries by path. */
export function openZip(buf: ArrayBuffer): (path: string) => Promise<string | null> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a zip archive')

  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const entries = new Map<string, { method: number; size: number; offset: number }>()
  const decoder = new TextDecoder()
  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
    const method = view.getUint16(p + 10, true)
    const size = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const offset = view.getUint32(p + 42, true)
    entries.set(decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)), { method, size, offset })
    p += 46 + nameLen + extraLen + commentLen
  }

  return async path => {
    const e = entries.get(path)
    if (!e) return null
    const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true)
    const raw = bytes.subarray(start, start + e.size)
    const data = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null
    return data ? decoder.decode(data) : null
  }
}

function xml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

/** Children by local name — OOXML namespaces vary between producers, local names don't. */
function kids(el: Element, name: string): Element[] {
  return Array.from(el.children).filter(c => c.localName === name)
}

function kid(el: Element, name: string): Element | undefined {
  return kids(el, name)[0]
}

function attr(el: Element | undefined, name: string): string | null {
  if (!el) return null
  for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value
  return null
}

// ── DOCX ─────────────────────────────────────────────────────────────────

export interface DocRun { text: string; bold?: boolean; italic?: boolean; underline?: boolean }
export type DocBlock =
  | { type: 'p' | 'h1' | 'h2' | 'h3' | 'li'; runs: DocRun[] }
  | { type: 'table'; rows: string[][] }

function isOn(el: Element | undefined): boolean {
  if (!el) return false
  const v = attr(el, 'val')
  return v === null || (v !== '0' && v !== 'false' && v !== 'none')
}

function paragraph(p: Element): DocBlock {
  const pPr = kid(p, 'pPr')
  const style = (attr(kid(pPr ?? p, 'pStyle'), 'val') ?? '').toLowerCase()
  const type: 'p' | 'h1' | 'h2' | 'h3' | 'li' =
    style === 'title' || style.endsWith('heading1') || style === 'heading1' ? 'h1'
      : style.includes('heading2') || style === 'subtitle' ? 'h2'
        : /heading[3-9]/.test(style) ? 'h3'
          : pPr && kid(pPr, 'numPr') ? 'li'
            : 'p'
  const runs: DocRun[] = []
  const collect = (parent: Element) => {
    for (const node of Array.from(parent.children)) {
      if (node.localName === 'r') {
        const rPr = kid(node, 'rPr')
        const fmt = { bold: isOn(rPr && kid(rPr, 'b')), italic: isOn(rPr && kid(rPr, 'i')), underline: isOn(rPr && kid(rPr, 'u')) }
        let text = ''
        for (const t of Array.from(node.children)) {
          if (t.localName === 't') text += t.textContent ?? ''
          else if (t.localName === 'tab') text += '\t'
          else if (t.localName === 'br') text += '\n'
        }
        if (text) runs.push({ text, ...fmt })
      } else if (node.localName === 'hyperlink' || node.localName === 'ins' || node.localName === 'smartTag') {
        collect(node)
      }
    }
  }
  collect(p)
  return { type, runs }
}

export async function parseDocx(buf: ArrayBuffer): Promise<DocBlock[]> {
  const read = openZip(buf)
  const docXml = await read('word/document.xml')
  if (!docXml) throw new Error('word/document.xml missing')
  const body = Array.from(xml(docXml).getElementsByTagNameNS('*', 'body'))[0]
  if (!body) return []
  const blocks: DocBlock[] = []
  for (const node of Array.from(body.children)) {
    if (node.localName === 'p') blocks.push(paragraph(node))
    else if (node.localName === 'tbl') {
      const rows = kids(node, 'tr').map(tr =>
        kids(tr, 'tc').map(tc => kids(tc, 'p').map(p => paragraph(p) as { runs: DocRun[] }).map(b => b.runs.map(r => r.text).join('')).join('\n'))
      )
      blocks.push({ type: 'table', rows })
    }
  }
  return blocks
}

// ── XLSX ─────────────────────────────────────────────────────────────────

export interface Sheet { name: string; rows: string[][] }

const MAX_ROWS = 1000
const MAX_COLS = 60

function colIndex(ref: string): number {
  let n = 0
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function resolveTarget(target: string): string {
  const t = target.replace(/^\//, '')
  return t.startsWith('xl/') ? t : `xl/${t}`
}

export async function parseXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const read = openZip(buf)
  const [workbookXml, relsXml, sharedXml] = await Promise.all([read('xl/workbook.xml'), read('xl/_rels/workbook.xml.rels'), read('xl/sharedStrings.xml')])
  if (!workbookXml) throw new Error('xl/workbook.xml missing')

  const shared = sharedXml
    ? Array.from(xml(sharedXml).documentElement.children).filter(e => e.localName === 'si').map(si => Array.from(si.getElementsByTagNameNS('*', 't')).map(t => t.textContent ?? '').join(''))
    : []
  const rels = new Map<string, string>()
  if (relsXml) for (const r of Array.from(xml(relsXml).documentElement.children)) rels.set(attr(r, 'Id') ?? '', attr(r, 'Target') ?? '')

  const sheetEls = Array.from(xml(workbookXml).getElementsByTagNameNS('*', 'sheet'))
  const sheets: Sheet[] = []
  for (const [i, s] of sheetEls.entries()) {
    const target = rels.get(attr(s, 'id') ?? '')
    const sheetXml = await read(target ? resolveTarget(target) : `xl/worksheets/sheet${i + 1}.xml`)
    if (!sheetXml) continue
    const rows: string[][] = []
    for (const row of Array.from(xml(sheetXml).getElementsByTagNameNS('*', 'row')).slice(0, MAX_ROWS)) {
      const rowIdx = Number(attr(row, 'r') ?? rows.length + 1) - 1
      const cells: string[] = []
      for (const c of kids(row, 'c')) {
        const col = colIndex(attr(c, 'r') ?? 'A1')
        if (col >= MAX_COLS) continue
        const t = attr(c, 't')
        const v = kid(c, 'v')?.textContent ?? ''
        cells[col] = t === 's' ? shared[Number(v)] ?? ''
          : t === 'inlineStr' ? Array.from(c.getElementsByTagNameNS('*', 't')).map(x => x.textContent ?? '').join('')
            : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE')
              : v
      }
      if (rowIdx < MAX_ROWS) rows[rowIdx] = Array.from(cells, x => x ?? '')
    }
    const width = Math.max(0, ...rows.map(r => r?.length ?? 0))
    sheets.push({ name: attr(s, 'name') ?? `Sheet${i + 1}`, rows: Array.from(rows, r => Array.from({ length: width }, (_, k) => r?.[k] ?? '')) })
  }
  return sheets
}

// ── CSV ──────────────────────────────────────────────────────────────────

export function parseCsv(text: string): string[][] {
  const delimiter = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/** `A`, `B`, … `AA` — spreadsheet column headers. */
export function colName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
