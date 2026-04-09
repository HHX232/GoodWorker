'use client'
import {validateRoadMapNodes} from '@/features/helpers/validateRoadMapNodes'
/* eslint-disable @typescript-eslint/no-explicit-any */
import {RoadNodeData} from '@/shared/types/RoadMap/RoadMap.types'
import {roadMapStorage} from '@/widgets/Tasks/Storage/roadMapStorage'
import {Node, useReactFlow} from '@xyflow/react'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'
import styles from './SaveRoadMapButton.module.scss'
export function SaveRoadMapButton() {
  const {getNodes, getEdges, updateNodeData, fitView} = useReactFlow()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    const nodes = getNodes() as Node<RoadNodeData>[]
    const edges = getEdges()

    nodes.forEach((n) => {
      if ((n.data as any).validationError) {
        updateNodeData(n.id, {validationError: null} as any)
      }
    })

    const errors = validateRoadMapNodes(nodes)

    if (errors.length > 0) {
      errors.forEach(({nodeId, message}) => {
        updateNodeData(nodeId, {validationError: message} as any)
      })

      // скроллим к первой ошибке
      const firstNode = nodes.find((n) => n.id === errors[0].nodeId)
      if (firstNode) {
        fitView({
          nodes: [firstNode],
          duration: 400,
          padding: 0.5
        })
      }

      toast.error(`${errors.length} ${errors.length === 1 ? 'блок не заполнен' : 'блока не заполнены'}`, {
        description: errors[0].message
      })
      return
    }

    setSaving(true)
    try {
      const map = roadMapStorage.create()
      roadMapStorage.update(map.id, {nodes: nodes as any, edges})
      toast.success('Road map сохранён')
      router.push(`/road-map/${map.id}`)
    } catch {
      toast.error('Ошибка при сохранении')
      setSaving(false)
    }
  }

  return (
    <button onClick={handleSave} disabled={saving} className={styles.button}>
      {saving ? (
        <span className={styles.spinner} />
      ) : (
        <svg className={styles.icon} viewBox='0 0 16 16' fill='none'>
          <path
            d='M13 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1ZM5 2v4h6V2M5 9h6'
            stroke='currentColor'
            strokeWidth='1.3'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      )}
      {saving ? 'Сохраняем...' : 'Сохранить'}
    </button>
  )
}
