/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {compressImageToThumbnail} from '@/shared/helpers/compressImage'
import {CategorySelect} from '@/shared/ui/inputs/CategorySelect/CategorySelect'
import {useReactFlow, useStore} from '@xyflow/react'
import {ImagePlusIcon, XIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRef} from 'react'
import styles from './EntryPointBlock.module.scss'

type EntryData = RoadNodeData & {
  roadTitle?: string
  roadDescription?: string
  roadCategory?: string
  roadPreview?: string
}

export default function EntryPointBlock({nodeId}: {nodeId: string}) {
  const t = useTranslations('roadMap')
  const onlyView = useViewMode() === 'view'
  const {updateNodeData} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)

  const data = useStore((s) => s.nodeLookup.get(nodeId)?.data as EntryData)

  const update = (patch: Partial<EntryData>) => updateNodeData(nodeId, patch as any)

  const handlePreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    try {
      const compressed = await compressImageToThumbnail(file)
      update({roadPreview: compressed})
    } catch {
      // fallback to direct base64 if canvas fails
      const reader = new FileReader()
      reader.onload = () => update({roadPreview: reader.result as string})
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className={`${styles.block} nodrag nopan`}>
      {!onlyView && (
        <input ref={fileRef} type='file' accept='image/*' className={styles.hidden} onChange={handlePreview} />
      )}

      {(!onlyView || data?.roadPreview) && (
        <div className={styles.preview} onClick={() => !data?.roadPreview && fileRef.current?.click()}>
          {data?.roadPreview ? (
            <>
              {/* блюр-фон — растянутая копия */}
              <div className={styles.previewBlur} style={{backgroundImage: `url(${data.roadPreview})`}} />

              {/* оригинальное изображение в своём соотношении */}
              <div className={styles.previewImageWrap}>
                <img src={data.roadPreview} alt='preview' className={styles.previewImage} />
              </div>

              {!onlyView && (
                <>
                  <button
                    className={styles.removePreview}
                    onClick={(e) => {
                      e.stopPropagation()
                      update({roadPreview: undefined})
                    }}
                  >
                    <XIcon size={12} />
                  </button>

                  <button
                    className={styles.changePreview}
                    onClick={(e) => {
                      e.stopPropagation()
                      fileRef.current?.click()
                    }}
                  >
                    <ImagePlusIcon size={12} />
                    {t('entryChangePreview')}
                  </button>
                </>
              )}
            </>
          ) : (
            !onlyView && (
              <div className={styles.previewEmpty}>
                <ImagePlusIcon size={24} />
                <span>{t('entryAddPreview')}</span>
              </div>
            )
          )}
        </div>
      )}

      <div className={styles.fields} style={onlyView ? {maxWidth: '350px'} : undefined}>
        {onlyView && data.roadTitle && <p>{data.roadTitle}</p>}
        {onlyView && data.roadDescription && <p>{data.roadDescription}</p>}
        <div className={styles.fieldGroup}>
          {!onlyView && (
            <input
              className={styles.titleInput}
              value={data?.roadTitle ?? ''}
              onChange={(e) => update({roadTitle: e.target.value})}
              placeholder={t('entryTitlePlaceholder')}
              maxLength={80}
            />
          )}
          {(data?.roadTitle?.length ?? 0) > 0 && !onlyView && (
            <span className={styles.charCount}>{data?.roadTitle?.length ?? 0}/80</span>
          )}
        </div>

        {!onlyView && (
          <textarea
            className={styles.descInput}
            value={data?.roadDescription ?? ''}
            onChange={(e) => update({roadDescription: e.target.value})}
            placeholder={t('entryDescPlaceholder')}
            rows={3}
            maxLength={300}
          />
        )}

        {!onlyView && (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('entryCategory')}</label>
            <div className='nodrag nopan'>
              <CategorySelect
                value={data?.roadCategoryIds ?? []}
                onChange={(ids) => update({roadCategoryIds: ids})}
                canSelectMany={false}
                maxLevel={2}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
