'use client'
import {axiosClassic} from '@/shared/api'
import {useQuery} from '@tanstack/react-query'
import {useEffect, useRef, useState} from 'react'
import styles from './CategorySelect.module.scss'

interface CategoryOption {
  id: string
  slug: string
  levelNumber: number
  name: string
  parentId: string | null
}

interface CategorySelectProps {
  langCode?: string
  canSelectMany?: boolean
  maxLevel?: number
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}

const ACCENT_COLORS = ['#EC972A', '#FF7A00', '#BD00FF']

function getAccentColor(index: number) {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

function buildTree(categories: CategoryOption[]) {
  const map: Record<string, CategoryOption[]> = {}

  categories.forEach((cat) => {
    const key = cat.parentId ?? 'root'
    if (!map[key]) map[key] = []
    map[key].push(cat)
  })

  return map
}

function useCategories(langCode: string) {
  return useQuery({
    queryKey: ['categories', langCode],
    queryFn: async () => {
      const {data} = await axiosClassic.get<CategoryOption[]>('/categories', {
        params: {langCode}
      })
      return data
    },
    staleTime: 1000 * 60 * 5
  })
}

export function CategorySelect({
  langCode = 'ru',
  canSelectMany = true,
  maxLevel,
  value,
  onChange,
  placeholder = 'Выберите категории'
}: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  const {data: allCategories = [], isLoading} = useCategories(langCode)
  const categories = maxLevel ? allCategories.filter((c) => c.levelNumber <= maxLevel) : allCategories

  const treeMap = buildTree(categories)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (id: string) => {
    if (canSelectMany) {
      onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
    } else {
      onChange(value.includes(id) ? [] : [id])
    }
  }

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedCategories = categories.filter((c) => value.includes(c.id))

  function getColorForId(id: string): string {
    const cat = categories.find((c) => c.id === id)
    if (!cat) return ACCENT_COLORS[0]

    const rootParent = cat.parentId ?? cat.id
    const rootList = treeMap['root'] || []
    const idx = rootList.findIndex((c) => c.id === rootParent)

    return getAccentColor(idx >= 0 ? idx : 0)
  }

  function renderNodes(parentId: string | null, level: number): React.ReactNode {
    if (maxLevel && level > maxLevel) return null

    const nodes = treeMap[parentId ?? 'root'] || []

    if (level === 3) {
      // level 3 — чипсы
      return (
        <>
          {nodes.map((cat) => {
            const isActive = value.includes(cat.id)
            return (
              <button
                key={cat.id}
                type='button'
                className={`${styles.child_chip} ${isActive ? styles.child_chip_active : ''}`}
                style={isActive ? {background: '#EC972A', borderColor: '#EC972A'} : {}}
                onClick={() => toggle(cat.id)}
              >
                {cat.name}
              </button>
            )
          })}
        </>
      )
    }

    return nodes.map((cat, index) => {
      const isActive = value.includes(cat.id)
      const isExpanded = expandedIds.has(cat.id)
      const hasChildren = !!treeMap[cat.id]?.length
      const color = getAccentColor(index)

      return (
        <div key={cat.id} className={styles.group}>
          <div className={styles.row}>
            <button
              type='button'
              className={`${styles.row_label} ${isActive ? styles.row_label_active : ''}`}
              style={isActive ? {color, borderColor: color} : {}}
              onClick={() => toggle(cat.id)}
            >
              {cat.name}
            </button>

            {hasChildren && (
              <button
                type='button'
                className={`${styles.expand_btn} ${isExpanded ? styles.expand_btn_open : ''}`}
                onClick={(e) => toggleExpand(cat.id, e)}
              >
                <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                  <path
                    d='M2 4L6 8L10 4'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            )}
          </div>

          {hasChildren && isExpanded && <div className={styles.children}>{renderNodes(cat.id, level + 1)}</div>}
        </div>
      )
    })
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type='button'
        className={`${styles.trigger} ${open ? styles.trigger_open : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={isLoading}
      >
        {selectedCategories.length === 0 ? (
          <span className={styles.placeholder}>{isLoading ? 'Загрузка...' : placeholder}</span>
        ) : (
          <div className={styles.tags}>
            {selectedCategories.map((cat) => (
              <span
                key={cat.id}
                className={styles.tag}
                style={{
                  background: getColorForId(cat.id),
                  color: '#fff'
                }}
              >
                {cat.name}
                <span
                  className={styles.tag_remove}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    toggle(cat.id)
                  }}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}

        <span className={`${styles.arrow} ${open ? styles.arrow_up : ''}`}>
          <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
            <path
              d='M2 4L6 8L10 4'
              stroke='currentColor'
              strokeWidth='1.5'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </svg>
        </span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {(treeMap['root']?.length ?? 0) === 0 && <div className={styles.empty}>Нет категорий</div>}

          {renderNodes(null, 1)}
        </div>
      )}
    </div>
  )
}
