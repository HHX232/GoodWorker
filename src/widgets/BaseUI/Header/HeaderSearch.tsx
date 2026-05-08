'use client'

import Image from 'next/image'
import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'
import styles from './HeaderSearch.module.scss'

// ─── Types ───────────────────────────────────────────────

interface SearchResult {
  posts: {id: string; title: string; teacher: {name: string}}[]
  teachers: {id: string; name: string; avatarUrl: string | null}[]
  roadmaps: {id: string; title: string; teacher: {name: string}}[]
}

// ─── Icons ───────────────────────────────────────────────

const SearchIcon = () => (
  <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <circle cx='11' cy='11' r='8' /><path d='M21 21l-4.35-4.35' />
  </svg>
)

const PostIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
    <polyline points='14 2 14 8 20 8' />
  </svg>
)

const MapIcon = () => (
  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
    <polygon points='1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6' />
    <line x1='8' y1='2' x2='8' y2='18' /><line x1='16' y1='6' x2='16' y2='22' />
  </svg>
)

// ─── Per-page config ──────────────────────────────────────

const SIMPLE_PAGES: Record<string, {placeholder: string; buildUrl: (q: string) => string}> = {
  '/teachers': {
    placeholder: 'Поиск учителей...',
    buildUrl: (q) => `/teachers?q=${encodeURIComponent(q)}`
  },
  '/workflows-list': {
    placeholder: 'Поиск курсов...',
    buildUrl: (q) => `/workflows-list?search=${encodeURIComponent(q)}`
  }
}

const HOME_PLACEHOLDER = 'Поиск по постам, учителям и курсам...'

// ─── Global search dropdown ───────────────────────────────

function GlobalDropdown({
  query,
  onClose
}: {query: string; onClose: () => void}) {
  const [data, setData] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setData(null)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    fetch(`/api/search?q=${encodeURIComponent(query)}`, {signal: ctrl.signal})
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [query])

  if (!query || query.length < 2) return null

  const hasAny = data && (data.posts.length > 0 || data.teachers.length > 0 || data.roadmaps.length > 0)

  return (
    <div className={styles.dropdown}>
      {loading && <p className={styles.loading}>Поиск...</p>}
      {!loading && data && !hasAny && <p className={styles.empty}>Ничего не найдено</p>}

      {!loading && data?.posts && data.posts.length > 0 && (
        <>
          <p className={styles.section_title}>Посты</p>
          {data.posts.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className={styles.result_item} onClick={onClose}>
              <span className={styles.result_icon}><PostIcon /></span>
              <span className={styles.result_text}>
                <span className={styles.result_name}>{p.title}</span>
                <span className={styles.result_sub}>{p.teacher.name}</span>
              </span>
            </Link>
          ))}
          <Link href={`/?q=${encodeURIComponent(query)}`} className={styles.see_all} onClick={onClose}>
            Все посты →
          </Link>
        </>
      )}

      {!loading && data?.teachers && data.teachers.length > 0 && (
        <>
          {data.posts && data.posts.length > 0 && <div className={styles.divider} />}
          <p className={styles.section_title}>Учителя</p>
          {data.teachers.map((t) => (
            <Link key={t.id} href={`/users/${t.id}`} className={styles.result_item} onClick={onClose}>
              <span className={styles.result_icon}>
                {t.avatarUrl
                  ? <Image src={t.avatarUrl} alt={t.name} width={28} height={28} className={styles.result_icon_img} />
                  : t.name[0]?.toUpperCase()
                }
              </span>
              <span className={styles.result_text}>
                <span className={styles.result_name}>{t.name}</span>
              </span>
            </Link>
          ))}
          <Link href={`/teachers?q=${encodeURIComponent(query)}`} className={styles.see_all} onClick={onClose}>
            Все учителя →
          </Link>
        </>
      )}

      {!loading && data?.roadmaps && data.roadmaps.length > 0 && (
        <>
          {((data.posts && data.posts.length > 0) || (data.teachers && data.teachers.length > 0)) && (
            <div className={styles.divider} />
          )}
          <p className={styles.section_title}>Курсы</p>
          {data.roadmaps.map((r) => (
            <Link key={r.id} href={`/road-map/${r.id}`} className={styles.result_item} onClick={onClose}>
              <span className={styles.result_icon}><MapIcon /></span>
              <span className={styles.result_text}>
                <span className={styles.result_name}>{r.title}</span>
                <span className={styles.result_sub}>{r.teacher.name}</span>
              </span>
            </Link>
          ))}
          <Link href={`/workflows-list?search=${encodeURIComponent(query)}`} className={styles.see_all} onClick={onClose}>
            Все курсы →
          </Link>
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────

export function HeaderSearch() {
  const pathname = usePathname()
  const router = useRouter()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHome = pathname === '/'
  const simpleCfg = SIMPLE_PAGES[pathname]
  const showSearch = isHome || !!simpleCfg

  useEffect(() => {
    setValue('')
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleChange = useCallback(
    (v: string) => {
      setValue(v)
      if (!isHome && simpleCfg) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          if (v.trim()) router.push(simpleCfg.buildUrl(v.trim()))
        }, 400)
      } else {
        setOpen(v.length >= 2)
      }
    },
    [isHome, simpleCfg, router]
  )

  const handleClose = useCallback(() => {
    setOpen(false)
    setValue('')
  }, [])

  if (!showSearch) return null

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.input_row}>
        <span className={styles.icon}><SearchIcon /></span>
        <input
          className={styles.input}
          type='text'
          placeholder={isHome ? HOME_PLACEHOLDER : simpleCfg?.placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => isHome && value.length >= 2 && setOpen(true)}
        />
        {value && (
          <button className={styles.clear_btn} onClick={handleClose} type='button'>
            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round'>
              <line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        )}
      </div>

      {isHome && open && <GlobalDropdown query={value} onClose={handleClose} />}
    </div>
  )
}
