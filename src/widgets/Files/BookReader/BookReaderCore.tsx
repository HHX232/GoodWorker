'use client'

import type { BookBookmark, BookHighlight, BookPresence, HighlightColor, HighlightRect } from '@/shared/types/TutorFiles/tutorFiles.types'
import {
  ArrowLeftIcon, BookmarkIcon, BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Columns2Icon, DownloadIcon,
  MaximizeIcon, MinimizeIcon, PencilIcon, RectangleVerticalIcon, Trash2Icon, XIcon, ZoomInIcon, ZoomOutIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { toast } from 'sonner'
import { formatDate } from '../lib'
import { hitHighlight, placeFloating, type Anchor } from './highlightGeometry'
import { HighlightLayer, HighlightList, HighlightPopup, SelectionBar } from './HighlightUi'
import { readSelection, type ReadSelection } from './readSelection'
import { ReaderMark } from './ReaderMark'
import { cornerFor, spreadPages, stepPage, type ViewMode } from './spread'
import styles from './BookReader.module.scss'

type Pdf = import('pdfjs-dist').PDFDocumentProxy

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
/** ≤ this the reader is single-page only (two pages don't fit a phone). */
const NARROW_QUERY = '(max-width: 700px)'
/** A page counts as "read" after resting this long (the container dedups the POST). */
const SETTLE_MS = 2000
/** Cap on canvas width in device px — keeps a 300% zoom from allocating a huge bitmap. */
const MAX_CANVAS_PX = 3600

let workerReady = false
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    workerReady = true
  }
  return pdfjs
}

/** Width + placement of the mini-bar / popup for an anchor: fits the viewport (a 360px phone gets 344px). */
function floating(anchor: Anchor, max: number, need: number, prefer: 'above' | 'below') {
  const vw = window.innerWidth
  const width = Math.min(max, vw - 16)
  return { width, place: placeFloating({ anchor, width, viewport: { w: vw, h: window.innerHeight }, prefer, need }) }
}

/** One page: pdf.js canvas at `width` css px, plus the invisible text layer for selection/copy. */
function PdfPage({ pdf, page, width, aspect, highlights, flashId, onOpenHighlight, onTextState }: {
  pdf: Pdf
  page: number
  width: number
  aspect: number
  highlights: BookHighlight[]
  flashId: string | null
  onOpenHighlight: (h: BookHighlight, anchor: Anchor) => void
  /** Whether the page has any text to select (false = a scan). */
  onTextState: (page: number, hasText: boolean) => void
}) {
  const t = useTranslations('files')
  const textStateRef = useRef(onTextState)
  useEffect(() => { textStateRef.current = onTextState })
  // The render attempt (page+width) that really failed; a new attempt starts clean without a reset-in-effect.
  const attempt = `${page}:${width}`
  const [failedAttempt, setFailedAttempt] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: { cancel: () => void } | null = null
    let layer: { cancel: () => void } | null = null
    ;(async () => {
      const [pdfjs, p] = await Promise.all([loadPdfjs(), pdf.getPage(page)])
      // Only a superseded render (RenderingCancelledException / our own cancel) is silent; a real failure is shown.
      const fail = (e: unknown) => {
        if (cancelled || e instanceof pdfjs.RenderingCancelledException) return
        console.error('[BookReader] page render failed', page, e)
        setFailedAttempt(attempt)
      }
      const canvas = canvasRef.current
      const text = textRef.current
      if (cancelled || !canvas || !text) return
      const base = p.getViewport({ scale: 1 })
      const px = Math.min(width * devicePixelRatio, MAX_CANVAS_PX)
      const viewport = p.getViewport({ scale: px / base.width })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const job = p.render({ canvasContext: ctx, viewport })
        task = job
        job.promise.catch(fail)
      }
      const cssViewport = p.getViewport({ scale: width / base.width })
      text.innerHTML = ''
      text.style.setProperty('--scale-factor', String(cssViewport.scale))
      const content = await p.getTextContent()
      if (cancelled) return
      textStateRef.current(page, content.items.some(i => 'str' in i && i.str.trim() !== ''))
      const built = new pdfjs.TextLayer({ textContentSource: content, container: text, viewport: cssViewport })
      layer = built
      await built.render().catch(fail)
    })().catch(e => {
      if (cancelled) return
      console.error('[BookReader] page render failed', page, e)
      setFailedAttempt(attempt)
    })
    return () => { cancelled = true; task?.cancel(); layer?.cancel() }
  }, [pdf, page, width, attempt])

  // A plain click (no drag) on a saved highlight opens its popup. The fills sit *under* the text layer, so
  // they never block a new selection; the hit test is done here on the page-relative click point instead.
  const onPaperClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (highlights.length === 0 || window.getSelection()?.isCollapsed === false) return
    const box = e.currentTarget.getBoundingClientRect()
    const hit = hitHighlight(highlights, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height)
    if (hit) onOpenHighlight(hit, { left: e.clientX, top: e.clientY, bottom: e.clientY, width: 0 })
  }

  return (
    <div className={styles.paper} style={{ width, height: width * aspect }} onClick={onPaperClick}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={textRef} className={styles.textLayer} data-text-layer={page} />
      <HighlightLayer highlights={highlights} flashId={flashId} onOpen={onOpenHighlight} />
      {failedAttempt === attempt && <div className={styles.pageError} role="alert">{t('booksReaderPageError', { page })}</div>}
    </div>
  )
}

export interface NewHighlight {
  page: number
  text: string
  rects: HighlightRect[]
  color: HighlightColor
}
const NO_HIGHLIGHTS: BookHighlight[] = []
/** Width of the mini-bar / popup (shrinks to the viewport on a phone). */
const BAR_W = 460
const POP_W = 320

export interface BookReaderCoreProps {
  /** Same-origin URL of the PDF bytes (`/api/tutor-files/files/<id>/content`; S3 has no CORS). */
  contentUrl: string
  title: string
  backHref: string
  initialPage?: number
  /** The viewer already has saved progress: then the opening spread is not re-sent. Without it, the opening page is sent once. */
  hasProgress?: boolean
  bookmarks: BookBookmark[]
  /** Tutor-owner only; omit for a student — then no reader-marks are drawn. */
  presence?: BookPresence | null
  /** The viewer rested on `page` for ~2 s; `spread` = all pages on screen. Not fired for the spread the book opened on. */
  onPageSettled?: (page: number, spread: number[]) => void
  onToggleBookmark: (page: number) => void
  onRenameBookmark: (id: string, label: string) => void
  onRemoveBookmark: (id: string) => void
  /** The viewer's own text highlights. Highlighting is off when `onCreateHighlight` is omitted. */
  highlights?: BookHighlight[]
  /** Save a new highlight; resolves to it, or null on failure (the caller has already toasted — nothing is drawn then). */
  onCreateHighlight?: (input: NewHighlight) => Promise<BookHighlight | null>
  /** Change comment/colour (the caller applies it optimistically and rolls back on failure). */
  onUpdateHighlight?: (id: string, patch: { note?: string | null; color?: HighlightColor }) => void
  onRemoveHighlight?: (id: string) => void
  /** The content request answered 401/403 — access is gone. */
  onForbidden?: () => void
}

export function BookReaderCore({
  contentUrl, title, backHref, initialPage = 1, hasProgress = initialPage > 1, bookmarks, presence, onPageSettled, onToggleBookmark, onRenameBookmark, onRemoveBookmark,
  highlights = NO_HIGHLIGHTS, onCreateHighlight, onUpdateHighlight, onRemoveHighlight, onForbidden,
}: BookReaderCoreProps) {
  const t = useTranslations('files')
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [pdf, setPdf] = useState<Pdf | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [aspect, setAspect] = useState(1.414)
  const [failed, setFailed] = useState(false)

  const [page, setPage] = useState(initialPage)
  const [pref, setPref] = useState<ViewMode>('double')
  // null until matchMedia is read — pages are not mounted before, so a phone never builds two PdfPage.
  const [narrow, setNarrow] = useState<boolean | null>(null)
  const [zoom, setZoom] = useState(1)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [panel, setPanel] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [resumed, setResumed] = useState(initialPage > 1)
  const [draft, setDraft] = useState<string | null>(null)
  // Set once the page-number draft is committed or cancelled; the blur that follows Enter/Esc must not commit again.
  const draftDone = useRef(false)
  const commitDraft = (value: string) => {
    if (draftDone.current) return
    draftDone.current = true
    if (value) go(0, Number(value))
    setDraft(null)
  }
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const mode: ViewMode = narrow ? 'single' : pref
  const ready = pdf !== null && narrow !== null
  const cur = stepPage(page, 0, mode, numPages || page)

  // ── Load the PDF ───────────────────────────────────────
  const forbiddenRef = useRef(onForbidden)
  useEffect(() => { forbiddenRef.current = onForbidden })
  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    let task: import('pdfjs-dist').PDFDocumentLoadingTask | null = null
    let doc: Pdf | null = null
    ;(async () => {
      try {
        const res = await fetch(contentUrl, { signal: ac.signal })
        if (res.status === 401 || res.status === 403) { forbiddenRef.current?.(); return }
        if (!res.ok) throw new Error(String(res.status))
        const data = new Uint8Array(await res.arrayBuffer())
        const pdfjs = await loadPdfjs()
        if (cancelled) return
        task = pdfjs.getDocument({ data, isEvalSupported: false })
        doc = await task.promise
        const first = await doc.getPage(1)
        if (cancelled) return
        const v = first.getViewport({ scale: 1 })
        // допущение: формат всех страниц = формат стр.1; альбомные вставки растянутся
        setAspect(v.height / v.width)
        setNumPages(doc.numPages)
        setPdf(doc)
      } catch (e) {
        console.error('[BookReader] pdf load failed', e)
        if (!cancelled) setFailed(true)
      }
    })()
    // Every exit destroys: the task (covers a load still in flight) and the doc; the fetch is aborted.
    return () => { cancelled = true; ac.abort(); task?.destroy(); doc?.destroy() }
  }, [contentUrl])

  // ── Viewport: narrow flag, stage size, fullscreen ──────
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pdf])
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // ── Progress: only a page the viewer rested on ─────────
  const settledRef = useRef(onPageSettled)
  useEffect(() => { settledRef.current = onPageSettled })
  // The spread the book opened on is not "turned to": opening an odd saved page (11 → spread 10·11) must not send 10.
  const openedRef = useRef<number | null>(hasProgress ? initialPage : null)
  useEffect(() => {
    if (!ready) return
    const spread = spreadPages(cur, mode, numPages || cur).filter((n): n is number => n !== null)
    if (openedRef.current !== null && spread.includes(openedRef.current)) return
    openedRef.current = null
    const id = setTimeout(() => settledRef.current?.(cur, spread), SETTLE_MS)
    return () => clearTimeout(id)
  }, [cur, ready, mode, numPages])

  useEffect(() => {
    if (!resumed || !pdf) return
    const id = setTimeout(() => setResumed(false), 7000)
    return () => clearTimeout(id)
  }, [resumed, pdf])

  // ── Navigation ─────────────────────────────────────────
  const go = useCallback((dir: -1 | 0 | 1, to?: number) => {
    setResumed(false)
    setPage(stepPage(to ?? cur, dir, mode, numPages || 1))
  }, [cur, mode, numPages])
  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom(z => {
      const i = ZOOMS.findIndex(v => v >= z - 0.001)
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? ZOOMS.length - 1 : i) + dir))]
    })
  }, [])
  const pages = spreadPages(cur, mode, numPages || cur)
  const cols = mode === 'double' ? 2 : 1
  const pad = narrow ? 12 : 28
  const fit = Math.min((stage.w - pad * 2) / cols, (stage.h - pad * 2) / aspect)
  const width = Math.max(120, Math.floor(fit * zoom))
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  // ── Highlights: selection → mini-bar → saved fill; click a fill → popup ──
  const hlOn = !!onCreateHighlight
  // The bar/popup are tied to the layout they were measured in: zoom, resize, a turned page or mode switch just hides them.
  const layoutKey = `${cur}:${mode}:${width}`
  const layoutKeyRef = useRef(layoutKey)
  useEffect(() => { layoutKeyRef.current = layoutKey })
  const [pending, setPending] = useState<(ReadSelection & { key: string }) | null>(null)
  const [popup, setPopup] = useState<{ id: string; anchor: Anchor; key: string; focusNote: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ id: string; at: number } | null>(null)
  const [tab, setTab] = useState<'pages' | 'highlights'>('pages')
  const [noText, setNoText] = useState<ReadonlySet<number>>(() => new Set())
  const livePending = pending?.key === layoutKey ? pending : null
  const livePopup = popup?.key === layoutKey ? popup : null
  const popupHl = livePopup ? highlights.find(h => h.id === livePopup.id) ?? null : null
  const uiOpen = !!livePending || !!popupHl
  // A pointer is down inside the stage (a selection is being dragged): neither the bar nor the arrow keys react until it's released.
  const selecting = useRef(false)

  const closeUi = () => {
    setPending(null)
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }
  const onTextState = (p: number, has: boolean) => {
    setNoText(prev => {
      if (prev.has(p) !== has) return prev
      const next = new Set(prev)
      if (has) next.delete(p)
      else next.add(p)
      return next
    })
  }
  // Roving tabindex: ←/→ and Home/End move between the two tabs (same pattern as the tabs on /files/books).
  const onTabKey = (e: React.KeyboardEvent) => {
    const order = ['pages', 'highlights'] as const
    const to = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? order[(order.indexOf(tab) + 1) % order.length] : e.key === 'Home' ? order[0] : e.key === 'End' ? order[1] : null
    if (!to) return
    e.preventDefault()
    setTab(to)
    document.getElementById(`bk-tab-${to}`)?.focus()
  }
  // The element that had focus when a popup opened; on close focus goes back to the comment bubble, else there, else the page.
  const openerRef = useRef<HTMLElement | null>(null)
  const openPopup = (h: BookHighlight, anchor: Anchor) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPending(null)
    setPopup({ id: h.id, anchor, key: layoutKeyRef.current, focusNote: false })
  }
  const closePopup = (h: BookHighlight | null) => {
    setPopup(null)
    if (!h) return
    const opener = openerRef.current
    requestAnimationFrame(() => {
      const marker = stageRef.current?.querySelector<HTMLElement>(`[data-hl-marker="${CSS.escape(h.id)}"]`)
      const page = stageRef.current?.querySelector<HTMLElement>(`[data-page="${h.page}"]`)
      const back = marker ?? (opener && opener !== document.body && opener.isConnected ? opener : page)
      back?.focus({ preventScroll: true })
    })
  }

  useEffect(() => {
    const stageEl = stageRef.current
    if (!hlOn || !ready || !stageEl) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const evaluate = () => {
      if (selecting.current) return
      const s = readSelection(stageEl)
      setPending(s ? { ...s, key: layoutKeyRef.current } : null)
      if (s) setPopup(null)
    }
    const later = (ms: number) => { clearTimeout(timer); timer = setTimeout(evaluate, ms) }
    const inUi = (target: EventTarget | null) => target instanceof Element && !!target.closest('[data-hl-ui]')
    const down = (e: PointerEvent) => {
      if (inUi(e.target)) return
      setPending(null) // a click elsewhere closes the bar / popup; a new selection brings the bar back
      setPopup(null)
      selecting.current = e.target instanceof Node && stageEl.contains(e.target)
    }
    const up = () => {
      if (!selecting.current) return
      selecting.current = false
      later(30)
    }
    const release = () => { selecting.current = false }
    const change = () => later(220) // touch handles / keyboard: wait until the selection stops moving
    const scrolled = () => { setPopup(null); later(60) }
    // The site-wide TextSelectionProvider shows its own copy/search/share popup on every document mouseup/touchend
    // with a live selection; here the mini-bar owns selections, so those releases are not let through to it
    // (touch on the stage: see onTouchEnd, which has its own React handler to keep).
    const rootEl = rootRef.current
    const swallowMouse = (e: Event) => { if (window.getSelection()?.isCollapsed === false) e.stopPropagation() }
    const swallowTouch = (e: Event) => { if (inUi(e.target)) e.stopPropagation() }
    rootEl?.addEventListener('mouseup', swallowMouse)
    rootEl?.addEventListener('touchend', swallowTouch)
    document.addEventListener('selectionchange', change)
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    window.addEventListener('blur', release)
    stageEl.addEventListener('scroll', scrolled, { passive: true })
    return () => {
      clearTimeout(timer)
      document.removeEventListener('selectionchange', change)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('blur', release)
      stageEl.removeEventListener('scroll', scrolled)
      rootEl?.removeEventListener('mouseup', swallowMouse)
      rootEl?.removeEventListener('touchend', swallowTouch)
    }
  }, [hlOn, ready])

  const createHighlight = async (color: HighlightColor, withNote: boolean) => {
    const p = livePending
    if (!p || busy || !onCreateHighlight) return
    setBusy(true)
    const h = await onCreateHighlight({ page: p.page, text: p.text, rects: p.rects, color })
    setBusy(false)
    if (!h) return // failed (toast shown by the caller): nothing was drawn, the selection stays for a retry
    window.getSelection()?.removeAllRanges()
    setPending(null)
    if (withNote) setPopup({ id: h.id, anchor: p.anchor, key: p.key, focusNote: true })
  }
  const copySelection = async () => {
    const p = livePending
    if (!p) return
    try {
      await navigator.clipboard.writeText(p.copyText)
      toast.success(t('booksHlCopied'))
    } catch {
      // No clipboard API (http, denied): the selection is still live, so the native copy works.
      if (document.execCommand('copy')) toast.success(t('booksHlCopied'))
      else toast.error(t('booksHlCopyFailed'))
    }
    closeUi()
  }

  const sortedHighlights = useMemo(
    () => [...highlights].sort((a, b) => a.page - b.page || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0) || (a.rects[0]?.x ?? 0) - (b.rects[0]?.x ?? 0)),
    [highlights],
  )
  const byPageHl = useMemo(() => {
    const m = new Map<number, BookHighlight[]>()
    for (const h of highlights) m.set(h.page, [...(m.get(h.page) ?? []), h])
    return m
  }, [highlights])
  const flashId = flash?.id ?? null
  const jumpToHighlight = (h: BookHighlight) => {
    go(0, h.page)
    setFlash({ id: h.id, at: Date.now() })
    if (narrow) setPanel(false) // the panel covers the page on a phone
  }
  useEffect(() => {
    if (!flash) return
    const raf = requestAnimationFrame(() => {
      stageRef.current?.querySelector(`[data-hl-id="${CSS.escape(flash.id)}"] span`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    })
    const id = setTimeout(() => setFlash(null), 2200)
    return () => { cancelAnimationFrame(raf); clearTimeout(id) }
  }, [flash])

  useEffect(() => {
    if (!pdf) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key
      // Esc first closes the bar / popup; while one is open (or a selection is being dragged) the arrows leave the page alone.
      if (key === 'Escape' && uiOpen) {
        setPending(null)
        closePopup(popupHl)
        window.getSelection()?.removeAllRanges()
        e.preventDefault()
        return
      }
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End'].includes(key) && (uiOpen || selecting.current)) return
      // Zoomed in, the arrows/Page/Home/End pan the page — leave them to the browser.
      if (zoom > 1 && ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End'].includes(key)) return
      if (key === 'ArrowRight' || key === 'PageDown') go(1)
      else if (key === 'ArrowLeft' || key === 'PageUp') go(-1)
      else if (key === 'Home') go(0, 1)
      else if (key === 'End') go(0, numPages)
      else if (key === '+' || key === '=') zoomBy(1)
      else if (key === '-') zoomBy(-1)
      else if (key === 'Escape') setPanel(false)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdf, go, numPages, zoomBy, zoom, uiOpen, popupHl])

  // Swipe: a mostly-horizontal drag; off while zoomed (there it pans the page).
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: ReactTouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (hlOn && window.getSelection()?.isCollapsed === false) e.nativeEvent.stopImmediatePropagation() // keep the site-wide selection popup out (see above)
    const s = touch.current
    touch.current = null
    if (!s || zoom > 1.05 || uiOpen || window.getSelection()?.isCollapsed === false) return // a drag on a selection handle is not a swipe
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

  // ── Render ─────────────────────────────────────────────
  if (failed) {
    return (
      <div className={styles.root}>
        <div className={styles.state} role="alert">
          <h1 className={styles.stateTitle}>{t('booksReaderErrorTitle')}</h1>
          <p className={styles.stateText}>{t('booksReaderErrorText')}</p>
          <div className={styles.stateActions}>
            <a className={`${styles.btn} ${styles.btnPrimary}`} href={contentUrl} download><DownloadIcon size={15} /> {t('booksReaderDownload')}</a>
            <Link className={styles.btn} href={backHref}>{t('booksReaderBack')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const byPage = new Map(bookmarks.map(b => [b.page, b]))
  const bar = livePending ? floating(livePending.anchor, BAR_W, 44, window.matchMedia('(pointer: coarse)').matches ? 'below' : 'above') : null
  const pop = popupHl && livePopup ? floating(livePopup.anchor, POP_W, 220, 'below') : null

  return (
    <div ref={rootRef} className={`${styles.root} ${fullscreen ? styles.isFullscreen : ''}`}>
      <header className={styles.bar}>
        <Link href={backHref} className={styles.iconBtn} aria-label={t('booksReaderBack')} title={t('booksReaderBack')}><ArrowLeftIcon size={18} /></Link>
        <h1 className={styles.title}>{title}</h1>

        <div className={styles.nav} role="group" aria-label={t('booksReaderPageLabel')}>
          <button type="button" className={styles.iconBtn} onClick={() => go(-1)} disabled={!pdf || cur <= 1} aria-label={t('booksReaderPrev')} title={t('booksReaderPrev')}><ChevronLeftIcon size={18} /></button>
          <input
            className={styles.pageInput}
            inputMode="numeric"
            aria-label={t('booksReaderPageLabel')}
            value={draft ?? String(cur)}
            disabled={!pdf}
            onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onFocus={e => { draftDone.current = false; e.currentTarget.select() }}
            onBlur={e => commitDraft(draft === null ? '' : e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { commitDraft(draft === null ? '' : e.currentTarget.value); e.currentTarget.blur() }
              if (e.key === 'Escape') { draftDone.current = true; setDraft(null); e.currentTarget.blur() }
            }}
          />
          <span className={styles.total}>{t('booksReaderOfTotal', { total: numPages || '…' })}</span>
          <button type="button" className={styles.iconBtn} onClick={() => go(1)} disabled={!pdf || cur >= stepPage(numPages, 0, mode, numPages)} aria-label={t('booksReaderNext')} title={t('booksReaderNext')}><ChevronRightIcon size={18} /></button>
        </div>

        <div className={styles.tools}>
          {narrow === false && (
            <div className={styles.seg} role="group" aria-label={t('booksReaderModeLabel')}>
              <button type="button" className={`${styles.segBtn} ${mode === 'single' ? styles.segOn : ''}`} aria-pressed={mode === 'single'} onClick={() => setPref('single')} title={t('booksReaderModeSingle')}>
                <RectangleVerticalIcon size={16} /><span>{t('booksReaderModeSingle')}</span>
              </button>
              <button type="button" className={`${styles.segBtn} ${mode === 'double' ? styles.segOn : ''}`} aria-pressed={mode === 'double'} onClick={() => setPref('double')} title={t('booksReaderModeDouble')}>
                <Columns2Icon size={16} /><span>{t('booksReaderModeDouble')}</span>
              </button>
            </div>
          )}
          <div className={styles.zoom} role="group">
            <button type="button" className={styles.iconBtn} onClick={() => zoomBy(-1)} disabled={zoom <= ZOOMS[0]} aria-label={t('booksReaderZoomOut')} title={t('booksReaderZoomOut')}><ZoomOutIcon size={17} /></button>
            <button type="button" className={styles.zoomPct} onClick={() => setZoom(1)} title={t('booksReaderZoomReset')}>{Math.round(zoom * 100)}%</button>
            <button type="button" className={styles.iconBtn} onClick={() => zoomBy(1)} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} aria-label={t('booksReaderZoomIn')} title={t('booksReaderZoomIn')}><ZoomInIcon size={17} /></button>
          </div>
          <button type="button" className={`${styles.iconBtn} ${panel ? styles.iconOn : ''}`} aria-pressed={panel} onClick={() => setPanel(v => !v)} aria-label={t('booksReaderBookmarks')} title={t('booksReaderBookmarks')}>
            <BookOpenIcon size={17} />{bookmarks.length + highlights.length > 0 && <span className={styles.badge}>{bookmarks.length + highlights.length}</span>}
          </button>
          <button type="button" className={styles.iconBtn} onClick={toggleFullscreen} aria-label={fullscreen ? t('booksReaderFullscreenExit') : t('booksReaderFullscreen')} title={fullscreen ? t('booksReaderFullscreenExit') : t('booksReaderFullscreen')}>
            {fullscreen ? <MinimizeIcon size={17} /> : <MaximizeIcon size={17} />}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div ref={stageRef} className={styles.stage} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {!pdf || narrow === null ? (
            <div className={styles.loading}><span className={styles.spinner} /><span>{t('booksReaderLoading')}</span></div>
          ) : (
            <div className={`${styles.spread} ${mode === 'double' ? styles.spreadDouble : ''}`} data-mode={mode}>
              {pages.map((p, i) => {
                if (p === null) return <div key={`empty-${i}`} style={{ width, height: width * aspect }} aria-hidden="true" />
                const corner = cornerFor(p, mode)
                const mark = presence?.pages[p]
                const saved = byPage.get(p)
                return (
                  <div key={p} className={styles.pageWrap} data-page={p} tabIndex={-1} aria-label={t('booksReaderPageAria', { page: p })}>
                    <PdfPage pdf={pdf} page={p} width={width} aspect={aspect} highlights={byPageHl.get(p) ?? NO_HIGHLIGHTS} flashId={flashId} onOpenHighlight={openPopup} onTextState={onTextState} />
                    {hlOn && noText.has(p) && <div className={styles.noText} role="note">{t('booksHlNoText')}</div>}
                    {mark && <ReaderMark page={p} entry={mark} corner={corner} />}
                    <button
                      type="button"
                      className={`${styles.ribbon} ${corner === 'left' ? styles.ribbonRight : styles.ribbonLeft} ${saved ? styles.ribbonOn : ''}`}
                      aria-pressed={!!saved}
                      aria-label={saved ? t('booksReaderBookmarkRemove') : t('booksReaderBookmarkAdd')}
                      title={saved ? t('booksReaderBookmarkRemove') : t('booksReaderBookmarkAdd')}
                      onClick={() => onToggleBookmark(p)}
                    >
                      <BookmarkIcon size={18} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {resumed && pdf && (
          <div className={styles.resume} role="status">
            <span>{t('booksReaderResumed', { page: initialPage })}</span>
            <button type="button" onClick={() => { setResumed(false); setPage(1) }}>{t('booksReaderFromStart')}</button>
            <button type="button" className={styles.resumeX} onClick={() => setResumed(false)} aria-label={t('booksReaderClose')}><XIcon size={14} /></button>
          </div>
        )}

        {panel && (
          <aside className={styles.panel} aria-label={t('booksReaderBookmarks')}>
            <div className={styles.panelHead}>
              <h2>{t('booksReaderBookmarks')}</h2>
              <button type="button" className={styles.iconBtn} onClick={() => setPanel(false)} aria-label={t('booksReaderClose')}><XIcon size={16} /></button>
            </div>
            {hlOn && (
              <div className={styles.tabs} role="tablist" aria-label={t('booksReaderBookmarks')} onKeyDown={onTabKey}>
                {(['pages', 'highlights'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    id={`bk-tab-${k}`}
                    aria-selected={tab === k}
                    aria-controls="bk-panel"
                    tabIndex={tab === k ? 0 : -1}
                    className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`}
                    onClick={() => setTab(k)}
                  >
                    {k === 'pages' ? t('booksHlTabPages') : t('booksHlTabHighlights')}
                    {(k === 'pages' ? bookmarks.length : highlights.length) > 0 && <span className={styles.tabCount}>{k === 'pages' ? bookmarks.length : highlights.length}</span>}
                  </button>
                ))}
              </div>
            )}
            <div role={hlOn ? 'tabpanel' : undefined} id="bk-panel" aria-labelledby={hlOn ? `bk-tab-${tab}` : undefined}>
              {hlOn && tab === 'highlights' ? (
                <HighlightList
                  items={sortedHighlights}
                  isHere={pg => pages.includes(pg)}
                  hint={pages.some(pg => pg !== null && noText.has(pg))}
                  onJump={jumpToHighlight}
                  onSaveNote={(id, note) => onUpdateHighlight?.(id, { note })}
                  onRemove={id => onRemoveHighlight?.(id)}
                />
              ) : bookmarks.length === 0 ? (
                <p className={styles.panelEmpty}>{t('booksReaderBookmarksEmpty')}</p>
              ) : (
                <ul className={styles.list}>
                  {bookmarks.map(b => (
                    <li key={b.id} className={`${styles.item} ${b.page === cur || pages.includes(b.page) ? styles.itemHere : ''}`}>
                      {editing?.id === b.id ? (
                        <form className={styles.editRow} onSubmit={e => { e.preventDefault(); onRenameBookmark(b.id, editing.text); setEditing(null) }}>
                          <input
                            autoFocus
                            className={styles.labelInput}
                            value={editing.text}
                            maxLength={80}
                            aria-label={t('booksReaderBookmarkLabel')}
                            placeholder={t('booksReaderBookmarkLabel')}
                            onChange={e => setEditing({ id: b.id, text: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } }}
                          />
                          <button type="submit" className={styles.iconBtn} aria-label={t('booksReaderBookmarkSave')} title={t('booksReaderBookmarkSave')}><CheckIcon size={15} /></button>
                        </form>
                      ) : (
                        <>
                          <button type="button" className={styles.itemMain} onClick={() => go(0, b.page)}>
                            <span className={styles.itemPage}>{t('booksReaderBookmarkPage', { page: b.page })}</span>
                            {b.label && <span className={styles.itemLabel}>{b.label}</span>}
                            <span className={styles.itemDate}>{formatDate(b.createdAt, locale)}</span>
                          </button>
                          <button type="button" className={styles.iconBtn} onClick={() => setEditing({ id: b.id, text: b.label ?? '' })} aria-label={t('booksReaderBookmarkRename')} title={t('booksReaderBookmarkRename')}><PencilIcon size={14} /></button>
                          <button type="button" className={styles.iconBtn} onClick={() => onRemoveBookmark(b.id)} aria-label={t('booksReaderBookmarkDelete')} title={t('booksReaderBookmarkDelete')}><Trash2Icon size={14} /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>

      {bar && livePending && (
        <SelectionBar
          place={bar.place}
          width={bar.width}
          busy={busy}
          onColor={c => void createHighlight(c, false)}
          onComment={() => void createHighlight('yellow', true)}
          onCopy={() => void copySelection()}
        />
      )}
      {pop && popupHl && livePopup && (
        <HighlightPopup
          key={popupHl.id}
          highlight={popupHl}
          place={pop.place}
          width={pop.width}
          focusNote={livePopup.focusNote}
          onColor={c => onUpdateHighlight?.(popupHl.id, { color: c })}
          onSaveNote={note => onUpdateHighlight?.(popupHl.id, { note })}
          onRemove={() => onRemoveHighlight?.(popupHl.id)}
          onClose={() => closePopup(popupHl)}
        />
      )}
    </div>
  )
}
