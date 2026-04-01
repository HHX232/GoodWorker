import * as React from 'react'
import styles from './Badge.module.scss'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

function Badge({className, variant = 'default', ...props}: BadgeProps) {
  const variantClass = styles[variant] ?? styles.default

  return <div className={[styles.badge, variantClass, className].filter(Boolean).join(' ')} {...props} />
}

export {Badge}
