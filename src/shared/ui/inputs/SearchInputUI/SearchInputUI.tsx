'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './SearchInputUI.module.scss'
import { SearchItem, SearchInputUIProps } from '@/shared/types'


const MOCK_ITEMS: SearchItem[] = [
  { id: 1, label: 'Разработчик React' },
  { id: 2, label: 'Разработчик Node.js' },
  { id: 3, label: 'UI/UX Дизайнер' },
  { id: 4, label: 'Проектный менеджер' },
  { id: 5, label: 'DevOps инженер' },
  { id: 6, label: 'Backend разработчик' },
  { id: 7, label: 'Frontend разработчик' },
  { id: 8, label: 'Тестировщик QA' },
  { id: 9, label: 'Аналитик данных' },
  { id: 10, label: 'Мобильный разработчик' },
]



export function SearchInputUI({
  placeholder = 'Поиск...',
  items = MOCK_ITEMS,
  onSelect,
  onChange,
}: SearchInputUIProps) {
  const [value, setValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [filtered, setFiltered] = useState<SearchItem[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.trim()) {
      
      setFiltered(items)
      setIsOpen(items.length > 0)
    } else {
      setFiltered([])
      setIsOpen(false)
    }
  }, [value, items])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    onChange?.(e.target.value)
  }

  const handleSelect = (item: SearchItem) => {
    setValue(item.label)
    setIsOpen(false)
    onSelect?.(item)
  }

  return (
    <div className={styles.searchWrapper} ref={wrapperRef}>
      <div className={styles.searchInputContainer}>
        <Image
          src="/icons/header/search.svg"
          alt="search"
          width={18}
          height={18}
          className={styles.searchIcon}
        />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={styles.searchInput}
        />
      </div>

      {isOpen && (
        <ul className={styles.searchDropdown}>
          {filtered.map((item) => (
            <li
              key={item.id}
              className={styles.searchDropdownItem}
              onMouseDown={() => handleSelect(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}