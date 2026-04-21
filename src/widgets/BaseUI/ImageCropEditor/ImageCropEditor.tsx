import {FC, useState, useRef, useEffect, useCallback} from 'react'
import styles from './ImageCropEditor.module.scss'
import {useTranslations} from 'next-intl'

interface ImageCropEditorProps {
  imageUrl: string
  isOpen: boolean
  onClose: () => void
  onSave: (croppedFile: File) => void
  cropShape?: 'circle' | 'square'
  cropSize?: number
  aspectRatio?: number
}

const ImageCropEditor: FC<ImageCropEditorProps> = ({
  imageUrl,
  isOpen,
  onClose,
  onSave,
  cropShape = 'square',
  cropSize = 300,
  aspectRatio = 1
}) => {
  const t = useTranslations('cropEditor')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({x: 0, y: 0})
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({x: 0, y: 0})
  const [imageLoaded, setImageLoaded] = useState(false)
  const [canvasSize, setCanvasSize] = useState({width: 600, height: 600})

  // Динамический расчет размера canvas на основе viewport
  useEffect(() => {
    const updateCanvasSize = () => {
      const vh = window.innerHeight
      const vw = window.innerWidth

      // Отнимаем высоту header (~64px), controls (~64px), footer (~64px) и отступы (~100px)
      const availableHeight = vh - 292
      const availableWidth = vw * 0.9 - 48 // 90% ширины минус padding

      // Ограничиваем максимальный размер
      const maxSize = Math.min(availableHeight, availableWidth, 600)
      const size = Math.max(300, maxSize) // Минимум 300px

      setCanvasSize({width: size, height: size})
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  useEffect(() => {
    if (isOpen && imageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        setImage(img)
        setImageLoaded(true)

        // Центрируем изображение при загрузке
        if (containerRef.current) {
          const containerWidth = canvasSize.width
          const containerHeight = canvasSize.height

          const scale = Math.max(cropSize / img.width, cropSize / img.height)

          setScale(scale)
          setPosition({
            x: (containerWidth - img.width * scale) / 2,
            y: (containerHeight - img.height * scale) / 2
          })
        }
      }
      img.src = imageUrl
    }
  }, [isOpen, imageUrl, cropSize, canvasSize])

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !image || !imageLoaded) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const containerWidth = canvas.width
    const containerHeight = canvas.height

    // Очищаем canvas
    ctx.clearRect(0, 0, containerWidth, containerHeight)

    // Рисуем изображение
    ctx.save()
    ctx.drawImage(image, position.x, position.y, image.width * scale, image.height * scale)
    ctx.restore()

    // Создаем маску для затемнения
    const centerX = containerWidth / 2
    const centerY = containerHeight / 2
    const cropWidth = cropSize
    const cropHeight = cropSize / aspectRatio

    ctx.save()

    // Начинаем путь для маски
    ctx.beginPath()
    // Внешний прямоугольник (весь canvas)
    ctx.rect(0, 0, containerWidth, containerHeight)

    // Внутренняя область (которую НЕ затемняем)
    if (cropShape === 'circle') {
      // Для круга рисуем путь в обратном направлении
      ctx.arc(centerX, centerY, Math.min(cropWidth, cropHeight) / 2, 0, Math.PI * 2, true)
    } else {
      // Для квадрата рисуем внутренний прямоугольник в обратном направлении
      const x = centerX - cropWidth / 2
      const y = centerY - cropHeight / 2
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + cropHeight)
      ctx.lineTo(x + cropWidth, y + cropHeight)
      ctx.lineTo(x + cropWidth, y)
      ctx.closePath()
    }

    // Заливаем все кроме области кадрирования
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fill('evenodd')
    ctx.restore()

    // Рисуем рамку области кадрирования
    ctx.save()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2

    if (cropShape === 'circle') {
      ctx.beginPath()
      ctx.arc(centerX, centerY, Math.min(cropWidth, cropHeight) / 2, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeRect(centerX - cropWidth / 2, centerY - cropHeight / 2, cropWidth, cropHeight)

      // Рисуем сетку правила третей
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.lineWidth = 1

      const gridX1 = centerX - cropWidth / 2 + cropWidth / 3
      const gridX2 = centerX - cropWidth / 2 + (cropWidth / 3) * 2
      const gridY1 = centerY - cropHeight / 2 + cropHeight / 3
      const gridY2 = centerY - cropHeight / 2 + (cropHeight / 3) * 2

      ctx.beginPath()
      ctx.moveTo(gridX1, centerY - cropHeight / 2)
      ctx.lineTo(gridX1, centerY + cropHeight / 2)
      ctx.moveTo(gridX2, centerY - cropHeight / 2)
      ctx.lineTo(gridX2, centerY + cropHeight / 2)
      ctx.moveTo(centerX - cropWidth / 2, gridY1)
      ctx.lineTo(centerX + cropWidth / 2, gridY1)
      ctx.moveTo(centerX - cropWidth / 2, gridY2)
      ctx.lineTo(centerX + cropWidth / 2, gridY2)
      ctx.stroke()
    }
    ctx.restore()
  }, [image, scale, position, cropShape, cropSize, aspectRatio, imageLoaded])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((prev) => Math.max(0.1, Math.min(prev * delta, 5)))
  }

  const handleSave = async () => {
    if (!canvasRef.current || !image) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cropWidth = cropSize
    const cropHeight = cropSize / aspectRatio

    canvas.width = cropWidth
    canvas.height = cropHeight

    const containerWidth = canvasRef.current.width
    const containerHeight = canvasRef.current.height
    const centerX = containerWidth / 2
    const centerY = containerHeight / 2

    const sourceX = centerX - cropWidth / 2 - position.x
    const sourceY = centerY - cropHeight / 2 - position.y

    if (cropShape === 'circle') {
      // Для круга создаем маску
      ctx.save()
      ctx.beginPath()
      ctx.arc(cropWidth / 2, cropHeight / 2, Math.min(cropWidth, cropHeight) / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
    }

    ctx.drawImage(
      image,
      sourceX / scale,
      sourceY / scale,
      cropWidth / scale,
      cropHeight / scale,
      0,
      0,
      cropWidth,
      cropHeight
    )

    if (cropShape === 'circle') {
      ctx.restore()
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'cropped-image.png', {type: 'image/png'})
        onSave(file)
      }
    }, 'image/png')
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev * 0.8, 0.1))
  }

  const handleReset = () => {
    if (image && containerRef.current) {
      const containerWidth = canvasSize.width
      const containerHeight = canvasSize.height

      const initialScale = Math.max(cropSize / image.width, cropSize / image.height)

      setScale(initialScale)
      setPosition({
        x: (containerWidth - image.width * initialScale) / 2,
        y: (containerHeight - image.height * initialScale) / 2
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Редактировать изображение</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
              <path d='M18 6L6 18M6 6L18 18' stroke='currentColor' strokeWidth='2' strokeLinecap='square' />
            </svg>
          </button>
        </div>

        <div className={styles.content} ref={containerRef}>
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className={styles.canvas}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        </div>

        <div className={styles.controls}>
          <div className={styles.zoomControls}>
            <button className={styles.controlButton} onClick={handleZoomOut}>
              <svg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path d='M4 10H16' stroke='currentColor' strokeWidth='2' strokeLinecap='square' />
              </svg>
            </button>
            <span className={styles.zoomValue}>{Math.round(scale * 100)}%</span>
            <button className={styles.controlButton} onClick={handleZoomIn}>
              <svg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path d='M10 4V16M4 10H16' stroke='currentColor' strokeWidth='2' strokeLinecap='square' />
              </svg>
            </button>
          </div>

          <button className={styles.resetButton} onClick={handleReset}>
            {t('sbros')}
          </button>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            {t('cancel')}
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            {t('submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageCropEditor
