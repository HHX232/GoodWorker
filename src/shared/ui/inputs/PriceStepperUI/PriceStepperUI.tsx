'use client'

import { FC } from 'react'
import styles from './PriceStepperUI.module.scss'

interface Props {
  value: number
  onChange: (value: number) => void
  step?: number
  label?: string
  placeholder?: string
}

export const PriceStepperUI: FC<Props> = ({ value, onChange, step = 100, label, placeholder = '0' }) => {
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    onChange(digits ? Number(digits) : 0)
  }

  function bump(dir: number) {
    onChange(Math.max(0, value + dir * step))
  }

  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.control}>
        <button type='button' className={styles.btn} onClick={() => bump(-1)} aria-label='Уменьшить'>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M5 12h14' /></svg>
        </button>
        <input
          type='text'
          inputMode='numeric'
          className={styles.input}
          value={value || ''}
          onChange={handleInput}
          placeholder={placeholder}
          autoComplete='off'
        />
        <button type='button' className={styles.btn} onClick={() => bump(1)} aria-label='Увеличить'>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M12 5v14M5 12h14' /></svg>
        </button>
      </span>
    </label>
  )
}
