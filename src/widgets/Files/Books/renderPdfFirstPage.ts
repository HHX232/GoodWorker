// Page 1 of a PDF as pictures: the whole page (for the vision check / side thumbnail) and a 2:3 cover crop.
import { canvasBlob, CENTERED, coverBlob } from './coverCanvas'

const PAGE_WIDTH = 900

let workerReady = false
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    workerReady = true
  }
  return pdfjs
}

export interface FirstPage {
  /** The whole page, JPEG — what the vision model looks at. */
  page: Blob
  /** Page 1 cropped to 2:3 (centre), JPEG — the cover when the page is taken as is. */
  cover: Blob
  numPages: number
}

/**
 * Rejects for a broken / password-protected PDF — callers treat that as "could not check".
 * `signal` (optional): abort cancels the page render and frees the document.
 */
export async function renderPdfFirstPage(source: Blob | ArrayBuffer, opts?: { signal?: AbortSignal }): Promise<FirstPage> {
  const signal = opts?.signal
  const data = new Uint8Array(source instanceof Blob ? await source.arrayBuffer() : source)
  signal?.throwIfAborted()
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data, isEvalSupported: false })
  const onAbort = () => { void task.destroy() }
  signal?.addEventListener('abort', onAbort)
  let page1: Awaited<ReturnType<Awaited<typeof task.promise>['getPage']>> | null = null
  try {
    const doc = await task.promise
    signal?.throwIfAborted()
    page1 = await doc.getPage(1)
    const p = page1
    const base = p.getViewport({ scale: 1 })
    const viewport = p.getViewport({ scale: PAGE_WIDTH / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const render = p.render({ canvasContext: ctx, viewport })
    const cancelRender = () => render.cancel()
    signal?.addEventListener('abort', cancelRender)
    try { await render.promise } finally { signal?.removeEventListener('abort', cancelRender) }
    signal?.throwIfAborted()
    const [page, cover] = await Promise.all([
      canvasBlob(canvas, 0.85),
      coverBlob({ source: canvas, width: canvas.width, height: canvas.height }, CENTERED),
    ])
    return { page, cover, numPages: doc.numPages }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    page1?.cleanup()
    void task.destroy()
  }
}
