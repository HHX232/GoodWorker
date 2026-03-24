'use client'
import {CSSProperties, FC, ReactNode, useEffect, useId, useRef, useState} from 'react'
import styles from './TextAreaUI.module.scss'
import Image, {StaticImageData} from 'next/image'
import cn from 'clsx'
import Link from 'next/link'
import {Url} from 'next/dist/shared/lib/router/router'

const hideIcon = '/hide__text.svg'
const showIcon = '/show__text.svg'

interface ITextAreaProps {
  extraClass?: string
  extraStyle?: CSSProperties
  placeholder: string
  title?: string | ReactNode
  helpTitle?: string
  isSecret?: boolean
  currentValue: string
  onSetValue: (value: string) => void
  errorValue?: string
  customIcon?: StaticImageData
  customIconOnAlternativeState?: StaticImageData
  linkToHelp?: Url
  theme?: 'dark' | 'light' | 'superWhite' | 'lightBlue' | 'newWhite'
  // Дополнительные события для textarea
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onMouseEnter?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  onClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  idForLabel?: string
  rows?: number
  cols?: number
  maxLength?: number
  minLength?: number
  resize?: 'none' | 'both' | 'horizontal' | 'vertical'
  autoResize?: boolean // Новый пропс для автоподстройки высоты
  maxRows?: number // Максимальное количество строк при автоподстройке
  minRows?: number // Минимальное количество строк при автоподстройке
  minHeight?: number // Минимальная высота в пикселях
}

export const TextAreaUI: FC<ITextAreaProps> = ({
  extraClass,
  extraStyle,
  placeholder = '',
  title = '',
  helpTitle,
  isSecret = false,
  currentValue,
  onSetValue,
  errorValue,
  customIcon,
  customIconOnAlternativeState,
  linkToHelp = '',
  theme = 'newWhite',
  onBlur,
  onFocus,
  onKeyDown,
  onKeyUp,
  onMouseEnter,
  onMouseLeave,
  onClick,
  idForLabel,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  rows = 4,
  cols,
  maxLength,
  minLength,
  resize = 'none',
  autoResize = false,
  maxRows,
  minRows = 1,
  minHeight
}) => {
  const [textIsShow, setTextIsShow] = useState(false)
  const [displayValue, setDisplayValue] = useState(isSecret ? currentValue.replace(/./g, '*') : currentValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  const adjustHeight = () => {
    if (!autoResize || !textareaRef.current) return

    const textarea = textareaRef.current
    const computedStyle = window.getComputedStyle(textarea)
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0

    textarea.style.height = 'auto'

    const scrollHeight = textarea.scrollHeight
    const calculatedMinHeight = minHeight !== undefined ? minHeight : minRows * lineHeight + paddingTop + paddingBottom
    const maxHeight = maxRows ? maxRows * lineHeight + paddingTop + paddingBottom : Infinity

    const newHeight = Math.max(calculatedMinHeight, Math.min(scrollHeight, maxHeight))

    textarea.style.height = `${newHeight}px`
  }

  useEffect(() => {
    setDisplayValue(isSecret && !textIsShow ? currentValue.replace(/./g, '*') : currentValue)
    if (autoResize) {
      setTimeout(adjustHeight, 0)
    }
  }, [currentValue, isSecret, textIsShow, autoResize])

  useEffect(() => {
    if (autoResize) {
      adjustHeight()
    }
  }, [autoResize])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value

    if (isSecret) {
      if (value.length > displayValue.length) {
        const addedChars = value.slice(displayValue.length)
        const newValue = currentValue + addedChars
        onSetValue(newValue)
      } else {
        const newValue = value.length === 0 ? '' : currentValue.slice(0, value.length)
        onSetValue(newValue)
      }
    } else {
      // Для обычного ввода просто обновляем значение
      onSetValue(value)
    }

    // Подстраиваем высоту после изменения значения
    if (autoResize) {
      setTimeout(adjustHeight, 0)
    }
  }

  const toggleTextVisibility = () => {
    setTextIsShow(!textIsShow)
    // Подстраиваем высоту при смене видимости текста
    if (autoResize) {
      setTimeout(adjustHeight, 0)
    }
  }

  return (
    <label
      style={{...extraStyle}}
      htmlFor={idForLabel ? idForLabel : id}
      className={cn(extraClass, styles.textarea__box, {
        [styles.dark]: theme === 'dark',
        [styles.light]: theme === 'light',
        [styles.superWhite]: theme === 'superWhite',
        [styles.lightBlue]: theme === 'lightBlue',
        [styles.newWhite]: theme === 'newWhite'
      })}
    >
      <div className={`${styles.titles_box}`}>
        {typeof title === typeof 'string' ? <p className={`${styles.textarea__title}`}>{title}</p> : title}
        {helpTitle && (
          <Link href={linkToHelp} className={`${styles.help__title}`}>
            {helpTitle}
          </Link>
        )}
      </div>
      <div className={`${styles.textarea__inner__box} ${errorValue && styles.error__textarea__inner__box}`}>
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={isSecret ? (textIsShow ? currentValue : displayValue) : currentValue}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          rows={autoResize ? minRows : rows}
          cols={cols}
          maxLength={maxLength}
          minLength={minLength}
          className={cn(styles.textarea, {
            [styles.error__textarea]: errorValue
          })}
          style={{
            resize: autoResize ? 'none' : resize,
            overflow: autoResize && maxRows ? 'auto' : 'hidden',
            minHeight: minHeight !== undefined ? `${minHeight}px` : undefined
          }}
          id={idForLabel ? idForLabel : id}
        />
        {isSecret &&
          (!customIcon ? (
            <div className={`${styles.secret__box}`} onClick={toggleTextVisibility}>
              {textIsShow ? (
                <Image style={{cursor: 'pointer'}} width={22} height={18} alt='Hide text' src={hideIcon} />
              ) : (
                <Image style={{cursor: 'pointer'}} width={22} height={18} alt='Show text' src={showIcon} />
              )}
            </div>
          ) : (
            <div className={`${styles.secret__box}`} onClick={toggleTextVisibility}>
              {textIsShow ? (
                customIconOnAlternativeState ? (
                  <Image src={customIconOnAlternativeState} alt='Hide text' />
                ) : (
                  <Image src={customIcon} alt='Hide text' />
                )
              ) : (
                <Image src={customIcon} alt='Show text' />
              )}
            </div>
          ))}
      </div>
      {errorValue && <div className={`${styles.error__text}`}>{errorValue}</div>}
    </label>
  )
}
