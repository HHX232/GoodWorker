/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import RoadMapBlockRegistry from '@/features/Roadmap/registry'
import {createRoadNode} from '@/shared/helpers/Node/CreateFlowNode'
import {RoadMapBlockType, RoadNode} from '@/shared/types/RoadMap/RoadMap.types'
import {Button} from '@/shared/ui/base/Buttons/Button/Button'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {useReactFlow} from '@xyflow/react'
import {CopyIcon, GripVerticalIcon, PaletteIcon, TrashIcon} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {HexColorPicker} from 'react-colorful'
import styles from './NodeHeader.module.scss'

function getIconColor(hex: string): string | undefined {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return undefined
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance < 0.35) return '#ffffff' // тёмный → белый
  if (luminance < 0.85) return '#141416' // яркий → чёрный
  return undefined // почти белый → серый из CSS
}

const PRESET_COLORS = [
  // Reds
  '#ff6b6b',
  '#ee5a24',
  '#c0392b',
  '#ff4757',
  // Oranges / Yellows
  '#fd9644',
  '#f9ca24',
  '#f0932b',
  '#ffeaa7',
  // Greens
  '#26de81',
  '#20bf6b',
  '#2ecc71',
  '#a3cb38',
  // Blues
  '#45aaf2',
  '#2d98da',
  '#3498db',
  '#4a90d9',
  // Purples / Pinks
  '#a29bfe',
  '#6c5ce7',
  '#fd79a8',
  '#e84393',
  // Neutrals
  '#b2bec3',
  '#636e72',
  '#2d3436',
  '#dfe6e9'
]

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
  const iconColor = activeColor ? getIconColor(activeColor) : undefined
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
            {task?.label}
          </p>
        )}

        <div className={styles.actions}>
          {task?.isEntryPoint && (
            <span className={styles.badge} style={{color: iconColor}}>
              Entry point
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
                            className={`${styles.presetSwatch} ${activeColor === preset ? styles.presetSwatchActive : ''}`}
                            style={{backgroundColor: preset}}
                            onClick={() => handleColorChange(preset)}
                            title={preset}
                          />
                        ))}
                      </div>
                    </div>
                    {activeColor && (
                      <button className={styles.resetColor} onClick={() => handleColorChange('')}>
                        Сбросить
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
