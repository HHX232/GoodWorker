'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './AnnotatedPages.module.scss'

/** Pages past this are not rendered (a review of a 300-page book is not the use case). */
const MAX_PAGES = 60
/** Width of the exported overlay PNG; height follows the page's aspect. */
const EXPORT_WIDTH = 1400

export interface Layer { page: number; url: string }
export interface Stroke { page: number; color: string; width: number; points: [number, number][] }

export interface AnnotatedPagesHandle {
  undo: () => void
  /** Drops every mark, the saved layers included. */
  clearAll: () => void
  /** Marked pages as transparent PNGs, one per page that has new strokes. */
  exportStrokes: () => Promise<{ page: number; blob: Blob }[]>
  /** Saved layers still shown (after clearAll: none). */
  keptLayers: () => Layer[]
  hasChanges: () => boolean
}

type Source = { kind: 'pdf'; contentUrl: string } | { kind: 'image'; url: string }

let workerReady = false
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    workerReady = true
  }
  return pdfjs
}

/** Normalised (0..1) strokes → a canvas of the given pixel size. */
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.width * w
    ctx.beginPath()
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * w, y * h) : ctx.lineTo(x * w, y * h)))
    if (s.points.length === 1) ctx.lineTo(s.points[0][0] * w + 0.1, s.points[0][1] * h)
    ctx.stroke()
  }
}

function PageOverlay({ page, aspect, strokes, pen, onStroke }: {
  page: number
  aspect: number
  strokes: Stroke[]
  pen: { color: string; width: number } | null
  onStroke: (s: Stroke) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<Stroke | null>(null)

  const redraw = useCallback(() => {
    const c = ref.current
    if (!c) return
    const w = c.clientWidth * devicePixelRatio
    const h = c.clientHeight * devicePixelRatio
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    const ctx = c.getContext('2d')
    if (ctx) paint(ctx, drawing.current ? [...strokes, drawing.current] : strokes, w, h)
  }, [strokes])

  useEffect(() => {
    redraw()
    const c = ref.current
    if (!c) return
    const ro = new ResizeObserver(redraw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [redraw, aspect])

  const point = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  if (!pen) return <canvas ref={ref} className={styles.overlay} aria-hidden="true" />
  return (
    <canvas
      ref={ref}
      className={`${styles.overlay} ${styles.drawable}`}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drawing.current = { page, color: pen.color, width: pen.width, points: [point(e)] }
        redraw()
      }}
      onPointerMove={e => {
        if (!drawing.current) return
        drawing.current.points.push(point(e))
        redraw()
      }}
      onPointerUp={() => {
        if (drawing.current) onStroke(drawing.current)
        drawing.current = null
      }}
      onPointerCancel={() => { drawing.current = null; redraw() }}
    />
  )
}

/** One PDF page rendered by pdf.js into a canvas at the element's width. */
function PdfPageCanvas({ pdf, page, onAspect }: { pdf: import('pdfjs-dist').PDFDocumentProxy; page: number; onAspect: (a: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let task: { cancel: () => void } | null = null
    pdf.getPage(page).then(p => {
      if (cancelled || !ref.current) return
      const base = p.getViewport({ scale: 1 })
      onAspect(base.height / base.width)
      const cssWidth = ref.current.clientWidth || 800
      const viewport = p.getViewport({ scale: (cssWidth * devicePixelRatio) / base.width })
      const c = ref.current
      c.width = viewport.width
      c.height = viewport.height
      const ctx = c.getContext('2d')
      if (!ctx) return
      const t = p.render({ canvasContext: ctx, viewport })
      task = t
      t.promise.catch(() => {})
    })
    return () => { cancelled = true; task?.cancel() }
  }, [pdf, page, onAspect])
  return <canvas ref={ref} className={styles.pageCanvas} />
}

/**
 * A file's pages with pen-mark layers on top — the tutor's review canvas
 * (`pen` set) and the student's read-only view of it. PDFs render through
 * lazily loaded pdf.js; an image is one page. Saved layers are transparent
 * PNGs shown over the page; new strokes are kept as vectors (normalised to the
 * page) and only rasterised on export, so zoom/resize never blurs them.
 */
export const AnnotatedPages = forwardRef<AnnotatedPagesHandle, {
  source: Source
  layers: Layer[]
  pen?: { color: string; width: number } | null
  onChange?: () => void
  onError?: () => void
}>(function AnnotatedPages({ source, layers, pen = null, onChange, onError }, handle) {
  const [pdf, setPdf] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(source.kind === 'image' ? 1 : 0)
  const [aspects, setAspects] = useState<Record<number, number>>({})
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    if (source.kind !== 'pdf') return
    let cancelled = false
    let doc: import('pdfjs-dist').PDFDocumentProxy | null = null
    ;(async () => {
      try {
        const res = await fetch(source.contentUrl)
        if (!res.ok) throw new Error(String(res.status))
        const data = new Uint8Array(await res.arrayBuffer())
        const pdfjs = await loadPdfjs()
        doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
        if (cancelled) return
        setPdf(doc)
        setPageCount(Math.min(doc.numPages, MAX_PAGES))
      } catch (e) {
        console.error('[AnnotatedPages] pdf load failed', e)
        if (!cancelled) onError?.()
      }
    })()
    return () => { cancelled = true; doc?.destroy() }
  }, [source, onError])

  const aspectSetters = useRef<Record<number, (a: number) => void>>({})
  const setAspectFor = (page: number) =>
    (aspectSetters.current[page] ??= (a: number) => setAspects(prev => (prev[page] === a ? prev : { ...prev, [page]: a })))

  useImperativeHandle(handle, () => ({
    undo: () => { setStrokes(s => s.slice(0, -1)); onChange?.() },
    clearAll: () => {
      setStrokes([])
      setCleared(true)
      onChange?.()
    },
    exportStrokes: async () => {
      const pages = [...new Set(strokes.map(s => s.page))]
      const out: { page: number; blob: Blob }[] = []
      for (const page of pages) {
        const w = EXPORT_WIDTH
        const h = Math.round(EXPORT_WIDTH * (aspects[page] ?? 1.414))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) continue
        paint(ctx, strokes.filter(s => s.page === page), w, h)
        const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'))
        if (blob) out.push({ page, blob })
      }
      return out
    },
    keptLayers: () => (cleared ? [] : layers),
    hasChanges: () => strokes.length > 0 || cleared,
  }), [strokes, aspects, layers, cleared, onChange])

  const addStroke = (s: Stroke) => { setStrokes(prev => [...prev, s]); onChange?.() }

  if (source.kind === 'pdf' && !pdf) return <div className={styles.loading}><span className={styles.spinner} /></div>

  return (
    <div className={styles.pages}>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map(page => {
        const aspect = aspects[page] ?? 1.414
        return (
          <div key={page} className={styles.page} data-page={page}>
            <div className={styles.paper} style={source.kind === 'pdf' ? { aspectRatio: `1 / ${aspect}` } : undefined}>
              {source.kind === 'pdf' && pdf
                ? <PdfPageCanvas pdf={pdf} page={page} onAspect={setAspectFor(page)} />
                : source.kind === 'image' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={source.url} alt="" className={styles.pageImage} onLoad={e => setAspectFor(page)(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)} />
                )}
              {(cleared ? [] : layers.filter(l => l.page === page)).map(l => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={l.url} src={l.url} alt="" className={styles.layer} />
              ))}
              <PageOverlay page={page} aspect={aspect} strokes={strokes.filter(s => s.page === page)} pen={pen} onStroke={addStroke} />
            </div>
            {pageCount > 1 && <div className={styles.pageNo}>{page}</div>}
          </div>
        )
      })}
    </div>
  )
})
