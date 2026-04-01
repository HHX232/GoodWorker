import * as React from 'react'
import {Slot} from '@radix-ui/react-slot'
import styles from './Button.module.scss'

type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'sidebarItem'
  | 'sidebarActiveItem'

type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({className, variant = 'default', size = 'default', asChild = false, ...props}, ref) => {
    const Comp = asChild ? Slot : 'button'

    const classes = [styles.button, styles[variant], size !== 'default' ? styles[size] : undefined, className]
      .filter(Boolean)
      .join(' ')

    return <Comp className={classes} ref={ref} {...props} />
  }
)

Button.displayName = 'Button'

export {Button}
