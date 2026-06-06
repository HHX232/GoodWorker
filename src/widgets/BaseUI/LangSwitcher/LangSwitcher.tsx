'use client'

import {useLocale} from 'next-intl'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {useEffect, useRef, useState, useTransition} from 'react'
import styles from './LangSwitcher.module.scss'
import {FlagIcon} from '@/shared/ui/FlagIcon/FlagIcon'

interface LangItem {
  code: string
  label: string
  flag: string
}

const LANGS: LangItem[] = [
  {code: 'ru', label: 'Русский', flag: 'RU'},
  {code: 'en', label: 'English', flag: 'GB'},
  {code: 'zh', label: '中文', flag: 'CN'},
  {code: 'hi', label: 'हिन्दी', flag: 'IN'}
]

export function LangSwitcher({extraClass = ''}:{extraClass?:string}) {
  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [isOpen, setIsOpen] = useState(false)
  const [pendingLang, setPendingLang] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const active = LANGS.find((l) => l.code === locale) ?? LANGS[0]

  // закрываем дропдаун при клике вне
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // react-compiler не жалуется на side-effects внутри эффектов
  useEffect(() => {
    if (!pendingLang) return
    document.cookie = `NEXT_LOCALE=${pendingLang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    startTransition(() => router.refresh())
    setPendingLang(null)
  }, [pendingLang, router])

  const handleSelect = (lang: LangItem) => {
    setIsOpen(false)
    if (lang.code === locale) return
    setPendingLang(lang.code)
  }

  return (
    <div className={`${styles.wrapper} ${isPending ? styles.pending : ''} ${extraClass}`} ref={wrapperRef}>
      <button
        type='button'
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label='Сменить язык'
        disabled={isPending}
      >
        <span className={styles.triggerLabel}>{active.code.toUpperCase()}</span>
        <Image
          src='/arrow.svg'
          alt=''
          width={16}
          height={16}
          className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}
        />
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role='listbox' aria-label='Выбор языка'>
          {LANGS.map((lang) => (
            <li
              key={lang.code}
              role='option'
              aria-selected={lang.code === locale}
              className={`${styles.dropdownItem} ${lang.code === locale ? styles.dropdownItemActive : ''}`}
              onMouseDown={() => handleSelect(lang)}
            >
              <FlagIcon code={lang.flag} width={18} />
              <span className={styles.itemLabel}>{lang.label}</span>
              {lang.code === locale && <span className={styles.checkmark}>✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
