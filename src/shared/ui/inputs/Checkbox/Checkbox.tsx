'use client'

import cn from 'clsx'
import { ReactNode, useId } from 'react'
import styles from './Checkbox.module.scss'

interface CheckboxUIProps {
  label: string | ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string
  extraClass?: string
  description?: string
}

export function CheckboxUI({
  label,
  checked,
  onChange,
  disabled = false,
  error,
  extraClass,
  description
}: CheckboxUIProps) {
  const id = useId()

  return (
    <div className={cn(styles.checkboxWrapper, extraClass)}>
      <label
        htmlFor={id}
        className={cn(styles.checkboxLabel, {
          [styles.disabled]: disabled,
          [styles.error]: error
        })}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={styles.checkboxInput}
        />
        <span className={styles.checkboxCustom}>
          {checked && (
            <svg
              className={styles.checkIcon}
              viewBox="0 0 16 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.5 6L6 10.5L14.5 2"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <div className={styles.labelContent}>
          <span className={styles.labelText}>{label}</span>
          {description && (
            <span className={styles.labelDescription}>{description}</span>
          )}
        </div>
      </label>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  )
}