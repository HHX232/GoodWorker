'use client'

import { FC } from 'react'
import styles from './LanguageSelect.module.scss'

export interface LangDef {
  code: string
  native: string
  flag: string
}

export const TEACHER_LANGUAGES: LangDef[] = [
  { code: 'ru', native: 'Русский',    flag: '🇷🇺' },
  { code: 'en', native: 'English',    flag: '🇬🇧' },
  { code: 'zh', native: '中文',       flag: '🇨🇳' },
  { code: 'hi', native: 'हिन्दी',     flag: '🇮🇳' },
  { code: 'es', native: 'Español',    flag: '🇪🇸' },
  { code: 'fr', native: 'Français',   flag: '🇫🇷' },
  { code: 'de', native: 'Deutsch',    flag: '🇩🇪' },
  { code: 'ar', native: 'العربية',    flag: '🇸🇦' },
  { code: 'pt', native: 'Português',  flag: '🇧🇷' },
  { code: 'ja', native: '日本語',     flag: '🇯🇵' },
  { code: 'ko', native: '한국어',     flag: '🇰🇷' },
  { code: 'tr', native: 'Türkçe',    flag: '🇹🇷' },
  { code: 'it', native: 'Italiano',   flag: '🇮🇹' },
  { code: 'uk', native: 'Українська', flag: '🇺🇦' },
  { code: 'kk', native: 'Қазақша',   flag: '🇰🇿' },
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
              <span className={styles.flag}>{lang.flag}</span>
              <span className={styles.native}>{lang.native}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LanguageSelect
