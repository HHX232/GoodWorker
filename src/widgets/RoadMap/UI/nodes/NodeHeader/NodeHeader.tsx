/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {PRESET_COLORS} from '@/shared/constants/roadMap/roadMap.const'
import {createRoadNode} from '@/shared/helpers/Node/CreateFlowNode'
import {RoadMapBlockType, RoadNode} from '@/shared/types/RoadMap/RoadMap.types'
import {Button} from '@/shared/ui/base/Buttons/Button/Button'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow} from '@xyflow/react'
import {CopyIcon, GripVerticalIcon, PaletteIcon, TrashIcon} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'
import {HexColorPicker} from 'react-colorful'
import styles from './NodeHeader.module.scss'
import {getNodeHeaderIconColor} from '@/shared/helpers/Node/getNodeHeaderIconColor'

export default function NodeHeader({
  taskType,
  nodeId,
  align = 'horizontal',
  hideTitle = false
}: {
  taskType: RoadMapBlockType
  nodeId: string
  align?: 'vertical' | 'horizontal'
  hideTitle?: boolean
}) {
  const task = RoadMapBlockRegistry[taskType]
  const t = useTranslations('roadMap')
  const {deleteElements, getNode, addNodes, updateNodeData} = useReactFlow()

  const node = getNode(nodeId) as RoadNode | undefined
  const savedColor: string = (node?.data as any)?.headerColor ?? task?.headerColor ?? ''

  const [pickerOpen, setPickerOpen] = useState(false)
  const [color, setColor] = useState(savedColor)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler, {capture: true})
    return () => document.removeEventListener('pointerdown', handler, {capture: true})
  }, [pickerOpen])

  const handleColorChange = (newColor: string) => {
    setColor(newColor)
    updateNodeData(nodeId, {headerColor: newColor} as any)
  }
  const activeColor = color || ''
  const iconColor = activeColor ? getNodeHeaderIconColor(activeColor) : undefined
  const onlyView = useViewMode() === 'view'

  return (
    <div
      className={`${styles.header} ${align === 'vertical' ? styles.vertical : ''}`}
      style={{
        backgroundColor: activeColor || undefined,
        transition: 'background-color 0.2s'
      }}
    >
      {task?.icon && <task.icon size={20} style={{color: iconColor, flexShrink: 0}} />}

      <div className={styles.content}>
        {!hideTitle && (
          <p className={styles.label} style={{color: iconColor}}>
            {t(task?.label)}
          </p>
        )}

        <div className={styles.actions}>
          {task?.isEntryPoint && (
            <span className={styles.badge} style={{color: iconColor}}>
              {t('startEntryPoint')}
            </span>
          )}

          {onlyView ? (
            <button className={styles.reportBtn} aria-label='Пожаловаться' title='Пожаловаться'>
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none'>
                <path
                  d='M12 7.75V13'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M21.0802 8.58003V15.42C21.0802 16.54 20.4802 17.58 19.5102 18.15L13.5702 21.58C12.6002 22.14 11.4002 22.14 10.4202 21.58L4.48016 18.15C3.51016 17.59 2.91016 16.55 2.91016 15.42V8.58003C2.91016 7.46003 3.51016 6.41999 4.48016 5.84999L10.4202 2.42C11.3902 1.86 12.5902 1.86 13.5702 2.42L19.5102 5.84999C20.4802 6.41999 21.0802 7.45003 21.0802 8.58003Z'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
                <path
                  d='M12 16.2002V16.3002'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
          ) : (
            <>
              <div style={{position: 'relative'}} ref={pickerRef}>
                <Button
                  variant='ghost'
                  size='icon'
                  style={{color: iconColor}}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPickerOpen((v) => !v)
                  }}
                >
                  <PaletteIcon size={12} />
                </Button>

                {pickerOpen && (
                  <div
                    className={`${styles.pickerPopover} nodrag nopan`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className={styles.pickerRow}>
                      <HexColorPicker color={activeColor || '#ffffff'} onChange={handleColorChange} />
                      <div className={styles.presets}>
                        {PRESET_COLORS.map((preset) => (
                          <button
                            key={preset}
                            className={`${styles.presetSwatch} ${
                              activeColor === preset ? styles.presetSwatchActive : ''
                            }`}
                            style={{backgroundColor: preset}}
                            onClick={() => handleColorChange(preset)}
                            title={preset}
                          />
                        ))}
                      </div>
                    </div>
                    {activeColor && (
                      <button className={styles.resetColor} onClick={() => handleColorChange('')}>
                        ({t('clean')})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!task?.isEntryPoint && (
                <>
                  <Button
                    onClick={() => deleteElements({nodes: [{id: nodeId}]})}
                    variant='ghost'
                    size='icon'
                    style={{color: iconColor}}
                  >
                    <TrashIcon size={12} />
                  </Button>

                  <Button
                    onClick={() => {
                      const n = getNode(nodeId) as RoadNode
                      const newNode = createRoadNode(
                        n.data.type,
                        {x: n.position.x + 200, y: n.position.y - 100},
                        activeColor
                      )
                      addNodes([newNode])
                    }}
                    variant='ghost'
                    size='icon'
                    style={{color: iconColor}}
                  >
                    <CopyIcon size={12} />
                  </Button>
                </>
              )}

              <Button variant='ghost' size='icon' className={styles.dragHandle} style={{color: iconColor}}>
                <GripVerticalIcon size={40} />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
