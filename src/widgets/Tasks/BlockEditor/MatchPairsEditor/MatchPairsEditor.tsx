'use client'
import {useActions} from '@/features/hooks/store/useActions'
import {MatchPairsPayload} from '@/shared/types/Tasks/TaskPayload.type'
import {nanoid} from '@reduxjs/toolkit'
import {useEffect, useRef, useState} from 'react'
import styles from './MatchPairsEditor.module.scss'

interface Props {
  blockId: string
  payload: MatchPairsPayload
}

function MatchPairsEditor({blockId, payload}: Props) {
  const {updateBlockPayload} = useActions()
  const [previewMatches, setPreviewMatches] = useState<Map<string, string>>(new Map())

  const update = (updated: Partial<MatchPairsPayload>) => {
    updateBlockPayload({
      id: blockId,
      payload: {...payload, ...updated}
    })
  }

  const addPair = () => {
    update({
      pairs: [...payload.pairs, {id: nanoid(), left: '', right: ''}]
    })
  }

  const removePair = (id: string) => {
    update({pairs: payload.pairs.filter((p) => p.id !== id)})
  }

  const updatePair = (id: string, side: 'left' | 'right', value: string) => {
    update({
      pairs: payload.pairs.map((p) => (p.id === id ? {...p, [side]: value} : p))
    })
  }

  // Перемешиваем правые элементы для превью соединения
  const rightItems = [...payload.pairs]
    .sort(() => 0) // порядок как есть, можно shuffle при желании
    .map((p) => ({id: p.id, content: p.right}))

  const leftItems = payload.pairs.map((p) => ({id: p.id, content: p.left}))

  return (
    <div className={styles.editor_box}>
      <div className={styles.pairs_list}>
        <div className={styles.pairs_header}>
          <span>Левая часть</span>
          <span>Правая часть</span>
        </div>

        {payload.pairs.map((pair, index) => (
          <div key={pair.id} className={styles.pair_row}>
            <span className={styles.pair_index}>{index + 1}</span>

            <input
              className={styles.pair_input}
              value={pair.left}
              onChange={(e) => updatePair(pair.id, 'left', e.target.value)}
              placeholder={`Левый элемент ${index + 1}`}
            />

            <div className={styles.pair_arrow}>→</div>

            <input
              className={styles.pair_input}
              value={pair.right}
              onChange={(e) => updatePair(pair.id, 'right', e.target.value)}
              placeholder={`Правый элемент ${index + 1}`}
            />

            <button type='button' className={styles.remove_btn} onClick={() => removePair(pair.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <button type='button' className={styles.add_btn} onClick={addPair}>
        + Добавить пару
      </button>

      {payload.pairs.length >= 2 && (
        <div className={styles.preview_box}>
          <span className={styles.preview_label}>Превью для ученика</span>
          <MatchConnector
            gradientId={`grad-${blockId}`}
            leftItems={leftItems}
            rightItems={rightItems}
            matches={previewMatches}
            onMatchesChange={setPreviewMatches}
          />
        </div>
      )}
    </div>
  )
}

// ─── MatchConnector ───────────────────────────────────────────────────────────

type MatchConnectorProps = {
  leftItems: Array<{id: string; content: string}>
  rightItems: Array<{id: string; content: string}>
  matches: Map<string, string>
  onMatchesChange: (matches: Map<string, string>) => void
  readonly?: boolean
  gradientId: string
}

export function MatchConnector({
  leftItems,
  rightItems,
  matches,
  onMatchesChange,
  readonly = false,
  gradientId
}: MatchConnectorProps) {
  const [positions, setPositions] = useState<{
    left: Map<string, {x: number; y: number}>
    right: Map<string, {x: number; y: number}>
  }>({left: new Map(), right: new Map()})

  const [dragging, setDragging] = useState<{
    side: 'left' | 'right'
    id: string
    currentPos: {x: number; y: number} | null
  } | null>(null)

  const [hoveredHandle, setHoveredHandle] = useState<{
    side: 'left' | 'right'
    id: string
  } | null>(null)

  const leftRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const rightRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updatePositions = () => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newLeft = new Map<string, {x: number; y: number}>()
      const newRight = new Map<string, {x: number; y: number}>()

      leftRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect()
        newLeft.set(id, {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        })
      })

      rightRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect()
        newRight.set(id, {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        })
      })

      setPositions({left: newLeft, right: newRight})
    }

    updatePositions()
    const t = setTimeout(updatePositions, 100)
    window.addEventListener('resize', updatePositions)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', updatePositions)
    }
  }, [leftItems, rightItems, matches])

  const handleMouseDown = (side: 'left' | 'right', id: string, e: React.MouseEvent) => {
    if (readonly) return
    e.preventDefault()
    setDragging({side, id, currentPos: null})
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDragging((prev) => (prev ? {...prev, currentPos: {x: e.clientX - rect.left, y: e.clientY - rect.top}} : null))
  }

  const handleMouseUp = () => {
    if (!dragging) return
    if (hoveredHandle && hoveredHandle.side !== dragging.side) {
      const newMatches = new Map(matches)
      const leftId = dragging.side === 'left' ? dragging.id : hoveredHandle.id
      const rightId = dragging.side === 'right' ? dragging.id : hoveredHandle.id
      if (newMatches.get(leftId) === rightId) {
        newMatches.delete(leftId)
      } else {
        newMatches.set(leftId, rightId)
      }
      onMatchesChange(newMatches)
    }
    setDragging(null)
    setHoveredHandle(null)
  }

  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const offset = Math.min(Math.abs(x2 - x1) * 0.5, 150)
    return `M ${x1},${y1} C ${x1 + offset},${y1} ${x2 - offset},${y2} ${x2},${y2}`
  }

  const draggingPath = () => {
    if (!dragging?.currentPos) return null
    const start = dragging.side === 'left' ? positions.left.get(dragging.id) : positions.right.get(dragging.id)
    if (!start) return null
    return bezier(start.x, start.y, dragging.currentPos.x, dragging.currentPos.y)
  }

  const isActive = (side: 'left' | 'right', id: string) =>
    (dragging?.side === side && dragging.id === id) ||
    (!!hoveredHandle && hoveredHandle.side === side && hoveredHandle.id === id && !!dragging)

  return (
    <div
      className={styles.match_grid}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Левая колонка */}
      <div className={styles.match_column}>
        {leftItems.map((item) => {
          const connected = matches.has(item.id)
          const active = isActive('left', item.id)
          return (
            <div
              key={item.id}
              className={`${styles.match_item} ${connected ? styles.connected : ''} ${active ? styles.active : ''}`}
            >
              <span className={styles.match_item_content}>{item.content || '...'}</span>
              <div
                ref={(el) => {
                  if (el) leftRefs.current.set(item.id, el)
                }}
                className={`${styles.handle} ${styles.handle_right} ${connected ? styles.handle_connected : ''} ${active ? styles.handle_active : ''}`}
                onMouseDown={(e) => handleMouseDown('left', item.id, e)}
                onMouseEnter={() => setHoveredHandle({side: 'left', id: item.id})}
                onMouseLeave={() => setHoveredHandle(null)}
              >
                <div className={styles.handle_inner} />
              </div>
            </div>
          )
        })}
      </div>

      {/* SVG линии */}
      <svg className={styles.match_svg}>
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1='0%' y1='0%' x2='100%' y2='0%'>
            <stop offset='0%' stopColor='#000' stopOpacity='0.8' />
            <stop offset='100%' stopColor='#000' stopOpacity='0.8' />
          </linearGradient>
        </defs>

        {Array.from(matches.entries()).map(([leftId, rightId]) => {
          const start = positions.left.get(leftId)
          const end = positions.right.get(rightId)
          if (!start || !end) return null
          const path = bezier(start.x, start.y, end.x, end.y)
          return (
            <g key={`${leftId}-${rightId}`}>
              <path d={path} stroke='rgba(0,0,0,0.08)' strokeWidth='10' fill='none' />
              <path d={path} stroke={`url(#grad-${gradientId})`} strokeWidth='2.5' fill='none' strokeLinecap='round' />
              <circle r='4' fill='#000' opacity='0.5'>
                <animateMotion dur='2s' repeatCount='indefinite' path={path} />
              </circle>
            </g>
          )
        })}

        {dragging?.currentPos && (
          <path
            d={draggingPath() || ''}
            stroke='#4a90e2'
            strokeWidth='2.5'
            fill='none'
            strokeDasharray='5,5'
            strokeLinecap='round'
          />
        )}
      </svg>

      {/* Правая колонка */}
      <div className={styles.match_column}>
        {rightItems.map((item) => {
          const connected = Array.from(matches.values()).includes(item.id)
          const active = isActive('right', item.id)
          return (
            <div
              key={item.id}
              className={`${styles.match_item} ${connected ? styles.connected : ''} ${active ? styles.active : ''}`}
            >
              <div
                ref={(el) => {
                  if (el) rightRefs.current.set(item.id, el)
                }}
                className={`${styles.handle} ${styles.handle_left} ${connected ? styles.handle_connected : ''} ${active ? styles.handle_active : ''}`}
                onMouseDown={(e) => handleMouseDown('right', item.id, e)}
                onMouseEnter={() => setHoveredHandle({side: 'right', id: item.id})}
                onMouseLeave={() => setHoveredHandle(null)}
              >
                <div className={styles.handle_inner} />
              </div>
              <span className={styles.match_item_content}>{item.content || '...'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MatchPairsEditor
