'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, useEffect, useRef, useState } from 'react'
import styles from './GradeSelect.module.scss'

export type EducationLevel = 'school' | 'university'

export interface GradeValue {
  level: EducationLevel
  number: number
}

interface GradeGroup {
  level: EducationLevel
  title: string
  max: number
  optionLabel: (n: number) => string
}

interface GradeSelectProps {
  value: GradeValue | null
  onChange: (value: GradeValue | null) => void
  placeholder: string
  schoolGroupLabel: string
  universityGroupLabel: string
  schoolOptionLabel: (grade: number) => string
  universityOptionLabel: (course: number) => string
}

export function GradeSelect({
  value,
  onChange,
  placeholder,
  schoolGroupLabel,
  universityGroupLabel,
  schoolOptionLabel,
  universityOptionLabel,
}: GradeSelectProps) {
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

  const groups: GradeGroup[] = [
    { level: 'school', title: schoolGroupLabel, max: 11, optionLabel: schoolOptionLabel },
    { level: 'university', title: universityGroupLabel, max: 6, optionLabel: universityOptionLabel },
  ]

  const activeLabel = value
    ? (value.level === 'school' ? schoolOptionLabel(value.number) : universityOptionLabel(value.number))
    : placeholder

  const handleSelect = (next: GradeValue | null) => {
    setIsOpen(false)
    onChange(next)
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type='button'
        className={styles.trigger}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
      >
        <span className={`${styles.triggerLabel} ${!value ? styles.placeholder : ''}`}>{activeLabel}</span>
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
            <li
              role='option'
              aria-selected={!value}
              className={`${styles.clearItem} ${!value ? styles.dropdownItemActive : ''}`}
              onMouseDown={() => handleSelect(null)}
            >
              {placeholder}
            </li>
            {groups.map(group => (
              <Fragment key={group.level}>
                <li className={styles.groupHeader} role='presentation'>{group.title}</li>
                {Array.from({ length: group.max }, (_, i) => i + 1).map(n => {
                  const selected = value?.level === group.level && value.number === n
                  return (
                    <li
                      key={n}
                      role='option'
                      aria-selected={selected}
                      className={`${styles.dropdownItem} ${selected ? styles.dropdownItemActive : ''}`}
                      onMouseDown={() => handleSelect({ level: group.level, number: n })}
                    >
                      {group.optionLabel(n)}
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
