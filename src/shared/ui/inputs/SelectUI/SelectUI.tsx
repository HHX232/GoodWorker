'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import styles from './SelectUI.module.scss'

export interface SelectOption {
  value: string
  label: string
}

interface SelectUIProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  error?: boolean
}

/** Generic single-value animated dropdown — a styled drop-in replacement for
 * a plain native `<select>` wherever the browser default looks out of place. */
export function SelectUI({ value, onChange, options, className, error }: SelectUIProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const active = options.find(o => o.value === value)

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type='button'
        className={`${styles.trigger} ${className ?? ''} ${error ? styles.triggerError : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        <span className={styles.triggerLabel}>{active?.label ?? ''}</span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>
          <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
            <path d='M2 4L6 8L10 4' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
          </svg>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            className={styles.dropdown}
            role='listbox'
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {options.map(opt => (
              <li
                key={opt.value}
                role='option'
                aria-selected={opt.value === value}
                className={`${styles.dropdownItem} ${opt.value === value ? styles.dropdownItemActive : ''}`}
                onMouseDown={() => { setIsOpen(false); onChange(opt.value) }}
              >
                {opt.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
