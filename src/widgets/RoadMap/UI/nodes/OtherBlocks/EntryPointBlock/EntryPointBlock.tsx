/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow, useStore} from '@xyflow/react'
import {ImagePlusIcon, XIcon} from 'lucide-react'
import Image from 'next/image'
import {useRef} from 'react'
import styles from './EntryPointBlock.module.scss'

const CATEGORIES = [
  {label: 'Программирование', value: 'programming'},
  {label: 'Дизайн', value: 'design'},
  {label: 'Математика', value: 'math'},
  {label: 'Языки', value: 'languages'},
  {label: 'Бизнес', value: 'business'},
  {label: 'Наука', value: 'science'}
]

type EntryData = RoadNodeData & {
  roadTitle?: string
  roadDescription?: string
  roadCategory?: string
  roadPreview?: string
}

export default function EntryPointBlock({nodeId}: {nodeId: string}) {
  const onlyView = useViewMode() === 'view'
  const {updateNodeData} = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)

  const data = useStore((s) => s.nodeLookup.get(nodeId)?.data as EntryData)

  const update = (patch: Partial<EntryData>) => updateNodeData(nodeId, patch as any)

  const handlePreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      update({roadPreview: reader.result as string})
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsDataURL(file)
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
                    Заменить
                  </button>
                </>
              )}
            </>
          ) : (
            !onlyView && (
              <div className={styles.previewEmpty}>
                <ImagePlusIcon size={24} />
                <span>Добавить обложку</span>
              </div>
            )
          )}
        </div>
      )}

      <div className={styles.fields}>
        {onlyView && data.roadTitle && <p>{data.roadTitle}</p>}
        {onlyView && data.roadDescription && <p>{data.roadDescription}</p>}
        <div className={styles.fieldGroup}>
          {!onlyView && (
            <input
              className={styles.titleInput}
              value={data?.roadTitle ?? ''}
              onChange={(e) => update({roadTitle: e.target.value})}
              placeholder='Название road-map...'
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
            placeholder='Краткое описание...'
            rows={3}
            maxLength={300}
          />
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Категория</label>

          {!onlyView && (
            <select
              className={styles.select}
              value={data?.roadCategory ?? ''}
              onChange={(e) => update({roadCategory: e.target.value})}
            >
              <option value=''>Выберите категорию...</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}

          {onlyView && data?.roadCategory && <span className={styles.categoryView}>{data.roadCategory}</span>}
        </div>
      </div>
    </div>
  )
}
