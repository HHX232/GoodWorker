'use client'

import { DropInputItem, DropInputUIProps } from '@/shared/types'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './DropInputUI.module.scss'

export function DropInputUI({
  placeholder = 'Выбрать...',
  initialActiveItem,
  items = [],
}: DropInputUIProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<DropInputItem | undefined>(initialActiveItem)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item: DropInputItem) => {
    setActiveItem(item)
    setIsOpen(false)
    item.onItemClick?.(item)
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={styles.triggerLabel}>
          {activeItem ? activeItem.label : placeholder}
        </span>
        <Image
          src="/arrow.svg"
          alt="arrow"
          width={16}
          height={16}
          className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}
        />
      </button>

      {isOpen && items.length > 0 && (
        <ul className={styles.dropdown}>
          {items.map((item) => (
            <li
              key={item.id}
              className={`${styles.dropdownItem} ${activeItem?.id === item.id ? styles.dropdownItemActive : ''}`}
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