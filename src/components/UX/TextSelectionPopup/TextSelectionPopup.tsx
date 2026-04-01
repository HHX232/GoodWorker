'use client'

import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import styles from './TextSelectionPopup.module.scss'

interface TextSelectionPopupProps {
  children: React.ReactNode
}

interface PopupPosition {
  top: number
  left: number
  show: boolean
  showBelow: boolean
}

export default function TextSelectionPopup({children}: TextSelectionPopupProps) {
  const [position, setPosition] = useState<PopupPosition>({
    top: 0,
    left: 0,
    show: false,
    showBelow: false
  })
  const [selectedText, setSelectedText] = useState('')
  const [mounted, setMounted] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()

      if (text && text.length > 0) {
        setSelectedText(text)
        const range = selection?.getRangeAt(0)
        const rect = range?.getBoundingClientRect()

        if (rect) {
          const popupHeight = 60 // Примерная высота попапа
          const popupWidth = 400 // Примерная ширина попапа
          const scrollY = window.scrollY
          const scrollX = window.scrollX

          let top = rect.top + scrollY - popupHeight - 10
          let left = rect.left + scrollX + rect.width / 2 - popupWidth / 2
          let showBelow = false

          // Если сверху нет места, показываем снизу
          if (rect.top < popupHeight + 20) {
            top = rect.bottom + scrollY + 10
            showBelow = true
          }

          // Проверяем, чтобы не выходило за края экрана по горизонтали
          if (left < 10) {
            left = 10
          } else if (left + popupWidth > window.innerWidth - 10) {
            left = window.innerWidth - popupWidth - 10
          }

          setPosition({
            top,
            left,
            show: true,
            showBelow
          })
        }
      } else {
        setPosition((prev) => ({...prev, show: false}))
        setSelectedText('')
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && position.show) {
        window.getSelection()?.removeAllRanges()
        setPosition((prev) => ({...prev, show: false}))
        setSelectedText('')
      }
    }

    document.addEventListener('mouseup', handleSelection)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [position.show])

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText)
    alert('Текст скопирован!')
  }

  const handleSearch = () => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(selectedText)}`, '_blank')
  }

  const handleHighlight = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.backgroundColor = '#000000'
      span.style.color = '#ffffff'
      span.style.padding = '2px 4px'
      range.surroundContents(span)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        text: selectedText
      })
    } else {
      alert(`Поделиться: "${selectedText}"`)
    }
  }

  const portalTarget = mounted ? document.getElementById('modal-portal') : null

  return (
    <>
      <div ref={containerRef} className={styles.container}>
        {children}
      </div>

      {mounted &&
        portalTarget &&
        position.show &&
        createPortal(
          <div
            ref={popupRef}
            className={`${styles.popup} ${position.showBelow ? styles.popupBelow : ''}`}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`
            }}
          >
            <div className={styles.popupContent}>
              <button className={styles.popupButton} onClick={handleCopy} title='Копировать'>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                  <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
                <span>Копировать</span>
              </button>

              <button className={styles.popupButton} onClick={handleSearch} title='Поиск'>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <circle cx='11' cy='11' r='8' />
                  <path d='m21 21-4.35-4.35' />
                </svg>
                <span>Поиск</span>
              </button>

              <button className={styles.popupButton} onClick={handleHighlight} title='Выделить'>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='m9 11-6 6v3h9l3-3' />
                  <path d='m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' />
                </svg>
                <span>Выделить</span>
              </button>

              <button className={styles.popupButton} onClick={handleShare} title='Поделиться'>
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <circle cx='18' cy='5' r='3' />
                  <circle cx='6' cy='12' r='3' />
                  <circle cx='18' cy='19' r='3' />
                  <line x1='8.59' y1='13.51' x2='15.42' y2='17.49' />
                  <line x1='15.41' y1='6.51' x2='8.59' y2='10.49' />
                </svg>
                <span>Поделиться</span>
              </button>
            </div>

            <div className={styles.popupArrow} />
          </div>,
          portalTarget
        )}
    </>
  )
}
