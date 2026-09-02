'use client'

import {TestBlock} from '@/entities/store/slices/tasksSlice.slice'
import {useEffect, useRef, useState} from 'react'
import {toast} from 'sonner'
import {downloadTestFile, ExportFormat} from './downloadTestFile'
import styles from './DownloadTestButton.module.scss'

interface FormatOption {
  format: ExportFormat
  label: string
  hint: string
}

const FORMATS: FormatOption[] = [
  {format: 'pdf', label: 'PDF', hint: 'для печати'},
  {format: 'docx', label: 'Word (.docx)', hint: 'для редактирования'},
  {format: 'txt', label: 'Текст (.txt)', hint: 'простой текст'},
  {format: 'md', label: 'Markdown (.md)', hint: 'для конспектов'}
]

export function DownloadTestButton({test}: {test: {title: string; description: string; blocks: TestBlock[]}}) {
  const [isOpen, setIsOpen] = useState(false)
  const [pending, setPending] = useState<ExportFormat | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleSelect = async (format: ExportFormat) => {
    setIsOpen(false)
    setPending(format)
    try {
      await downloadTestFile(test, format)
    } catch {
      toast.error('Не удалось скачать файл')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type='button'
        className={styles.download_btn}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={pending !== null}
      >
        <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
          <polyline points='7 10 12 15 17 10' />
          <line x1='12' y1='15' x2='12' y2='3' />
        </svg>
        {pending ? 'Готовим файл…' : 'Скачать как файл'}
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role='listbox' aria-label='Формат файла'>
          {FORMATS.map((f) => (
            <li key={f.format} className={styles.dropdownItem} onMouseDown={() => handleSelect(f.format)}>
              <span className={styles.itemLabel}>{f.label}</span>
              <span className={styles.itemHint}>{f.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
