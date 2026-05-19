/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlusIcon,
  Trash2Icon,
  UploadIcon
} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Image from 'next/image'
import {useRef, useState} from 'react'
import 'swiper/css'
import 'swiper/css/navigation'
import {Navigation} from 'swiper/modules'
import {Swiper, SwiperSlide} from 'swiper/react'
import styles from './MediaBlock.module.scss'

type MediaSize = 'mini' | 'medium' | 'large'
type MediaType = 'image' | 'video'

interface MediaItem {
  url: string
  type: MediaType
  points: number
}

const SIZE_LABELS: Record<MediaSize, string> = {mini: 'S', medium: 'M', large: 'L'}
const SIZE_PX: Record<MediaSize, number> = {mini: 320, medium: 450, large: 600}
const SIZES: MediaSize[] = ['mini', 'medium', 'large']

const POINTS_IMAGE = 1
const POINTS_VIDEO = 3
const MAX_POINTS = 15

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function calcPoints(items: MediaItem[]) {
  return items.reduce((acc, i) => acc + i.points, 0)
}

function ArrowLeft({label}: {label: string}) {
  return (
    <button className={`${styles.arrowLeft} media-prev`} aria-label={label}>
      <ChevronLeftIcon size={18} className={styles.arrowIcon} />
    </button>
  )
}

function ArrowRight({label}: {label: string}) {
  return (
    <button className={`${styles.arrowRight} media-next`} aria-label={label}>
      <ChevronRightIcon size={18} className={styles.arrowIcon} />
    </button>
  )
}

export default function MediaBlock({nodeId}: {nodeId: string}) {
  const {updateNodeData} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const viewOnly = useViewMode() === 'view'
  const t = useTranslations('roadMap')

  const mediaData = useStore((s) => {
    const data = s.nodeLookup.get(nodeId)?.data as RoadNodeData & {
      mediaItems?: MediaItem[]
      mediaSize?: MediaSize
    }
    return {
      items: (data?.mediaItems ?? []) as MediaItem[],
      size: (data?.mediaSize ?? 'medium') as MediaSize
    }
  })

  const update = (patch: Record<string, any>) => updateNodeData(nodeId, patch as any)

  const usedPoints = calcPoints(mediaData.items)
  const remainingPoints = MAX_POINTS - usedPoints

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const current = mediaData.items
    const newItems: MediaItem[] = []
    let pts = usedPoints

    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      const cost = isVideo ? POINTS_VIDEO : POINTS_IMAGE
      if (pts + cost > MAX_POINTS) continue
      const url = await fileToBase64(file)
      newItems.push({ url, type: isVideo ? 'video' : 'image', points: cost })
      pts += cost
    }

    update({mediaItems: [...current, ...newItems]})
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeItem = (index: number) => {
    const next = mediaData.items.filter((_, i) => i !== index)
    update({mediaItems: next})
    setActiveIndex(Math.min(activeIndex, next.length - 1))
  }

  const cycleSize = (direction: 'up' | 'down') => {
    const idx = SIZES.indexOf(mediaData.size)
    const next = direction === 'up' ? SIZES[Math.min(idx + 1, SIZES.length - 1)] : SIZES[Math.max(idx - 1, 0)]
    update({mediaSize: next})
  }

  const hasMedia = mediaData.items.length > 0
  const isMultiple = mediaData.items.length > 1
  const sizePx = SIZE_PX[mediaData.size]
  const mediaHeight = Math.round(sizePx * 0.7)

  const canAddMore = remainingPoints > 0

  return (
    <div className={`${styles.box} nodrag nopan`}>
      <input
        ref={fileRef}
        type='file'
        accept='image/*,video/*'
        multiple
        className={styles.hidden}
        onChange={handleFiles}
      />

      {!hasMedia && (
        <button type='button' className={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
          <UploadIcon size={18} />
          <span>{t('uploadMedia')}</span>
          <span className={styles.uploadHint}>JPG, PNG, GIF · MP4, MOV, WEBM</span>
          <span className={styles.uploadHint}>{t('mediaPoints') + ` ${MAX_POINTS}`}</span>
        </button>
      )}

      {hasMedia && (
        <div className={styles.mediaWrap} style={{width: sizePx}}>
          <div className={styles.controls}>
            <div className={styles.sizeControls}>
              {SIZES.map((s) => (
                <button
                  key={s}
                  className={`${styles.sizeBtn} ${mediaData.size === s ? styles.sizeBtnActive : ''}`}
                  onClick={() => update({mediaSize: s})}
                >
                  {SIZE_LABELS[s]}
                </button>
              ))}
            </div>

            <div className={styles.rightControls}>
              <span className={styles.points}>
                {usedPoints}/{MAX_POINTS}
              </span>

              <button
                className={styles.iconBtn}
                onClick={() => cycleSize('up')}
                disabled={mediaData.size === 'large'}
                title={t('increaseSize')}
              >
                <Maximize2Icon size={12} />
              </button>
              <button
                className={styles.iconBtn}
                onClick={() => cycleSize('down')}
                disabled={mediaData.size === 'mini'}
                title={t('decreaseSize')}
              >
                <Minimize2Icon size={12} />
              </button>

              {canAddMore && !viewOnly && (
                <button
                  className={styles.iconBtn}
                  onClick={() => fileRef.current?.click()}
                  title={t('addMedia', {remainingPoints})}
                >
                  <PlusIcon size={12} />
                </button>
              )}
            </div>
          </div>

          {isMultiple ? (
            <div className={styles.sliderWrapper} style={{height: mediaHeight}}>
              <ArrowLeft label={t('mediaPrev')} />
              <ArrowRight label={t('mediaNext')} />

              {/* Счётчик слайдов */}
              <div className={styles.counter}>
                {activeIndex + 1}/{mediaData.items.length}
              </div>

              <Swiper
                modules={[Navigation]}
                navigation={{prevEl: '.media-prev', nextEl: '.media-next'}}
                onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                className={styles.swiper}
                style={{height: '100%'}}
              >
                {mediaData.items.map((item, i) => (
                  <SwiperSlide key={i} className={styles.slide}>
                    <SlideContent viewOnly={viewOnly} item={item} height={mediaHeight} onRemove={() => removeItem(i)} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          ) : (
            <div className={styles.singleWrap} style={{height: mediaHeight}}>
              <SlideContent
                viewOnly={viewOnly}
                item={mediaData.items[0]}
                height={mediaHeight}
                onRemove={() => removeItem(0)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SlideContent({
  item,
  height,
  onRemove,
  viewOnly
}: {
  item: MediaItem
  height: number
  onRemove: () => void
  viewOnly: boolean
}) {
  const t = useTranslations('roadMap')
  return (
    <div className={styles.slideContent} style={{height}}>
      {item.type === 'image' ? (
        <Image src={item.url} alt='media' fill style={{objectFit: 'cover'}} unoptimized />
      ) : (
        <video src={item.url} controls className={styles.video} style={{height: '100%'}} />
      )}
      {!viewOnly && (
        <button className={styles.removeSlide} onClick={onRemove} title={t('delete')}>
          <Trash2Icon size={12} />
        </button>
      )}
    </div>
  )
}
