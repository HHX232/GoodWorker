'use client'

import cn from 'clsx'
import { ReactNode, useId } from 'react'
import styles from './RadioUI.module.scss'

interface RadioUIProps {
  label: string | ReactNode
  value: string
  checked: boolean
  onChange: (value: string) => void
  name: string
  disabled?: boolean
  error?: string
  extraClass?: string
  description?: string
  icon?: React.ReactNode
}

export function RadioUI({
  label,
  value,
  checked,
  onChange,
  name,
  disabled = false,
  error,
  extraClass,
  description,
  icon
}: RadioUIProps) {
  const id = useId()

  return (
    <div className={cn(styles.radioWrapper, extraClass)}>
      <label
        htmlFor={id}
        className={cn(styles.radioLabel, {
          [styles.checked]: checked,
          [styles.disabled]: disabled,
          [styles.error]: error
        })}
      >
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          disabled={disabled}
          className={styles.radioInput}
        />
        
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
        
        <div className={styles.contentWrapper}>
          <div className={styles.labelContent}>
            <span className={styles.labelText}>{label}</span>
            {description && (
              <span className={styles.labelDescription}>{description}</span>
            )}
          </div>
          
          <div className={styles.checkmarkWrapper}>
            {checked && (
              <svg
                className={styles.checkmark}
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="8" cy="8" r="8" fill="currentColor" />
                <path
                  d="M5 8L7 10L11 6"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {!checked && (
              <div className={styles.emptyCircle} />
            )}
          </div>
        </div>
      </label>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  )
}