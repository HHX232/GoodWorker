'use client'
import React, {useState, useCallback, useRef, useEffect} from 'react'
import styles from './SliderForCreateImages.module.scss'
import Image from 'next/image'
import {useTranslations} from 'next-intl'

interface SliderForCreateImagesProps {
  images: string[]
  initialIndex?: number
  onClose: () => void
  isModalOpen?: boolean
}

const SliderForCreateImages: React.FC<SliderForCreateImagesProps> = ({
  images,
  initialIndex = 0,
  onClose,
  isModalOpen
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isZoomed, setIsZoomed] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({x: 0, y: 0})
  const imageRef = useRef<HTMLImageElement>(null)

  const t = useTranslations('modal')

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    setIsZoomed(false)
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
    setIsZoomed(false)
  }, [images.length])

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (!imageRef.current) return

      if (isZoomed) {
        setIsZoomed(false)
        return
      }

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      setZoomPosition({x, y})
      setIsZoomed(true)
    },
    [isZoomed]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [goToPrevious, goToNext, onClose]
  )

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }

    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isModalOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
    setIsZoomed(false)
  }, [])

  const currentImage = images[currentIndex]
  const isVideo = currentImage?.match(/\.(mp4|webm|mov|avi)$/i)

  return (
    <div style={{zIndex: '1010009999'}} className={`${styles.slider} ${isModalOpen && 'body__without__scrall'}`}>
      {/* Основной контент */}
      <div className={styles.mainContent}>
        {/* Стрелка влево */}
        {images.length > 1 && (
          <button className={`${styles.arrow} ${styles.arrowLeft}`} onClick={goToPrevious} aria-label={t('previous')}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
              <path
                d='M15 18L9 12L15 6'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        )}

        {/* Изображение или видео */}
        <div className={styles.mediaContainer}>
          {isVideo ? (
            <video src={currentImage} controls autoPlay muted loop className={styles.video} />
          ) : (
            <Image
              width={300}
              height={300}
              ref={imageRef}
              src={currentImage}
              alt={t('image', {number: currentIndex + 1})}
              className={`${styles.image} ${isZoomed ? styles.imageZoomed : ''}`}
              style={
                isZoomed
                  ? {
                      transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                      transform: 'scale(2)'
                    }
                  : {}
              }
              onClick={handleImageClick}
            />
          )}
        </div>

        {/* Стрелка вправо */}
        {images.length > 1 && (
          <button className={`${styles.arrow} ${styles.arrowRight}`} onClick={goToNext} aria-label={t('next')}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
              <path
                d='M9 18L15 12L9 6'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>
        )}
      </div>

      {/* Миниатюры */}
      {images.length > 1 && (
        <div className={styles.thumbnails}>
          <div className={styles.thumbnailsContainer}>
            {images.map((image, index) => {
              const isVideoThumb = image.match(/\.(mp4|webm|mov|avi)$/i)

              return (
                <button
                  key={index}
                  className={`${styles.thumbnail} ${index === currentIndex ? styles.thumbnailActive : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={isVideoThumb ? t('video', {number: index + 1}) : t('image', {number: index + 1})}
                >
                  {isVideoThumb ? (
                    <video src={image} muted className={styles.thumbnailVideo} />
                  ) : (
                    <img src={image} alt={t('thumbnail', {number: index + 1})} className={styles.thumbnailImage} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Счетчик */}
      <div className={styles.counter}>
        {currentIndex + 1} / {images.length}
      </div>

      {/* Кнопка закрытия */}
      <button className={styles.closeButton} onClick={onClose} aria-label={t('close')}>
        <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
          <path
            d='M18 6L6 18M6 6L18 18'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </button>

      {/* Подсказка для зума */}
      {!isVideo && !isZoomed && <div className={styles.zoomHint}>{t('clickImage')}</div>}
    </div>
  )
}

export default SliderForCreateImages
