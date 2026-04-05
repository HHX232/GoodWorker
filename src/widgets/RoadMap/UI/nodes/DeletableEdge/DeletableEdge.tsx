'use client'

import {Button} from '@/shared/ui/base/Buttons/Button/Button'
import {useViewMode} from '@/shared/ui/RoadMap/context/ViewModeContext'
import {BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, useReactFlow} from '@xyflow/react'

export default function DeletableEdge(props: EdgeProps) {
  // window.alert(props.id)
  const [edgePath, labelX, labelY] = getSmoothStepPath({...props})
  const {setEdges} = useReactFlow()
  const viewMode = useViewMode()
  const isView = viewMode === 'view'

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={props.markerEnd} style={props.style} />

      {/* кнопка удаления — только в режиме редактирования */}
      {!isView && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all'
            }}
          >
            <Button
              variant='outline'
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                borderRadius: '9999px',
                color: 'var(--cs)',
                lineHeight: '1.2',
                aspectRatio: '1 / 1',
                padding: '10px 8px',
                backgroundColor: '#ffffff',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f4'
                e.currentTarget.style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onClick={() => setEdges((edges) => edges.filter((edge) => edge.id !== props.id))}
            >
              X
            </Button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
