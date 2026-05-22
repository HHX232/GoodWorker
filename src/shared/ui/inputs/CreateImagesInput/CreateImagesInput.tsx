import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { ChangeEvent, FC, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import styles from './CreateImagesInput.module.scss'
import SliderForCreateImages from './SliderForCreateImages/SliderForCreateImages'

interface CreateImagesInputProps {
  activeImages?: string[]
  onFilesChange: (files: File[]) => void
  onActiveImagesChange?: (remainingUrls: string[]) => void
  maxFiles?: number
  extraClass?: string
  errorValue?: string
  setErrorValue?: (value: string) => void
  minFiles?: number
  inputIdPrefix?: string
  maxFileSize?: number
  allowMultipleFiles?: boolean
  allowedTypes?: string[]
  isOnlyShow?: boolean
  showBigFirstItem?: boolean
  size?: 'xs'
}

export const ImagePreview = memo<{
  url: string | null
  file: File | null
  index: number
  onError: (index: number) => void
  loadError: boolean
  isOnlyShow?: boolean
  onImageClick?: (index: number) => void
}>(({ url, file, index, onError, loadError, isOnlyShow, onImageClick }) => {
  const t = useTranslations('CreateImagesInput')

  const handleError = useCallback(() => {
    onError(index)
  }, [index, onError])

  const handleClick = useCallback(() => {
    if (isOnlyShow && onImageClick) {
      onImageClick(index)
    }
  }, [isOnlyShow, onImageClick, index])

  if (!url) return null

  if (file && file.type.startsWith('video/')) {
    return (
      <video
        src={url}
        className={`${styles.preview} ${isOnlyShow ? styles.clickable : ''}`}
        muted
        loop
        autoPlay
        onClick={handleClick}
        style={{ cursor: isOnlyShow ? 'pointer' : 'default' }}
      />
    )
  }

  if (loadError) {
    return (
      <div className={styles.errorPreview}>
        <p>{t('loadError')}</p>
        <small>{url}</small>
      </div>
    )
  }

  const isExternalUrl = url.startsWith('http://') || url.startsWith('https://')

  if (isExternalUrl) {
    return (
      <Image
        src={url}
        width={200}
        height={200}
        alt={`Preview ${index}`}
        className={`${styles.preview} ${isOnlyShow ? styles.clickable : ''}`}
        onError={handleError}
        onClick={handleClick}
        style={{ cursor: isOnlyShow ? 'pointer' : 'default' }}
      />
    )
  }

  return (
    <Image
      width={200}
      height={200}
      src={url}
      alt={`Preview ${index}`}
      className={`${styles.preview} ${isOnlyShow ? styles.clickable : ''}`}
      onError={handleError}
      onClick={handleClick}
      style={{ cursor: isOnlyShow ? 'pointer' : 'default' }}
    />
  )
})

ImagePreview.displayName = 'ImagePreview'

// Кастомная иконка плюса — серая, закруглённая
const PlusIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="8" fill="#E0E0E0" />
    <path d="M14 8V20M8 14H20" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

// Кастомная иконка минуса — серая, закруглённая
const MinusIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="8" fill="#E0E0E0" />
    <path d="M8 14H20" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const ImageUploadItem = memo<{
  index: number
  maxFiles: number
  inputIdPrefix: string
  previewUrl: string | null
  localFile: File | null
  loadError: boolean
  maxFileSize: number
  allowMultipleFiles: boolean
  allowedTypes: string[]
  acceptString: string
  showBigFirstItem: boolean
  isOnlyShow: boolean
  error?: string
  onFileChange: (index: number, file: File) => void
  onMultipleFilesChange: (index: number, files: FileList) => void
  onRemove: (index: number) => void
  onImageError: (index: number) => void
  onImageClick?: (index: number) => void
  onSwapWithMain?: (index: number) => void
}>(
  ({
    index,
    inputIdPrefix,
    previewUrl,
    localFile,
    loadError,
    maxFileSize,
    allowMultipleFiles,
    allowedTypes,
    acceptString,
    showBigFirstItem,
    isOnlyShow,
    error,
    onFileChange,
    onMultipleFilesChange,
    onRemove,
    onImageError,
    onImageClick,
    onSwapWithMain,
  }) => {
    const t = useTranslations('CreateImagesInput')
    const t2 = useTranslations('previewText')
    const [isHovered, setIsHovered] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    const isValidFileType = useCallback(
      (file: File) => {
        if (file.type === 'image/svg+xml') return false
        return allowedTypes.some((type) => {
          if (type.endsWith('/*')) {
            const baseType = type.replace('/*', '/')
            return file.type.startsWith(baseType)
          }
          return file.type === type
        })
      },
      [allowedTypes]
    )

    const handleFileChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (isOnlyShow) return

        const files = e.target.files
        if (!files || files.length === 0) return

        if (allowMultipleFiles && files.length > 1) {
          const invalidFiles: string[] = []
          const oversizedFiles: string[] = []

          Array.from(files).forEach((file) => {
            if (!isValidFileType(file)) invalidFiles.push(file.name)
            if (file.size > maxFileSize) oversizedFiles.push(file.name)
          })

          if (invalidFiles.length > 0) {
            toast.error(
              <div data-special-attr-for-error={true} style={{ lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>{t('uploadError')}</strong>
                <span>{t('invalidFileTypes', { fileNames: invalidFiles.join(', ') })}</span>
              </div>,
              { style: { background: '#AC2525' } }
            )
            return
          }

          if (oversizedFiles.length > 0) {
            const maxSizeMB = Math.round(maxFileSize / (1024 * 1024))
            toast.error(
              <div data-special-attr-for-error={true} style={{ lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>{t('uploadError')}</strong>
                <span>{t('fileSizeExceeded', { maxSizeMB, fileNames: oversizedFiles.join(', ') })}</span>
              </div>,
              { style: { background: '#AC2525' } }
            )
            return
          }

          onMultipleFilesChange(index, files)
          return
        }

        const file = files[0]

        if (!isValidFileType(file)) {
          toast.error(
            <div data-special-attr-for-error={true} style={{ lineHeight: 1.5 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('uploadError')}</strong>
              <span>{t('chooseImageOrVideo')}</span>
            </div>,
            { style: { background: '#AC2525' } }
          )
          return
        }

        if (file.size > maxFileSize) {
          const maxSizeMB = Math.round(maxFileSize / (1024 * 1024))
          toast.error(
            <div data-special-attr-for-error={true} style={{ lineHeight: 1.5 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{t('uploadError')}</strong>
              <span>{t('fileSizeLimit', { maxSizeMB })}</span>
            </div>,
            { style: { background: '#AC2525' } }
          )
          return
        }

        onFileChange(index, file)
      },
      [index, maxFileSize, allowMultipleFiles, allowedTypes, isValidFileType, onFileChange, onMultipleFilesChange, isOnlyShow, t]
    )

    const handleRemove = useCallback(
      (e: React.MouseEvent) => {
        if (isOnlyShow) return
        e.preventDefault()
        e.stopPropagation()
        onRemove(index)
      },
      [index, onRemove, isOnlyShow]
    )

    const handleMouseEnter = useCallback(() => {
      if (!isOnlyShow) setIsHovered(true)
    }, [isOnlyShow])

    const handleMouseLeave = useCallback(() => setIsHovered(false), [])

    const handleLabelClick = useCallback(
      (e: React.MouseEvent) => {
        if (isOnlyShow && previewUrl && onImageClick) {
          e.preventDefault()
          onImageClick(index)
        }
      },
      [isOnlyShow, previewUrl, onImageClick, index]
    )

    const handleMenuToggle = useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsMenuOpen((prev) => !prev)
    }, [])

    const handleSwapClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (onSwapWithMain) onSwapWithMain(index)
        setIsMenuOpen(false)
      },
      [index, onSwapWithMain]
    )

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsMenuOpen(false)
        }
      }
      if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMenuOpen])

    const hasContent = previewUrl !== null
    const isBig = index === 0 && showBigFirstItem
    const inputId = `${inputIdPrefix}-${index}`

    return (
      <label
        className={`${styles.create__images__input__label} ${isBig ? styles.create__images__input__label__big : ''} ${hasContent ? styles.has__file : ''} ${isOnlyShow ? styles.readonly : ''} ${isBig && !!error ? styles.big_error : ''}`}
        htmlFor={isOnlyShow ? undefined : inputId}
        id={`label-${inputId}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleLabelClick}
        style={{ cursor: isOnlyShow && hasContent ? 'pointer' : isOnlyShow ? 'default' : 'pointer' }}
      >
        {hasContent && (
          <>
            <ImagePreview
              url={previewUrl}
              file={localFile}
              index={index}
              onError={onImageError}
              loadError={loadError}
              isOnlyShow={isOnlyShow}
              onImageClick={onImageClick}
            />
            {isHovered && !isOnlyShow && (
              <div className={styles.remove__overlay} onClick={handleRemove}>
                {/* Минус — кастомный */}
                <MinusIcon />
              </div>
            )}
          </>
        )}

        {!hasContent && !isOnlyShow && (
          <>
            {isBig && <div className={styles.preview__label}>{t2('preview')}</div>}
            {/* Плюс — кастомный */}
            <PlusIcon />
          </>
        )}

        {!isOnlyShow && showBigFirstItem && hasContent && index !== 0 && (
          <div className={styles.menu__container} ref={menuRef}>
            <button className={styles.menu__button} onClick={handleMenuToggle} type="button">
              <svg width="4" height="18" viewBox="0 0 4 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="2" cy="2" r="2" fill="white" />
                <circle cx="2" cy="9" r="2" fill="white" />
                <circle cx="2" cy="16" r="2" fill="white" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className={styles.dropdown__menu}>
                <button className={styles.menu__item} onClick={handleSwapClick} type="button">
                  {t2('makePreview')}
                </button>
              </div>
            )}
          </div>
        )}

        {!isOnlyShow && (
          <input
            type="file"
            id={inputId}
            accept={acceptString}
            multiple={allowMultipleFiles}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        )}
      </label>
    )
  }
)

ImageUploadItem.displayName = 'ImageUploadItem'

export const CreateImagesInput: FC<CreateImagesInputProps> = ({
  activeImages = [],
  onFilesChange,
  onActiveImagesChange,
  maxFiles = 11,
  extraClass = '',
  errorValue = '',
  setErrorValue,
  minFiles = 0,
  inputIdPrefix = 'images',
  maxFileSize = 20 * 1024 * 1024,
  allowMultipleFiles = false,
  allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/mov',
    'video/avi',
  ],
  isOnlyShow = false,
  showBigFirstItem = true,
  size,
}) => {
  const t = useTranslations('CreateImagesInput')
const uid = useId()
  const prefix = `${inputIdPrefix}-${uid.replace(/:/g, '')}`

  const [localFiles, setLocalFiles] = useState<(File | null)[]>(() => new Array(maxFiles).fill(null))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalImages, setModalImages] = useState<string[]>([])

  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>(() => {
    const urls = new Array(maxFiles).fill(null)
    activeImages.forEach((url, index) => {
      if (index < maxFiles) urls[index] = url
    })
    return urls
  })

  const [loadError, setLoadError] = useState<{ [key: number]: boolean }>({})
  const [removedInitialImages, setRemovedInitialImages] = useState<Set<number>>(new Set())

  const acceptString = useMemo(() => {
    const filteredTypes = allowedTypes.map((type) => {
      if (type === 'image/*') return 'image/jpeg,image/jpg,image/png,image/gif,image/webp'
      return type
    })
    return filteredTypes.join(',')
  }, [allowedTypes])

  const itemsToShow = useMemo(() => {
    if (isOnlyShow) return activeImages.length
    return maxFiles
  }, [isOnlyShow, activeImages.length, maxFiles])

  const reorderImages = useCallback((clickedIndex: number, images: string[]) => {
    if (clickedIndex === 0) return images
    const reordered = [...images]
    const clickedItem = reordered[clickedIndex]
    reordered.splice(clickedIndex, 1)
    reordered.unshift(clickedItem)
    return reordered
  }, [])

  const handleImageClick = useCallback(
    (clickedIndex: number) => {
      if (!isOnlyShow) return
      const validImages = activeImages.filter((img) => img && img.trim() !== '')
      if (validImages.length === 0) return
      const reorderedImages = reorderImages(clickedIndex, validImages)
      setModalImages(reorderedImages)
      setIsModalOpen(true)
    },
    [isOnlyShow, activeImages, reorderImages]
  )

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setModalImages([])
  }, [])

  const totalImagesCount = useMemo(() => {
    if (isOnlyShow) return activeImages.length
    let count = 0
    for (let i = 0; i < maxFiles; i++) {
      if (localFiles[i] || (previewUrls[i] && !removedInitialImages.has(i))) count++
    }
    return count
  }, [localFiles, previewUrls, removedInitialImages, maxFiles, isOnlyShow, activeImages.length])

  const checkAndClearError = useCallback(() => {
    if (errorValue && setErrorValue && totalImagesCount >= minFiles) {
      setErrorValue('')
    }
  }, [errorValue, setErrorValue, totalImagesCount, minFiles])

  const handleSwapWithMain = useCallback(
    (targetIndex: number) => {
      if (targetIndex === 0) return

      setLocalFiles((prev) => {
        const newFiles = [...prev]
        const temp = newFiles[0]
        newFiles[0] = newFiles[targetIndex]
        newFiles[targetIndex] = temp
        setTimeout(() => {
          onFilesChange(newFiles.filter((f) => f !== null) as File[])
        }, 0)
        return newFiles
      })

      setPreviewUrls((prev) => {
        const newUrls = [...prev]
        const temp = newUrls[0]
        newUrls[0] = newUrls[targetIndex]
        newUrls[targetIndex] = temp
        return newUrls
      })

      if (onActiveImagesChange && activeImages.length > 0) {
        setTimeout(() => {
          const newActiveImages = [...activeImages]
          const temp = newActiveImages[0]
          newActiveImages[0] = newActiveImages[targetIndex]
          newActiveImages[targetIndex] = temp
          onActiveImagesChange(newActiveImages)
        }, 0)
      }
    },
    [activeImages, onActiveImagesChange, onFilesChange]
  )

  // ✅ ФИКС: setPreviewUrls вынесен из setLocalFiles — нет вложенных setState
  const handleFileChange = useCallback(
    (index: number, file: File) => {
      if (isOnlyShow) return

      const url = URL.createObjectURL(file)

      setRemovedInitialImages((prev) => {
        if (prev.has(index)) {
          const newSet = new Set(prev)
          newSet.delete(index)
          return newSet
        }
        return prev
      })

      setLoadError((prev) => ({ ...prev, [index]: false }))

      // Сначала обновляем превью
      setPreviewUrls((prevUrls) => {
        const newUrls = [...prevUrls]
        if (prevUrls[index] && prevUrls[index]!.startsWith('blob:')) {
          URL.revokeObjectURL(prevUrls[index]!)
        }
        newUrls[index] = url
        return newUrls
      })

      // Затем обновляем файлы и нотифицируем родителя
      setLocalFiles((prev) => {
        const newFiles = [...prev]
        newFiles[index] = file
        setTimeout(() => {
          onFilesChange(newFiles.filter((f) => f !== null) as File[])
        }, 0)
        return newFiles
      })
    },
    [onFilesChange, isOnlyShow]
  )

  const handleMultipleFilesChange = useCallback(
    (startIndex: number, files: FileList) => {
      if (isOnlyShow) return

      const fileArray = Array.from(files)

      const freeSlots: number[] = []
      for (let i = 0; i < maxFiles; i++) {
        if (!localFiles[i] && !previewUrls[i]) freeSlots.push(i)
      }

      if (freeSlots.length < fileArray.length) {
        toast.error(
          <div data-special-attr-for-error={true} style={{ lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>{t('notEnoughSlots')}</strong>
            <span>{t('availableSlots', { available: freeSlots.length, selected: fileArray.length })}</span>
          </div>,
          { style: { background: '#AC2525' } }
        )
      }

      const filesToProcess = fileArray.slice(0, freeSlots.length)
      const newFiles = [...localFiles]
      const newUrls = [...previewUrls]
      const newLoadError = { ...loadError }

      filesToProcess.forEach((file, index) => {
        const slotIndex = freeSlots[index]
        newFiles[slotIndex] = file
        newUrls[slotIndex] = URL.createObjectURL(file)
        newLoadError[slotIndex] = false
      })

      setLocalFiles(newFiles)
      setPreviewUrls(newUrls)
      setLoadError(newLoadError)

      setTimeout(() => {
        onFilesChange(newFiles.filter((f) => f !== null) as File[])
      }, 0)
    },
    [localFiles, previewUrls, loadError, maxFiles, onFilesChange, isOnlyShow, t]
  )

  const handleRemove = useCallback(
    (index: number) => {
      if (isOnlyShow) return

      if (previewUrls[index] && localFiles[index]) {
        URL.revokeObjectURL(previewUrls[index]!)
      }

      setLocalFiles((prev) => {
        const newFiles = [...prev]
        newFiles[index] = null
        return newFiles
      })

      setPreviewUrls((prev) => {
        const newUrls = [...prev]
        newUrls[index] = null
        return newUrls
      })

      if (activeImages[index] && !localFiles[index]) {
        setRemovedInitialImages((prev) => {
          const newSet = new Set(prev).add(index)

          if (onActiveImagesChange) {
            setTimeout(() => {
              const updatedImages = [...activeImages]
              updatedImages[index] = ''
              while (updatedImages.length > 0 && updatedImages[updatedImages.length - 1] === '') {
                updatedImages.pop()
              }
              onActiveImagesChange(updatedImages)
            }, 0)
          }

          return newSet
        })
      } else {
        if (onActiveImagesChange) {
          setTimeout(() => {
            onActiveImagesChange([...activeImages])
          }, 0)
        }
      }

      setLoadError((prev) => ({ ...prev, [index]: false }))

      setLocalFiles((currentFiles) => {
        const updatedFiles = [...currentFiles]
        updatedFiles[index] = null
        setTimeout(() => {
          onFilesChange(updatedFiles.filter((f) => f !== null) as File[])
        }, 0)
        return updatedFiles
      })
    },
    [previewUrls, localFiles, activeImages, onActiveImagesChange, onFilesChange, isOnlyShow]
  )

  useEffect(() => {
    if (activeImages.length > 0) {
      setPreviewUrls((prev) => {
        const newUrls = isOnlyShow ? activeImages.map((url) => url || null) : [...prev]

        if (!isOnlyShow) {
          let hasChanges = false
          activeImages.forEach((url, index) => {
            if (index < maxFiles && !localFiles[index] && !removedInitialImages.has(index)) {
              if (newUrls[index] !== url && url !== '') {
                newUrls[index] = url
                hasChanges = true
              }
            }
          })
          return hasChanges ? newUrls : prev
        }

        return newUrls
      })
    }
  }, [activeImages, maxFiles, localFiles, removedInitialImages, isOnlyShow])

  useEffect(() => {
    if (activeImages.length > 0) {
      setPreviewUrls((prev) => {
        const newUrls = new Array(maxFiles).fill(null)

        activeImages.forEach((url, index) => {
          if (index < maxFiles && !removedInitialImages.has(index) && !localFiles[index]) {
            newUrls[index] = url
          }
        })

        localFiles.forEach((file, index) => {
          if (file) {
            newUrls[index] = prev[index] || URL.createObjectURL(file)
          }
        })

        return newUrls
      })
    }
  }, [activeImages, removedInitialImages, localFiles, maxFiles])

  const handleImageError = useCallback((index: number) => {
    setLoadError((prev) => ({ ...prev, [index]: true }))
  }, [])

  useEffect(() => {
    if (!isOnlyShow) {
      checkAndClearError()
    }
  }, [checkAndClearError, isOnlyShow])

  const uploadItems = useMemo(() => {
    return Array.from({ length: itemsToShow }).map((_, index) => (
      <ImageUploadItem
        key={index}
        index={index}
        error={index === 0 ? errorValue : ''}
        maxFiles={maxFiles}
        inputIdPrefix={prefix}
        previewUrl={previewUrls[index] || null}
        localFile={localFiles[index]}
        loadError={loadError[index] || false}
        maxFileSize={maxFileSize}
        allowMultipleFiles={allowMultipleFiles}
        allowedTypes={allowedTypes}
        acceptString={acceptString}
        showBigFirstItem={showBigFirstItem}
        isOnlyShow={isOnlyShow}
        onFileChange={handleFileChange}
        onMultipleFilesChange={handleMultipleFilesChange}
        onRemove={handleRemove}
        onImageError={handleImageError}
        onImageClick={isOnlyShow ? handleImageClick : undefined}
        onSwapWithMain={handleSwapWithMain}
      />
    ))
  }, [
    itemsToShow,
    maxFiles,
    prefix,
    previewUrls,
    localFiles,
    loadError,
    maxFileSize,
    allowMultipleFiles,
    allowedTypes,
    acceptString,
    showBigFirstItem,
    isOnlyShow,
    errorValue,
    handleFileChange,
    handleMultipleFilesChange,
    handleRemove,
    handleImageError,
    handleImageClick,
    handleSwapWithMain,
  ])

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.create__images__input} ${size === 'xs' ? styles.xs : ''} ${extraClass} ${errorValue ? styles.error : ''} ${isOnlyShow ? styles.readonly : ''}`}
      >
        {uploadItems}
      </div>
      {!isOnlyShow && (
        <div className={styles.info__block}>
          {errorValue && <p className={styles.error__message}>{errorValue}</p>}
        </div>
      )}

      {isOnlyShow && isModalOpen && (
        <SliderForCreateImages
          isModalOpen={isModalOpen}
          images={modalImages}
          initialIndex={0}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}