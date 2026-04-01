import clsx from 'clsx'
import styles from './SelectInput.module.scss'

type SelectVariant = 'default' | 'filled' | 'ghost' | 'danger' | 'success'
type SelectSize = 'sm' | 'md' | 'lg'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  placeholder?: string
  variant?: SelectVariant
  size?: SelectSize
  disabled?: boolean
  onChange?: (value: string) => void
  extraClass?: string
}

export default function SelectInput({
  options,
  value,
  placeholder = 'Choose...',
  variant = 'default',
  size = 'md',
  disabled,
  onChange,
  extraClass
}: SelectProps) {
  return (
    <select
      className={clsx(styles.select, styles[variant], styles[size], extraClass)}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value='' disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
