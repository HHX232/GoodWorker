'use client'

import { FC } from 'react'
import styles from './LanguageSelect.module.scss'
import { FlagIcon } from '@/shared/ui/FlagIcon/FlagIcon'

export interface LangDef {
  code: string
  native: string
  flag: string
}

export const TEACHER_LANGUAGES: LangDef[] = [
  { code: 'ru', native: 'Русский',    flag: 'RU' },
  { code: 'en', native: 'English',    flag: 'GB' },
  { code: 'zh', native: '中文',       flag: 'CN' },
  { code: 'hi', native: 'हिन्दी',     flag: 'IN' },
  { code: 'es', native: 'Español',    flag: 'ES' },
  { code: 'fr', native: 'Français',   flag: 'FR' },
  { code: 'de', native: 'Deutsch',    flag: 'DE' },
  { code: 'ar', native: 'العربية',    flag: 'SA' },
  { code: 'pt', native: 'Português',  flag: 'BR' },
  { code: 'ja', native: '日本語',     flag: 'JP' },
  { code: 'ko', native: '한국어',     flag: 'KR' },
  { code: 'tr', native: 'Türkçe',    flag: 'TR' },
  { code: 'it', native: 'Italiano',   flag: 'IT' },
  { code: 'uk', native: 'Українська', flag: 'UA' },
  { code: 'kk', native: 'Қазақша',   flag: 'KZ' },
]

interface Props {
  value: string[]
  onChange: (langs: string[]) => void
  label?: string
}

const LanguageSelect: FC<Props> = ({ value, onChange, label = 'Языки преподавания' }) => {
  const toggle = (code: string) => {
    onChange(
      value.includes(code)
        ? value.filter((l) => l !== code)
        : [...value, code]
    )
  }

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.grid}>
        {TEACHER_LANGUAGES.map((lang) => {
          const selected = value.includes(lang.code)
          return (
            <button
              key={lang.code}
              type="button"
              className={`${styles.chip} ${selected ? styles.selected : ''}`}
              onClick={() => toggle(lang.code)}
            >
              <FlagIcon code={lang.flag} width={20} />
              <span className={styles.native}>{lang.native}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LanguageSelect
