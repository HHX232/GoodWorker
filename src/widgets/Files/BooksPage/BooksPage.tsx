'use client'

import type { LibraryBook } from '@/shared/types/TutorFiles/tutorFiles.types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangleIcon, BookOpenIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { BookCard } from '../Books/BookCard'
import { BookCover } from '../Books/BookCover'
import { setBookSaved } from '../Books/bookFetch'
import { BookQuickView } from '../Books/BookQuickView'
import { BookUploadModal } from '../Books/BookUploadModal'
import { inkOn, safeSpine } from '../Books/bookColor'
import { FilesChevronIcon, FilesSearchIcon, FilesUploadIcon, FilesCloseIcon } from '../icons'
import { filesFetch } from '../lib'
import { ShareAccessModal, type ShareTarget } from '../ShareAccessModal/ShareAccessModal'
import { EmptyMineArt, EmptyShelfArt, MiniArt, ShelfArt, type MiniKind, type ShelfKind } from './BooksArt'
import { HERO_STACK, bookCounts, continueBook, filterBooks, newBooks, recentlyOpened, sortBooks, type BookFilter, type BookSort } from './booksModel'
import styles from './BooksPage.module.scss'

const BOOKS_KEY = ['tutor-files', 'books'] as const
type View = 'shelf' | 'mine'
type CarTab = 'recent' | 'new'

const SORT_LABEL = {
  recent: (t: (k: string) => string) => t('booksPageSortRecent'),
  title: (t: (k: string) => string) => t('booksPageSortTitle'),
  progress: (t: (k: string) => string) => t('booksPageSortProgress'),
}

const vars = (v: Record<string, string | number>) => v as CSSProperties

/** `/files/books` — design A "showcase": search, shelves, carousel, "continue reading", the grid and "My books". */
export function BooksPage({ role, canManage, fontClassName }: { role: 'teacher' | 'student'; /** An active-VIP (or admin) tutor: upload, cover, share, delete — the same gate as FilesShell. */ canManage: boolean; fontClassName?: string }) {
  const t = useTranslations('files')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const isTeacher = role === 'teacher'

  const { data: books, isPending, isError, refetch } = useQuery({
    queryKey: BOOKS_KEY,
    queryFn: async () => (await filesFetch<{ books: LibraryBook[] }>('/api/tutor-files/books')).books,
    retry: 1,
  })

  const [view, setView] = useState<View>('shelf')
  const [filter, setFilter] = useState<BookFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<BookSort>('recent')
  const [carTab, setCarTab] = useState<CarTab>('recent')
  const [quickId, setQuickId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  const list = useMemo(() => books ?? [], [books])
  const counts = useMemo(() => bookCounts(list), [list])
  const quick = quickId ? list.find(b => b.id === quickId) ?? null : null
  const countLabel = (n: number) => t('booksPageCount', { count: n })

  const patchCache = (fn: (old: LibraryBook[]) => LibraryBook[]) => {
    queryClient.setQueryData<LibraryBook[]>(BOOKS_KEY, old => fn(old ?? []))
  }

  // The ribbon: optimistic, so "My books" and the counters follow at once; rolled back on failure.
  async function setSaved(book: LibraryBook, saved: boolean, withUndo: boolean) {
    await queryClient.cancelQueries({ queryKey: BOOKS_KEY }) // an in-flight refetch must not overwrite the optimistic patch
    patchCache(old => old.map(b => (b.id === book.id ? { ...b, saved } : b)))
    try {
      await setBookSaved(book.id, saved)
      if (withUndo) {
        toast(saved ? t('booksPageToastSaved') : t('booksPageToastUnsaved'), {
          action: { label: t('booksPageUndo'), onClick: () => { void setSaved(book, !saved, false) } },
        })
      }
    } catch {
      patchCache(old => old.map(b => (b.id === book.id ? { ...b, saved: !saved } : b)))
      toast.error(t('errGeneric'))
    }
  }
  const toggleSave = (book: LibraryBook) => { void setSaved(book, !book.saved, true) }

  const onChanged = (next: LibraryBook | null) => {
    if (!next) {
      if (quickId) patchCache(old => old.filter(b => b.id !== quickId))
      return
    }
    patchCache(old => old.map(b => (b.id === next.id ? next : b)))
  }
  const onUploaded = (book: LibraryBook) => {
    patchCache(old => [book, ...old.filter(b => b.id !== book.id)])
    toast.success(t('booksPageUploaded', { title: book.title }))
  }

  const resetFilters = () => { setFilter('all'); setQuery('') }
  const open = (b: LibraryBook) => setQuickId(b.id)
  const searching = query.trim() !== ''

  const card = (b: LibraryBook, size: 'md' | 'lg', i: number, showProgress = false) => (
    <div key={b.id} className={styles.cell} style={vars({ '--i': Math.min(i, 12) })}>
      <BookCard book={b} size={size} onOpen={open} onToggleSave={toggleSave} showProgress={showProgress} />
    </div>
  )

  const sortSeg = (
    <div className={styles.seg} role="group" aria-label={t('booksPageSortAria')}>
      {(['recent', 'title', 'progress'] as const).map(s => (
        <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>{SORT_LABEL[s](t)}</button>
      ))}
    </div>
  )

  const empty = (kind: 'lib' | 'mine' | 'none') => {
    if (kind === 'lib') {
      return (
        <div className={styles.empty}>
          <EmptyShelfArt />
          <h2>{isTeacher ? t('booksPageEmptyLibTitleT') : t('booksPageEmptyLibTitleS')}</h2>
          <p>{isTeacher ? t('booksPageEmptyLibTextT') : t('booksPageEmptyLibTextS')}</p>
          {canManage && <button type="button" className={`${styles.btn} ${styles.btnPri} ${styles.btnPill}`} onClick={() => setUploadOpen(true)}><FilesUploadIcon size={18} />{t('booksPageUpload')}</button>}
        </div>
      )
    }
    if (kind === 'mine') {
      return (
        <div className={styles.empty}>
          <EmptyMineArt />
          <h2>{t('booksPageEmptyMineTitle')}</h2>
          <p>{t('booksPageEmptyMineText')}</p>
          <button type="button" className={`${styles.btn} ${styles.btnPri} ${styles.btnPill}`} onClick={() => setView('shelf')}>{t('booksPageEmptyMineGo')}</button>
        </div>
      )
    }
    return (
      <div className={styles.empty}>
        <EmptyShelfArt />
        <h2>{t('booksPageEmptyNoneTitle')}</h2>
        <p>{searching ? t('booksPageEmptyNoneQuery', { query: query.trim() }) : t('booksPageEmptyNoneFilter')}</p>
        <button type="button" className={`${styles.btn} ${styles.btnPri} ${styles.btnPill}`} onClick={resetFilters}>{t('booksPageResetAll')}</button>
      </div>
    )
  }

  const filterTitle = (f: BookFilter) => ({
    all: t('booksPageTabAll'), saved: t('booksPageTabSaved'), new: t('booksPageTabNew'), opened: t('booksPageCarRecent'),
    withcover: t('booksPageMiniWithCover'), needcover: t('booksPageMiniNeedCover'), done: t('booksPageMiniDone'),
  })[f]

  const heroFor = (pool: LibraryBook[], withMinis: boolean) => {
    const book = continueBook(pool)
    if (!book) return null
    const minis: { kind: MiniKind; label: string; filter: BookFilter; count: number }[] = [
      { kind: 'new', label: t('booksPageMiniNew'), filter: 'new', count: counts.fresh },
      { kind: 'withcover', label: t('booksPageMiniWithCover'), filter: 'withcover', count: filterBooks(list, 'withcover', '').length },
      isTeacher
        ? { kind: 'needcover', label: t('booksPageMiniNeedCover'), filter: 'needcover', count: filterBooks(list, 'needcover', '').length }
        : { kind: 'done', label: t('booksPageMiniDone'), filter: 'done', count: filterBooks(list, 'done', '').length },
    ]
    return (
      <Hero
        book={book}
        stack={sortBooks(pool, 'recent', locale).slice(0, HERO_STACK)}
        minis={withMinis ? minis.map(m => ({ ...m, countLabel: countLabel(m.count) })) : null}
        onOpen={open}
        onToggleSave={toggleSave}
        onPick={f => { setView('shelf'); setFilter(f) }}
      />
    )
  }

  const content = () => {
    if (isPending) return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('booksPageLoading')}>{Array.from({ length: 8 }, (_, i) => <div key={i} className={styles.skelBook} />)}</div>
    if (isError && !books) {
      return (
        <div className={styles.empty} role="alert">
          <AlertTriangleIcon size={40} strokeWidth={1.6} className={styles.errIcon} />
          <h2>{t('booksPageLoadError')}</h2>
          <button type="button" className={`${styles.btn} ${styles.btnPri} ${styles.btnPill}`} onClick={() => { void refetch() }}>{t('retry')}</button>
        </div>
      )
    }
    if (view === 'mine') {
      const mineAll = list.filter(b => b.saved)
      const mine = filterBooks(mineAll, 'all', query)
      return (
        <>
          <div className={styles.secHead}>
            <h2>{t('booksPageViewMine')}<span className={styles.sub}>{countLabel(mineAll.length)}</span></h2>
            {mineAll.length > 0 && sortSeg}
          </div>
          {mineAll.length === 0 ? empty('mine') : (
            <>
              {!searching && heroFor(mineAll, false)}
              {mine.length ? <div className={`${styles.grid} ${styles.gridBig}`}>{sortBooks(mine, sort, locale).map((b, i) => card(b, 'lg', i, true))}</div> : empty('none')}
            </>
          )}
        </>
      )
    }
    if (list.length === 0) return empty('lib')
    if (filter !== 'all' || searching) {
      const found = sortBooks(filterBooks(list, filter, query), sort, locale)
      return (
        <>
          <div className={styles.secHead}>
            <h2>{searching ? t('booksPageResults') : filterTitle(filter)}<span className={styles.sub}>{countLabel(found.length)}</span></h2>
            {found.length > 0 && sortSeg}
            <button type="button" className={styles.pill} onClick={resetFilters}>{t('booksPageReset')}</button>
          </div>
          {found.length ? <div className={styles.grid}>{found.map((b, i) => card(b, 'md', i))}</div> : empty('none')}
        </>
      )
    }
    const onTabKey = (e: React.KeyboardEvent) => {
      const order: CarTab[] = ['recent', 'new']
      const to = e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? order[(order.indexOf(carTab) + 1) % order.length] : e.key === 'Home' ? order[0] : e.key === 'End' ? order[1] : null
      if (!to) return
      e.preventDefault()
      setCarTab(to)
      document.getElementById(`bp-tab-${to}`)?.focus()
    }
    const carList = carTab === 'new' ? newBooks(list) : recentlyOpened(list)
    return (
      <>
        <section aria-labelledby="bp-car">
          <div className={styles.secHead}>
            <h2 id="bp-car" className={styles.sr}>{t('booksPageCarAria')}</h2>
            <div className={styles.tabs} role="tablist" aria-label={t('booksPageCarAria')} onKeyDown={onTabKey}>
              {(['recent', 'new'] as const).map(c => (
                <button key={c} type="button" role="tab" id={`bp-tab-${c}`} aria-selected={carTab === c} tabIndex={carTab === c ? 0 : -1} aria-controls="bp-car-panel" onClick={() => setCarTab(c)}>
                  {c === 'recent' ? t('booksPageCarRecent') : t('booksPageTabNew')}
                </button>
              ))}
            </div>
            <span className={styles.grow} />
            <button type="button" className={styles.pill} onClick={() => setFilter(carTab === 'new' ? 'new' : 'opened')}>{t('booksPageShowAll')}</button>
            <CarouselArrows trackId="bp-track" prev={t('booksPageScrollPrev')} next={t('booksPageScrollNext')} watch={`${carTab}:${carList.length}`} />
          </div>
          <div className={styles.car} role="tabpanel" id="bp-car-panel" aria-labelledby={`bp-tab-${carTab}`}>
            <div className={styles.track} id="bp-track" tabIndex={-1}>
              <div className={styles.trackIn}>
                {carList.length
                  ? carList.map(b => <div key={b.id} className={styles.slide}><BookCard book={b} size="md" onOpen={open} onToggleSave={toggleSave} /></div>)
                  : <p className={styles.carEmpty}>{t('booksPageCarEmpty')}</p>}
              </div>
            </div>
          </div>
        </section>
        {heroFor(list, true)}
        <section aria-labelledby="bp-all" className={styles.sec}>
          <div className={styles.secHead}>
            <h2 id="bp-all">{t('booksPageLibrary')}<span className={styles.sub}>{countLabel(list.length)}</span></h2>
            {sortSeg}
          </div>
          <div className={styles.grid}>{sortBooks(list, sort, locale).map((b, i) => card(b, 'md', i))}</div>
        </section>
      </>
    )
  }

  const shelves: { kind: ShelfKind; label: string; n: number }[] = [
    { kind: 'all', label: t('booksPageTabAll'), n: counts.total },
    { kind: 'saved', label: t('booksPageTabSaved'), n: counts.saved },
    { kind: 'new', label: t('booksPageTabNew'), n: counts.fresh },
  ]

  return (
    <div className={`${styles.page} ${fontClassName ?? ''}`}>
      <main className={styles.main}>
        <nav className={styles.crumbs} aria-label={t('booksPageCrumbsAria')}>
          <Link href="/files" className={styles.crumbLink}>{isTeacher ? t('myFiles') : t('sharedWithMe')}</Link>
          <FilesChevronIcon size={14} aria-hidden="true" />
          <b aria-current="page">{t('booksPageCrumb')}</b>
        </nav>

        <header className={styles.bar}>
          <label className={styles.search}>
            <FilesSearchIcon size={20} aria-hidden="true" />
            <span className={styles.sr}>{t('booksPageSearch')}</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('booksPageSearch')} autoComplete="off" />
            {query && <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label={t('booksPageSearchClear')}><FilesCloseIcon size={18} /></button>}
          </label>
          <div className={styles.views} role="group" aria-label={t('booksPageViewsAria')}>
            <button type="button" aria-pressed={view === 'shelf'} onClick={() => setView('shelf')}>{t('booksPageViewShelf')}</button>
            <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>{t('booksPageViewMine')}<span className={styles.cnt}>{counts.saved}</span></button>
          </div>
          {canManage && (
            <button type="button" className={`${styles.btn} ${styles.btnPri} ${styles.btnPill} ${styles.btnUp}`} onClick={() => setUploadOpen(true)}>
              <FilesUploadIcon size={20} />{t('booksPageUpload')}
            </button>
          )}
        </header>

        {view === 'shelf' && list.length > 0 && (
          <div className={styles.shelves} role="group" aria-label={t('booksPageShelvesAria')}>
            {shelves.map(s => (
              <button key={s.kind} type="button" className={styles.shelf} aria-pressed={filter === s.kind} onClick={() => setFilter(s.kind)}>
                <ShelfArt kind={s.kind} />
                <span className={styles.lab}>{s.label}<span className={styles.n}>{s.n}</span></span>
              </button>
            ))}
          </div>
        )}

        {isError && books && (
          <div className={styles.notice} role="status">
            <span>{t('booksPageRefreshFailed')}</span>
            <button type="button" onClick={() => { void refetch() }}>{t('retry')}</button>
          </div>
        )}
        <div className={styles.content}>{content()}</div>
      </main>

      {quick && (
        <BookQuickView
          book={quick}
          canManage={canManage}
          onClose={() => setQuickId(null)}
          onChanged={onChanged}
          onShare={canManage ? b => { setQuickId(null); setShareTarget({ itemType: 'file', id: b.id, name: b.title, isBook: true }) } : undefined}
        />
      )}
      {shareTarget && <ShareAccessModal target={shareTarget} onClose={() => setShareTarget(null)} onChanged={() => { void queryClient.invalidateQueries({ queryKey: BOOKS_KEY }) }} />}
      {canManage && <BookUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={onUploaded} />}
    </div>
  )
}

/** Prev/next buttons for the scroller `#trackId`; disabled at the ends. `watch` remounts the observers when the content changes. */
function CarouselArrows({ trackId, prev, next, watch }: { trackId: string; prev: string; next: string; watch: string }) {
  const [edge, setEdge] = useState({ start: true, end: true })
  useEffect(() => {
    const track = document.getElementById(trackId)
    if (!track) return
    const update = () => setEdge({ start: track.scrollLeft <= 4, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 })
    // ResizeObserver reports once on observe → the initial state; it also follows content/viewport changes.
    const ro = new ResizeObserver(update)
    ro.observe(track)
    if (track.firstElementChild) ro.observe(track.firstElementChild)
    track.addEventListener('scroll', update, { passive: true })
    return () => { ro.disconnect(); track.removeEventListener('scroll', update) }
  }, [trackId, watch])

  const go = (dir: 1 | -1) => {
    const track = document.getElementById(trackId)
    if (!track) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }
  return (
    <div className={styles.arrows}>
      <button type="button" className={styles.round} onClick={() => go(-1)} disabled={edge.start} aria-label={prev}><ChevronLeftIcon size={20} strokeWidth={2} /></button>
      <button type="button" className={styles.round} onClick={() => go(1)} disabled={edge.end} aria-label={next}><ChevronRightIcon size={20} strokeWidth={2} /></button>
    </div>
  )
}

interface HeroProps {
  book: LibraryBook
  stack: LibraryBook[]
  minis: { kind: MiniKind; label: string; filter: BookFilter; countLabel: string }[] | null
  onOpen: (b: LibraryBook) => void
  onToggleSave: (b: LibraryBook) => void
  onPick: (f: BookFilter) => void
}

const STACK_OFFSETS = ['0px', '8px', '-2px', '10px', '3px']
const STACK_WIDTHS = ['100%', '90%', '98%', '86%', '94%']

/** "Continue reading": the last opened unfinished book, big, with progress and a straight link into the reader. */
function Hero({ book, stack, minis, onOpen, onToggleSave, onPick }: HeroProps) {
  const t = useTranslations('files')
  const pct = book.progress?.pct ?? 0
  const last = book.progress?.lastPage ?? 1
  const meta = book.pageCount ? t('booksKitMeta', { teacher: book.teacherName, pages: book.pageCount }) : book.teacherName
  return (
    <section className={styles.hero} aria-labelledby="bp-hero">
      <div className={styles.heroIn}>
        <div className={styles.heroStack} aria-hidden="true">
          {stack.map((s, i) => {
            const c = safeSpine(s.cover.spineColor)
            return <div key={s.id} className={styles.sp} style={vars({ '--c': c, '--ci': inkOn(c), '--o': STACK_OFFSETS[i], '--w': STACK_WIDTHS[i] })}><span>{s.title}</span></div>
          })}
        </div>
        <div className={styles.heroBook}>
          <BookCover title={book.title} spineColor={book.cover.spineColor} coverUrl={book.cover.url} coverKind={book.cover.kind} size="fluid" saved={book.saved} onToggleSave={() => onToggleSave(book)} />
        </div>
        <div className={styles.heroTxt}>
          <h2 id="bp-hero">{t('booksPageHeroTitle')}</h2>
          <p className={styles.ttl} title={book.title}>{book.title}</p>
          <p className={styles.by}>{meta}</p>
          <div className={styles.heroProg}>
            <div className={styles.row}>
              <span>{book.pageCount ? t('booksPageHeroPage', { page: last, pages: book.pageCount }) : t('booksPageHeroPageOnly', { page: last })}</span>
              <b>{pct}%</b>
            </div>
            <div className={styles.pbar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('booksKitProgressAria')}><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className={styles.heroCta}>
            <Link href={`/files/books/${book.id}`} className={`${styles.btn} ${styles.btnPri}`}><BookOpenIcon size={18} />{t('booksKitRead')}</Link>
            <button type="button" className={styles.btn} onClick={() => onOpen(book)}>{t('booksPageHeroDetails')}</button>
          </div>
        </div>
        {minis && (
          <div className={styles.mini} role="group" aria-label={t('booksPageMiniAria')}>
            {minis.map(m => (
              <button key={m.kind} type="button" className={styles.mc} onClick={() => onPick(m.filter)}>
                <MiniArt kind={m.kind} />
                <div><b>{m.label}</b><span>{m.countLabel}</span></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
